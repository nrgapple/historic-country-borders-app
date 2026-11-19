/**
 * The GPU half of the border-change animation (WebGL 2, in MapLibre's own
 * context through a custom layer, so it shares the map's camera).
 *
 * Once per transition, in `prerender`:
 * 1. Id raster: both years' triangulated polygons are drawn into one
 *    RGBA16UI target at the drawing-buffer size, with the map's matrix:
 *    R = old owner key, G = new owner key, B = interior seed key (a point
 *    deep inside each brand-new territory part). 0 is "no territory".
 * 2. Jump flood, at a reduced field resolution, with two outputs per pixel p
 *    whose new owner is N:
 *      seed1: the nearest pixel N held in the old year (or an N seed);
 *      seed2: the nearest pixel that is N's in neither year (the far side).
 *    Every pass looks at the 3x3 neighbours at the step distance, both their
 *    own ids and the seeds they found, and keeps those that satisfy p's
 *    predicate. Integer targets are core WebGL 2: no extensions needed.
 * 3. Switch time: t = d1 / (d1 + d2) per changing pixel (plan.ts
 *    `switchTime`), stored with the two owners in one RGBA16UI texture. The
 *    id raster and the flood are freed right after.
 *
 * Every frame, in `render`: one full-screen triangle reads the switch
 * texture, picks the old or new owner by comparing t with the eased
 * progress, colours it from the palette texture and draws a border where a
 * neighbour within half the border width has another owner (and, in
 * Classic atlas, the inner edge band). 3–29 texel fetches per pixel and no
 * allocation in the frame loop.
 */
import type { YearGeometry } from './geometry';

const NONE = 65535;

const ID_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in uint a_id;
uniform mat4 u_matrix;
uniform float u_wrap;
uniform highp usampler2D u_keys;
flat out uint v_key;
void main() {
  v_key = texelFetch(u_keys, ivec2(int(a_id), 0), 0).r;
  gl_Position = u_matrix * vec4(a_pos.x + u_wrap, a_pos.y, 0.0, 1.0);
}`;

const SEED_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
layout(location = 1) in uint a_key;
uniform mat4 u_matrix;
uniform float u_wrap;
uniform float u_size;
flat out uint v_key;
void main() {
  v_key = a_key;
  gl_PointSize = u_size;
  gl_Position = u_matrix * vec4(a_pos.x + u_wrap, a_pos.y, 0.0, 1.0);
}`;

const KEY_FS = `#version 300 es
precision highp float;
flat in uint v_key;
out uvec4 o;
void main() { o = uvec4(v_key); }`;

const FULLSCREEN_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const JFA_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D u_ids;
uniform usampler2D u_seed1;
uniform usampler2D u_seed2;
uniform int u_step;
uniform float u_scale;
uniform ivec2 u_field;
uniform ivec2 u_full;
layout(location = 0) out uvec4 o1;
layout(location = 1) out uvec4 o2;
const uint NONE = 65535u;
uvec4 idsAt(ivec2 f) {
  ivec2 p = ivec2((vec2(f) + 0.5) * u_scale);
  return texelFetch(u_ids, clamp(p, ivec2(0), u_full - 1), 0);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  uint n = idsAt(p).g;
  uvec4 b1 = uvec4(NONE);
  uvec4 b2 = uvec4(NONE);
  float d1 = 1e20;
  float d2 = 1e20;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      ivec2 q = p + ivec2(dx, dy) * u_step;
      if (q.x < 0 || q.y < 0 || q.x >= u_field.x || q.y >= u_field.y) continue;
      uvec4 iq = idsAt(q);
      float dq = distance(vec2(p), vec2(q));
      if ((iq.r == n || iq.b == n) && dq < d1) { d1 = dq; b1 = uvec4(uvec2(q), iq.r, iq.b); }
      if (iq.r != n && iq.g != n && dq < d2) { d2 = dq; b2 = uvec4(uvec2(q), iq.r, iq.g); }
      uvec4 s1 = texelFetch(u_seed1, q, 0);
      if (s1.x != NONE && (s1.z == n || s1.w == n)) {
        float d = distance(vec2(p), vec2(s1.xy));
        if (d < d1) { d1 = d; b1 = s1; }
      }
      uvec4 s2 = texelFetch(u_seed2, q, 0);
      if (s2.x != NONE && s2.z != n && s2.w != n) {
        float d = distance(vec2(p), vec2(s2.xy));
        if (d < d2) { d2 = d; b2 = s2; }
      }
    }
  }
  o1 = b1;
  o2 = b2;
}`;

const SWITCH_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D u_ids;
uniform usampler2D u_seed1;
uniform usampler2D u_seed2;
uniform float u_scale;
uniform ivec2 u_field;
uniform float u_reach;
out uvec4 o;
const uint NONE = 65535u;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  uvec4 me = texelFetch(u_ids, p, 0);
  if (me.r == me.g) { o = uvec4(me.r, me.g, 0u, 0u); return; }
  vec2 pf = (vec2(p) + 0.5) / u_scale - 0.5;
  ivec2 f = clamp(ivec2((vec2(p) + 0.5) / u_scale), ivec2(0), u_field - 1);
  uvec4 s1 = texelFetch(u_seed1, f, 0);
  uvec4 s2 = texelFetch(u_seed2, f, 0);
  bool h1 = s1.x != NONE;
  bool h2 = s2.x != NONE;
  float d1 = h1 ? distance(pf, vec2(s1.xy)) : 0.0;
  float d2 = h2 ? distance(pf, vec2(s2.xy)) : 0.0;
  float t;
  if (!h1 && !h2) t = 0.5;
  else if (!h1) t = 1.0 - min(1.0, d2 / u_reach);
  else if (!h2) t = d1 / (d1 + u_reach);
  else t = (d1 + d2) <= 0.0 ? 0.0 : d1 / (d1 + d2);
  o = uvec4(me.r, me.g, uint(clamp(t, 0.0, 1.0) * 65534.0) + 1u, 0u);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D u_switch;
uniform sampler2D u_palette;
uniform uint u_progress;
uniform float u_mix;
uniform float u_alpha;
uniform float u_lineHalf;
uniform float u_lineCover;
uniform float u_casingR;
uniform float u_bandR;
uniform ivec2 u_size;
out vec4 o;
// Palette rows per year (old year 0-3, new year 4-7).
const int FILL = 0;
const int LINE = 1;
const int CASING = 2;
const int BAND = 3;
const vec2 DIRS[8] = vec2[8](
  vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0),
  vec2(0.7071, 0.7071), vec2(-0.7071, 0.7071), vec2(0.7071, -0.7071), vec2(-0.7071, -0.7071));
ivec2 p;
uint ownerAt(ivec2 q) {
  uvec4 s = texelFetch(u_switch, clamp(q, ivec2(0), u_size - 1), 0);
  return (s.r != s.g && u_progress >= s.b) ? s.g : s.r;
}
vec4 pal(int row, uint key, float year) {
  return mix(texelFetch(u_palette, ivec2(int(key), row), 0),
             texelFetch(u_palette, ivec2(int(key), row + 4), 0), year);
}
// Count of the 8 ring samples at radius r owned by someone other than key.
int ring(float r, uint key, inout uint other) {
  int n = 0;
  for (int i = 0; i < 8; i++) {
    uint k = ownerAt(p + ivec2(round(DIRS[i] * r)));
    if (k != key) { n++; other = k; }
  }
  return n;
}
void main() {
  p = ivec2(gl_FragCoord.xy);
  uvec4 s = texelFetch(u_switch, clamp(p, ivec2(0), u_size - 1), 0);
  bool changing = s.r != s.g;
  bool switched = changing && u_progress >= s.b;
  uint key = switched ? s.g : s.r;
  // An unchanged territory blends its old wash into its new one.
  float year = changing ? (switched ? 1.0 : 0.0) : u_mix;
  vec3 colour = pal(FILL, key, year).rgb;
  uint other = key;
  // Classic's inner edge band: the darker pigment just inside each border.
  if (u_bandR > 0.0 && key != 0u) {
    uint ignored = key;
    float a = ring(u_bandR * 0.45, key, ignored) > 0 ? 1.0
      : ring(u_bandR, key, ignored) > 0 ? 0.45 : 0.0;
    if (a > 0.0) {
      vec4 band = pal(BAND, key, year);
      colour = mix(colour, band.rgb, band.a * a);
    }
  }
  bool line = false;
  if (u_lineHalf > 0.0 && u_lineHalf < 1.0) {
    // Hairline: one crisp pixel on one side of each edge.
    uint k = ownerAt(p + ivec2(1, 0));
    if (k != key) { line = true; other = k; }
    k = ownerAt(p + ivec2(0, 1));
    if (k != key) { line = true; other = k; }
  } else if (u_lineHalf >= 1.0) {
    line = ring(u_lineHalf, key, other) > 0;
    if (!line && u_lineHalf >= 2.0) line = ring(u_lineHalf * 0.5, key, other) > 0;
  }
  bool casing = !line && u_casingR > 0.0 && ring(u_casingR, key, other) > 0;
  uint inkKey = key != 0u ? key : other;
  if (casing || (line && u_casingR > 0.0)) {
    vec4 c = pal(CASING, inkKey, year);
    colour = mix(colour, c.rgb, c.a);
  }
  if (line) {
    vec4 l = pal(LINE, inkKey, year);
    colour = mix(colour, l.rgb, l.a * u_lineCover);
  }
  o = vec4(colour * u_alpha, u_alpha);
}`;

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface Program {
  program: WebGLProgram;
  u: Uniforms;
}

export interface GpuGeometry {
  year: number;
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
  /** Bytes on the GPU, for the budget. */
  bytes: number;
}

export interface PrepareInput {
  from: GpuGeometry;
  to: GpuGeometry;
  /** Year id → shared key. */
  fromKeys: Uint16Array;
  toKeys: Uint16Array;
  /** Interior seeds: x, y (Web Mercator) and key per seed. */
  seeds: Array<{ key: number; x: number; y: number }>;
  /** Old year's palette rows then the new year's, `keyCount` texels each. */
  palette: Uint8Array;
  keyCount: number;
  matrix: ArrayLike<number>;
  wraps: number[];
  field: { width: number; height: number; scale: number };
  steps: number[];
  /** Fallback reach in field px (plan.ts `switchTime`). */
  reach: number;
}

export interface DrawInput {
  progress: number;
  /** Colour blend for territories whose wash changed but not their land. */
  mix: number;
  alpha: number;
  /** Half the border width in device px (0 hides borders). */
  lineHalf: number;
  /** Ink coverage of a hairline (borders thinner than 2 device px). */
  lineCover: number;
  /** Half the casing width in device px (0: no casing). */
  casingR: number;
  /** Width of Classic's inner edge band in device px (0: none). */
  bandR: number;
}

/** Creates and frees every GL object the animation uses. */
export class TransitionRenderer {
  private programs: Record<
    'id' | 'seed' | 'jfa' | 'switch' | 'composite',
    Program
  > | null = null;
  private emptyVao: WebGLVertexArrayObject | null = null;
  private switchTex: WebGLTexture | null = null;
  private paletteTex: WebGLTexture | null = null;
  private size: [number, number] = [0, 0];

  constructor(private gl: WebGL2RenderingContext) {}

  private pending: Record<string, WebGLProgram> | null = null;
  private parallel: { COMPLETION_STATUS_KHR: number } | null = null;

  /**
   * Starts compiling every program without asking for the result, so the
   * driver can work in the background (KHR_parallel_shader_compile where
   * available) while the year's data loads. Asking for a link status any
   * earlier blocks the main thread for the whole compile: 0.5–1.5 s on
   * Metal and D3D the first time.
   */
  startCompile() {
    if (this.programs || this.pending) return;
    const gl = this.gl;
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    const link = (vs: string, fs: string) => {
      const program = gl.createProgram()!;
      for (const [type, source] of [
        [gl.VERTEX_SHADER, vs],
        [gl.FRAGMENT_SHADER, fs],
      ] as const) {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
        gl.deleteShader(shader);
      }
      gl.linkProgram(program);
      return program;
    };
    this.pending = {
      id: link(ID_VS, KEY_FS),
      seed: link(SEED_VS, KEY_FS),
      jfa: link(FULLSCREEN_VS, JFA_FS),
      switch: link(FULLSCREEN_VS, SWITCH_FS),
      composite: link(FULLSCREEN_VS, COMPOSITE_FS),
    };
  }

  /** True when the programs can be used without a stall (always, without the extension). */
  get compiled(): boolean {
    if (this.programs) return true;
    if (!this.pending || !this.parallel) return Boolean(this.pending);
    const done = this.parallel.COMPLETION_STATUS_KHR;
    return Object.values(this.pending).every((p) =>
      this.gl.getProgramParameter(p, done),
    );
  }

  private finish(program: WebGLProgram): Program {
    const gl = this.gl;
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error(`Program: ${gl.getProgramInfoLog(program)}`);
    const u: Uniforms = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) u[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program, u };
  }

  private ensurePrograms() {
    if (this.programs) return this.programs;
    this.startCompile();
    const p = this.pending!;
    this.pending = null;
    this.programs = {
      id: this.finish(p.id),
      seed: this.finish(p.seed),
      jfa: this.finish(p.jfa),
      switch: this.finish(p.switch),
      composite: this.finish(p.composite),
    };
    this.emptyVao = this.gl.createVertexArray();
    return this.programs;
  }

  /** Uploads a year's triangles (kept between transitions as the next "from"). */
  upload(geometry: YearGeometry): GpuGeometry {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const pos = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, pos);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ids = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, ids);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.ids, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_SHORT, 0, 0);
    const index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return {
      year: geometry.year,
      vao,
      buffers: [pos, ids, index],
      count: geometry.indices.length,
      bytes:
        geometry.positions.byteLength +
        geometry.ids.byteLength +
        geometry.indices.byteLength,
    };
  }

  free(geometry: GpuGeometry) {
    const gl = this.gl;
    gl.deleteVertexArray(geometry.vao);
    geometry.buffers.forEach((b) => gl.deleteBuffer(b));
  }

  private texture(
    width: number,
    height: number,
    internal: number,
    format: number,
    type: number,
    data: ArrayBufferView | null = null,
  ) {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internal,
      width,
      height,
      0,
      format,
      type,
      data,
    );
    return tex;
  }

  private target(textures: WebGLTexture[]) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    textures.forEach((tex, i) =>
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        gl.TEXTURE_2D,
        tex,
        0,
      ),
    );
    gl.drawBuffers(textures.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    return fbo;
  }

  private bind(
    unit: number,
    tex: WebGLTexture,
    location: WebGLUniformLocation | null,
  ) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(location, unit);
  }

  /** True once `prepare` has produced a switch texture. */
  get ready() {
    return this.switchTex !== null;
  }

  /**
   * Runs the id raster, the jump flood and the switch pass. Call from the
   * custom layer's `prerender` (MapLibre restores its own state after it).
   */
  prepare(input: PrepareInput) {
    const gl = this.gl;
    const programs = this.ensurePrograms();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    this.size = [width, height];
    const { field } = input;

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.colorMask(true, true, true, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    const rgba16ui = (w: number, h: number) =>
      this.texture(w, h, gl.RGBA16UI, gl.RGBA_INTEGER, gl.UNSIGNED_SHORT);
    const lookup = (keys: Uint16Array) =>
      this.texture(
        Math.max(1, keys.length),
        1,
        gl.R16UI,
        gl.RED_INTEGER,
        gl.UNSIGNED_SHORT,
        keys.length ? keys : new Uint16Array(1),
      );

    // 1. Id raster.
    const ids = rgba16ui(width, height);
    const idFbo = this.target([ids]);
    gl.viewport(0, 0, width, height);
    gl.clearBufferuiv(gl.COLOR, 0, [0, 0, NONE, 0]);
    const fromLookup = lookup(input.fromKeys);
    const toLookup = lookup(input.toKeys);
    const id = programs.id;
    gl.useProgram(id.program);
    gl.uniformMatrix4fv(id.u.u_matrix, false, input.matrix as Float32Array);
    const drawYear = (geometry: GpuGeometry, keys: WebGLTexture) => {
      this.bind(0, keys, id.u.u_keys);
      gl.bindVertexArray(geometry.vao);
      for (const wrap of input.wraps) {
        gl.uniform1f(id.u.u_wrap, wrap);
        gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_INT, 0);
      }
    };
    gl.colorMask(true, false, false, false);
    drawYear(input.from, fromLookup);
    gl.colorMask(false, true, false, false);
    drawYear(input.to, toLookup);
    let seedVao: WebGLVertexArrayObject | null = null;
    const seedBuffers: WebGLBuffer[] = [];
    if (input.seeds.length) {
      const pos = new Float32Array(input.seeds.length * 2);
      const keys = new Uint16Array(input.seeds.length);
      input.seeds.forEach((s, i) => {
        pos[i * 2] = s.x;
        pos[i * 2 + 1] = s.y;
        keys[i] = s.key;
      });
      seedVao = gl.createVertexArray();
      gl.bindVertexArray(seedVao);
      const pb = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, pb);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const kb = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, kb);
      gl.bufferData(gl.ARRAY_BUFFER, keys, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribIPointer(1, 1, gl.UNSIGNED_SHORT, 0, 0);
      seedBuffers.push(pb, kb);
      const seed = programs.seed;
      gl.useProgram(seed.program);
      gl.uniformMatrix4fv(seed.u.u_matrix, false, input.matrix as Float32Array);
      // Big enough that the field's samples (one per `scale` px) find it.
      gl.uniform1f(seed.u.u_size, Math.ceil(field.scale * 2) + 1);
      gl.colorMask(false, false, true, false);
      for (const wrap of input.wraps) {
        gl.uniform1f(seed.u.u_wrap, wrap);
        gl.drawArrays(gl.POINTS, 0, input.seeds.length);
      }
    }
    gl.colorMask(true, true, true, true);

    // 2. Jump flood at the field resolution, ping-ponging two MRT targets.
    const seeds = [0, 1].map(() => [
      rgba16ui(field.width, field.height),
      rgba16ui(field.width, field.height),
    ]);
    const fbos = seeds.map((pair) => this.target(pair));
    for (const fbo of fbos) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.clearBufferuiv(gl.COLOR, 0, [NONE, NONE, NONE, NONE]);
      gl.clearBufferuiv(gl.COLOR, 1, [NONE, NONE, NONE, NONE]);
    }
    gl.bindVertexArray(this.emptyVao);
    const jfa = programs.jfa;
    gl.useProgram(jfa.program);
    gl.viewport(0, 0, field.width, field.height);
    gl.uniform1f(jfa.u.u_scale, field.scale);
    gl.uniform2i(jfa.u.u_field, field.width, field.height);
    gl.uniform2i(jfa.u.u_full, width, height);
    let read = 0;
    for (const step of input.steps) {
      const write = 1 - read;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[write]);
      this.bind(0, ids, jfa.u.u_ids);
      this.bind(1, seeds[read][0], jfa.u.u_seed1);
      this.bind(2, seeds[read][1], jfa.u.u_seed2);
      gl.uniform1i(jfa.u.u_step, step);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      read = write;
    }

    // 3. Switch times at full resolution.
    if (this.switchTex) gl.deleteTexture(this.switchTex);
    this.switchTex = rgba16ui(width, height);
    const switchFbo = this.target([this.switchTex]);
    gl.viewport(0, 0, width, height);
    const sw = programs.switch;
    gl.useProgram(sw.program);
    this.bind(0, ids, sw.u.u_ids);
    this.bind(1, seeds[read][0], sw.u.u_seed1);
    this.bind(2, seeds[read][1], sw.u.u_seed2);
    gl.uniform1f(sw.u.u_scale, field.scale);
    gl.uniform2i(sw.u.u_field, field.width, field.height);
    gl.uniform1f(sw.u.u_reach, input.reach);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // The palette: three rows per year.
    if (this.paletteTex) gl.deleteTexture(this.paletteTex);
    this.paletteTex = this.texture(
      input.keyCount,
      8,
      gl.RGBA8,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      input.palette,
    );

    // Free everything but the switch texture and the palette.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindVertexArray(null);
    [idFbo, switchFbo, ...fbos].forEach((f) => gl.deleteFramebuffer(f));
    [ids, fromLookup, toLookup, ...seeds.flat()].forEach((t) =>
      gl.deleteTexture(t),
    );
    if (seedVao) gl.deleteVertexArray(seedVao);
    seedBuffers.forEach((b) => gl.deleteBuffer(b));
  }

  /** Draws the overlay into MapLibre's current target (the custom layer's `render`). */
  draw(input: DrawInput) {
    if (!this.programs || !this.switchTex || !this.paletteTex) return;
    const gl = this.gl;
    const c = this.programs.composite;
    gl.useProgram(c.program);
    gl.bindVertexArray(this.emptyVao);
    this.bind(0, this.switchTex, c.u.u_switch);
    this.bind(1, this.paletteTex, c.u.u_palette);
    // Switch times are stored as 1…65535 (see SWITCH_FS); 0 switches nothing.
    gl.uniform1ui(
      c.u.u_progress,
      input.progress <= 0 ? 0 : Math.round(input.progress * 65534) + 1,
    );
    gl.uniform1f(c.u.u_mix, input.mix);
    gl.uniform1f(c.u.u_alpha, input.alpha);
    gl.uniform1f(c.u.u_lineHalf, input.lineHalf);
    gl.uniform1f(c.u.u_lineCover, input.lineCover);
    gl.uniform1f(c.u.u_casingR, input.casingR);
    gl.uniform1f(c.u.u_bandR, input.bandR);
    gl.uniform2i(c.u.u_size, this.size[0], this.size[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Frees the per-transition textures (geometry stays for the next change). */
  release() {
    const gl = this.gl;
    if (this.switchTex) gl.deleteTexture(this.switchTex);
    if (this.paletteTex) gl.deleteTexture(this.paletteTex);
    this.switchTex = null;
    this.paletteTex = null;
  }

  destroy() {
    this.release();
    const gl = this.gl;
    if (this.programs)
      Object.values(this.programs).forEach((p) => gl.deleteProgram(p.program));
    if (this.emptyVao) gl.deleteVertexArray(this.emptyVao);
    this.programs = null;
    this.emptyVao = null;
  }
}
