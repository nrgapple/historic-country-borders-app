/**
 * Reads territory colours from the live map style, so the animation paints
 * exactly what the vector layers paint in either map style (Classic atlas
 * or Modern textbook) and with the visitor's opacity and border settings.
 *
 * MapLibre does not expose its expression evaluator, and bundling the style
 * spec's would cost far more than this: a small evaluator for the operators
 * the app's styles use. Anything else throws `UnsupportedExpression`, and
 * the year change is then shown without animation.
 */

export class UnsupportedExpression extends Error {}

export type RGBA = [number, number, number, number];

export interface EvalContext {
  properties: Record<string, unknown>;
  featureState: Record<string, unknown>;
  zoom: number;
}

const NAMED: Record<string, RGBA> = {
  transparent: [0, 0, 0, 0],
  white: [1, 1, 1, 1],
  black: [0, 0, 0, 1],
};

/** Parses `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` and `rgba()` to 0–1 RGBA. */
export function parseColor(value: unknown): RGBA {
  if (Array.isArray(value) && value.length === 4 && value.every(isNum))
    return value as RGBA;
  if (typeof value !== 'string') throw new UnsupportedExpression('colour');
  const s = value.trim().toLowerCase();
  if (NAMED[s]) return [...NAMED[s]] as RGBA;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4)
      hex = [...hex].map((c) => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8)
      throw new UnsupportedExpression(value);
    const ch = (i: number) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return [ch(0), ch(1), ch(2), hex.length === 8 ? ch(3) : 1];
  }
  m = /^rgba?\(([^)]+)\)$/.exec(s);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) throw new UnsupportedExpression(value);
    const channel = (p: string) =>
      p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p) / 255;
    const alpha = parts[3]
      ? parts[3].endsWith('%')
        ? parseFloat(parts[3]) / 100
        : parseFloat(parts[3])
      : 1;
    const out = [
      channel(parts[0]),
      channel(parts[1]),
      channel(parts[2]),
      alpha,
    ] as RGBA;
    if (!out.every(Number.isFinite)) throw new UnsupportedExpression(value);
    return out;
  }
  throw new UnsupportedExpression(value);
}

const isNum = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isColorLike = (v: unknown) =>
  typeof v === 'string' && (v.startsWith('#') || v.startsWith('rgb'));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function interpolateValue(a: unknown, b: unknown, t: number): unknown {
  if (isNum(a) && isNum(b)) return lerp(a, b, t);
  if (isColorLike(a) || isColorLike(b) || Array.isArray(a)) {
    const ca = parseColor(a),
      cb = parseColor(b);
    return ca.map((v, i) => lerp(v, cb[i], t)) as RGBA;
  }
  throw new UnsupportedExpression('interpolate value');
}

const equal = (a: unknown, b: unknown) => a === b;

/** Evaluates a MapLibre style value (constant or expression) for one feature. */
export function evaluate(value: unknown, ctx: EvalContext): unknown {
  if (!Array.isArray(value)) return value;
  const [op, ...args] = value as [string, ...unknown[]];
  const ev = (v: unknown) => evaluate(v, ctx);
  switch (op) {
    case 'literal':
      return args[0];
    case 'get':
      if (args.length !== 1) throw new UnsupportedExpression('get object');
      return ctx.properties[ev(args[0]) as string] ?? null;
    case 'has':
      return (ev(args[0]) as string) in ctx.properties;
    case 'feature-state':
      return ctx.featureState[ev(args[0]) as string] ?? null;
    case 'zoom':
      return ctx.zoom;
    case 'boolean':
    case 'number':
    case 'string': {
      const want = op;
      for (const arg of args) {
        const v = ev(arg);
        if (typeof v === want) return v;
      }
      if (args.length === 1) throw new UnsupportedExpression(`${op} assert`);
      return ev(args[args.length - 1]);
    }
    case 'to-string': {
      const v = ev(args[0]);
      return v === null ? '' : String(v);
    }
    case 'to-number': {
      for (const arg of args) {
        const n = Number(ev(arg));
        if (Number.isFinite(n)) return n;
      }
      return 0;
    }
    case 'to-boolean':
      return Boolean(ev(args[0]));
    case 'to-color':
      return parseColor(ev(args[0]));
    case 'rgb':
    case 'rgba': {
      const [r, g, b, a = 1] = args.map(ev) as number[];
      return [r / 255, g / 255, b / 255, a] as RGBA;
    }
    case 'coalesce':
      for (const arg of args) {
        const v = ev(arg);
        if (v !== null && v !== undefined) return v;
      }
      return null;
    case 'case': {
      for (let i = 0; i + 1 < args.length; i += 2)
        if (ev(args[i]) === true) return ev(args[i + 1]);
      return ev(args[args.length - 1]);
    }
    case 'match': {
      const input = ev(args[0]);
      for (let i = 1; i + 1 < args.length - 1; i += 2) {
        const labels = args[i];
        const hit = Array.isArray(labels)
          ? labels.some((l) => equal(l, input))
          : equal(labels, input);
        if (hit) return ev(args[i + 1]);
      }
      return ev(args[args.length - 1]);
    }
    case '==':
      return equal(ev(args[0]), ev(args[1]));
    case '!=':
      return !equal(ev(args[0]), ev(args[1]));
    case '<':
    case '<=':
    case '>':
    case '>=': {
      const a = ev(args[0]) as number,
        b = ev(args[1]) as number;
      if (a === null || b === null) return false;
      return op === '<'
        ? a < b
        : op === '<='
          ? a <= b
          : op === '>'
            ? a > b
            : a >= b;
    }
    case '!':
      return !ev(args[0]);
    case 'all':
      return args.every((a) => ev(a) === true);
    case 'any':
      return args.some((a) => ev(a) === true);
    case '+':
      return (args.map(ev) as number[]).reduce((a, b) => a + b, 0);
    case '*':
      return (args.map(ev) as number[]).reduce((a, b) => a * b, 1);
    case '-':
      return args.length === 1
        ? -(ev(args[0]) as number)
        : (ev(args[0]) as number) - (ev(args[1]) as number);
    case '/':
      return (ev(args[0]) as number) / (ev(args[1]) as number);
    case '%':
      return (ev(args[0]) as number) % (ev(args[1]) as number);
    case 'min':
      return Math.min(...(args.map(ev) as number[]));
    case 'max':
      return Math.max(...(args.map(ev) as number[]));
    case 'concat':
      return args.map((a) => String(ev(a) ?? '')).join('');
    case 'step': {
      const input = ev(args[0]) as number;
      let out = args[1];
      for (let i = 2; i + 1 < args.length; i += 2)
        if (input >= (args[i] as number)) out = args[i + 1];
      return ev(out);
    }
    case 'interpolate': {
      const [kind, inputExpr, ...stops] = args as [
        unknown[],
        unknown,
        ...unknown[],
      ];
      if (!Array.isArray(kind) || kind[0] !== 'linear')
        throw new UnsupportedExpression(`interpolate ${String(kind?.[0])}`);
      const input = ev(inputExpr) as number;
      const n = stops.length / 2;
      const at = (i: number) => stops[i * 2] as number;
      const out = (i: number) => ev(stops[i * 2 + 1]);
      if (input <= at(0)) return out(0);
      if (input >= at(n - 1)) return out(n - 1);
      for (let i = 0; i < n - 1; i++)
        if (input < at(i + 1))
          return interpolateValue(
            out(i),
            out(i + 1),
            (input - at(i)) / (at(i + 1) - at(i)),
          );
      return out(n - 1);
    }
    default:
      throw new UnsupportedExpression(String(op));
  }
}

export const evaluateColor = (
  value: unknown,
  ctx: EvalContext,
  fallback: string,
): RGBA => parseColor(value === undefined ? fallback : evaluate(value, ctx));

export const evaluateNumber = (
  value: unknown,
  ctx: EvalContext,
  fallback: number,
): number => {
  const v = value === undefined ? fallback : evaluate(value, ctx);
  if (!isNum(v)) throw new UnsupportedExpression('number');
  return v;
};

/** Paint values the overlay needs, read from the live style. */
export interface PaintSource {
  land: unknown;
  fillColor: unknown;
  fillOpacity: unknown;
  lineColor: unknown;
  lineWidth: unknown;
  lineOpacity: unknown;
  /** Modern textbook's white casing under the border, when shown. */
  casing: { color: unknown; width: unknown } | null;
  /** Classic atlas's inner edge band (a line offset inwards), when shown. */
  band: {
    color: unknown;
    width: unknown;
    offset: unknown;
    opacity: unknown;
  } | null;
}

/** Palette rows per year, in this order (gl.ts reads them by index). */
export const PALETTE_ROWS = 4;

export interface Palette {
  /**
   * RGBA bytes, `count` texels per row: fill (opaque, composited on the
   * land), border (alpha = opacity), casing, edge band (alpha = opacity).
   */
  rows: Uint8Array;
  count: number;
  /** Border and casing widths in CSS px at the current zoom. */
  lineWidth: number;
  casingWidth: number;
  /** How far the edge band reaches inside a border, in CSS px (0: none). */
  bandWidth: number;
}

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);

/**
 * One year's colours by shared key: the fill composited over the land as the
 * fill layer draws it, then the border colour and opacity, the casing and the
 * edge band.
 * Key 0 ("no territory") is bare land.
 */
export function buildPalette(
  paint: PaintSource,
  props: ReadonlyArray<Record<string, number> | undefined>,
  keys: Uint16Array,
  count: number,
  featureState: (id: number) => Record<string, unknown>,
  zoom: number,
): Palette {
  const rows = new Uint8Array(count * PALETTE_ROWS * 4);
  const base: EvalContext = { properties: {}, featureState: {}, zoom };
  const land = evaluateColor(paint.land, base, '#000000');
  const put = (row: number, key: number, c: RGBA) => {
    const o = (row * count + key) * 4;
    rows[o] = byte(c[0]);
    rows[o + 1] = byte(c[1]);
    rows[o + 2] = byte(c[2]);
    rows[o + 3] = byte(c[3]);
  };
  put(0, 0, [land[0], land[1], land[2], 1]);
  let lineWidth = 0;
  let casingWidth = 0;
  let bandWidth = 0;
  for (let id = 0; id < keys.length; id++) {
    const key = keys[id];
    if (!key) continue;
    const ctx: EvalContext = {
      properties: props[id] ?? {},
      featureState: featureState(id),
      zoom,
    };
    const fill = evaluateColor(paint.fillColor, ctx, '#000000');
    const a = fill[3] * evaluateNumber(paint.fillOpacity, ctx, 1);
    put(0, key, [
      lerp(land[0], fill[0], a),
      lerp(land[1], fill[1], a),
      lerp(land[2], fill[2], a),
      1,
    ]);
    const line = evaluateColor(paint.lineColor, ctx, '#000000');
    put(1, key, [
      line[0],
      line[1],
      line[2],
      line[3] * evaluateNumber(paint.lineOpacity, ctx, 1),
    ]);
    lineWidth = Math.max(lineWidth, evaluateNumber(paint.lineWidth, ctx, 1));
    if (paint.casing) {
      put(2, key, evaluateColor(paint.casing.color, ctx, '#000000'));
      casingWidth = Math.max(
        casingWidth,
        evaluateNumber(paint.casing.width, ctx, 1),
      );
    }
    if (paint.band) {
      const band = evaluateColor(paint.band.color, ctx, '#000000');
      put(3, key, [
        band[0],
        band[1],
        band[2],
        band[3] * evaluateNumber(paint.band.opacity, ctx, 1),
      ]);
      bandWidth = Math.max(
        bandWidth,
        Math.abs(evaluateNumber(paint.band.offset, ctx, 0)) +
          evaluateNumber(paint.band.width, ctx, 1) / 2,
      );
    }
  }
  return { rows, count, lineWidth, casingWidth, bandWidth };
}
