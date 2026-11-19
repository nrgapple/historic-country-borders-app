/**
 * The border-change animation (lazy-loaded by the map controller on the
 * first year change it animates).
 *
 * Lifecycle of one change, `from → to`:
 * 1. prepare: triangulated geometry for both years (worker, cached per year;
 *    the polygons come from the HTTP cache MapLibre also uses) and both
 *    years' indexes for the territory names. The map keeps showing `from`
 *    with the usual loading bar meanwhile.
 * 2. start: a custom layer goes in just above the territory fills (under
 *    relief, edge bands, borders, water and labels). Its first frame builds
 *    the switch texture (gl.ts); it fades in over the vector fills while the
 *    vector border lines and every label fade out.
 * 3. grow: the borders source gets the new year's data under the opaque
 *    overlay, and the fronts move for `TIMING.grow` ms.
 * 4. settle: once the new year's tiles are drawn underneath, the overlay
 *    fades out while the border lines and the new labels fade back in, then
 *    the layer and its textures are removed.
 *
 * Pan, zoom, resize, a hidden tab or a style change snaps straight to the
 * new year; a year change mid-animation snaps and starts from there
 * (plan.ts `reduce`).
 */
import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';
import { LAYER, SOURCE } from '../../adapters/mapStyle';
import { TEXTBOOK_LAYER } from '../../adapters/textbookStyle';
import type { YearIndex } from '../../adapters/yearData';
import type { YearGeometry } from './geometry';
import type { GeometryRequest } from './geometry.worker';
import { TransitionRenderer, type GpuGeometry } from './gl';
import { buildPalette, type PaintSource } from './paint';
import {
  fieldSize,
  frameAt,
  interiorSeeds,
  jumpSteps,
  reduce,
  sharedKeys,
  TIMING,
  worldCopies,
  type Effect,
  type Machine,
  type MachineEvent,
} from './plan';

export interface TransitionHost {
  map: MapLibreMap;
  container: HTMLElement;
  /** The year's polygons URL (the borders source's data). */
  polygonsUrl(year: number): string;
  index(year: number): Promise<YearIndex>;
  /** The selected place's name, if any. */
  place(): string | null;
  /** Gives the borders, labels and capitals sources the year's data. */
  showYear(year: number): void;
  /** The year the borders source holds. */
  bordersYear(): number;
  /** Called when the overlay is gone (finished or snapped). */
  settled(): void;
}

export interface BorderTransitions {
  /** A year change: animate from the year the map shows to `to`. */
  request(from: number, to: number): void;
  /** Finish a running change at once (a theme or settings change). */
  snap(): void;
  /** Snap a running change and drop one still preparing: the caller shows the year. */
  abort(): void;
  /** True while the overlay is on screen. */
  readonly running: boolean;
  /** True while preparing or running. */
  readonly busy: boolean;
  /** The controller re-applied layer properties: keep the fades in place. */
  reassert(): void;
  destroy(): void;
}

export const OVERLAY_LAYER_ID = 'border-transition';
const MAX_CPU_YEARS = 3;

/* ---- Geometry worker ---------------------------------------------------- */

type Pending = {
  resolve: (g: YearGeometry) => void;
  reject: (e: Error) => void;
};

function geometryClient() {
  let worker: Worker | null = null;
  let seq = 0;
  const pending = new Map<number, Pending>();
  const cache = new Map<number, Promise<YearGeometry>>();
  const start = () => {
    worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), {
      type: 'module',
      name: 'border-geometry',
    });
    worker.onmessage = (
      event: MessageEvent<{
        id: number;
        geometry?: YearGeometry;
        error?: string;
      }>,
    ) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.geometry) job.resolve(event.data.geometry);
      else job.reject(new Error(event.data.error ?? 'geometry'));
    };
    worker.onerror = () => {
      pending.forEach((job) => job.reject(new Error('geometry worker')));
      pending.clear();
    };
  };
  return {
    load(year: number, url: string) {
      let promise = cache.get(year);
      if (promise) {
        // Most recently used last.
        cache.delete(year);
        cache.set(year, promise);
        return promise;
      }
      if (!worker) start();
      const id = ++seq;
      promise = new Promise<YearGeometry>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker!.postMessage({ id, year, url } satisfies GeometryRequest);
      });
      promise.catch(() => cache.delete(year));
      cache.set(year, promise);
      while (cache.size > MAX_CPU_YEARS)
        cache.delete(cache.keys().next().value!);
      return promise;
    },
    destroy() {
      worker?.terminate();
      pending.clear();
      cache.clear();
    },
  };
}

/* ---- Fading the vector lines and the labels ----------------------------- */

type Fade = { id: string; prop: string };

/**
 * Hides paint properties with MapLibre's own paint transitions and puts the
 * style's values back afterwards. Only opacity properties that the style
 * either leaves unset or that `reassert` re-hides after the controller
 * re-applies the theme.
 */
class Fader {
  private saved = new Map<string, unknown>();
  constructor(
    private map: MapLibreMap,
    private fades: Fade[],
  ) {}

  private set(fade: Fade, value: unknown, duration: number) {
    const loose = this.map as unknown as {
      setPaintProperty(id: string, k: string, v: unknown): void;
    };
    if (!this.map.getLayer(fade.id)) return;
    loose.setPaintProperty(fade.id, `${fade.prop}-transition`, {
      duration,
      delay: 0,
    });
    loose.setPaintProperty(fade.id, fade.prop, value);
  }

  hide(duration: number) {
    for (const fade of this.fades) {
      if (!this.map.getLayer(fade.id)) continue;
      const key = `${fade.id}|${fade.prop}`;
      const current = (
        this.map as unknown as {
          getPaintProperty(id: string, k: string): unknown;
        }
      ).getPaintProperty(fade.id, fade.prop);
      if (current !== 0 || !this.saved.has(key)) this.saved.set(key, current);
      this.set(fade, 0, duration);
    }
  }

  restore(duration: number) {
    for (const fade of this.fades) {
      const key = `${fade.id}|${fade.prop}`;
      if (this.saved.has(key)) this.set(fade, this.saved.get(key), duration);
    }
    this.saved.clear();
  }

  /** Drops the transition overrides once the fade-in is over. */
  clearTransitions() {
    const loose = this.map as unknown as {
      setPaintProperty(id: string, k: string, v: unknown): void;
    };
    for (const fade of this.fades)
      if (this.map.getLayer(fade.id))
        loose.setPaintProperty(fade.id, `${fade.prop}-transition`, undefined);
  }
}

const LABEL_SOURCES = new Set<string>([
  SOURCE.labels,
  SOURCE.capitals,
  SOURCE.viewportLabels,
]);

function fadesFor(map: MapLibreMap): Fade[] {
  const fades: Fade[] = [];
  for (const layer of map.getStyle().layers) {
    const source = (layer as { source?: string }).source;
    if (layer.type === 'line' && source === SOURCE.borders)
      fades.push({ id: layer.id, prop: 'line-opacity' });
    else if (layer.type === 'symbol' && source && LABEL_SOURCES.has(source))
      fades.push(
        { id: layer.id, prop: 'text-opacity' },
        { id: layer.id, prop: 'icon-opacity' },
      );
  }
  return fades;
}

/** The overlay goes right above the territory fills and their hatches. */
function overlayBefore(map: MapLibreMap): string | undefined {
  const layers = map.getStyle().layers;
  const fill = layers.findIndex((l) => l.id === LAYER.territoryFill);
  for (let i = fill + 1; i < layers.length; i++) {
    const layer = layers[i] as { type: string; source?: string };
    if (!(layer.type === 'fill' && layer.source === SOURCE.borders))
      return layers[i].id;
  }
  return undefined;
}

function paintSource(map: MapLibreMap): PaintSource {
  const shown = (id: string) =>
    Boolean(map.getLayer(id)) &&
    map.getLayoutProperty(id, 'visibility') !== 'none';
  const casingShown = shown(TEXTBOOK_LAYER.borderCasing);
  const paint = (id: string, k: string) =>
    (
      map as unknown as { getPaintProperty(id: string, k: string): unknown }
    ).getPaintProperty(id, k);
  return {
    land: map.getPaintProperty(LAYER.land, 'background-color'),
    fillColor: map.getPaintProperty(LAYER.territoryFill, 'fill-color'),
    fillOpacity: map.getPaintProperty(LAYER.territoryFill, 'fill-opacity'),
    lineColor: map.getPaintProperty(LAYER.border, 'line-color'),
    lineWidth: map.getPaintProperty(LAYER.border, 'line-width'),
    lineOpacity: map.getPaintProperty(LAYER.border, 'line-opacity'),
    casing: casingShown
      ? {
          color: map.getPaintProperty(
            TEXTBOOK_LAYER.borderCasing,
            'line-color',
          ),
          width: map.getPaintProperty(
            TEXTBOOK_LAYER.borderCasing,
            'line-width',
          ),
        }
      : null,
    band: shown(LAYER.edgeBand)
      ? {
          color: paint(LAYER.edgeBand, 'line-color'),
          width: paint(LAYER.edgeBand, 'line-width'),
          offset: paint(LAYER.edgeBand, 'line-offset') ?? 0,
          opacity: paint(LAYER.edgeBand, 'line-opacity'),
        }
      : null,
  };
}

/** Feature-state the vector layers would have for the selected place. */
function selectionState(index: YearIndex, place: string | null) {
  const selected = place
    ? index.territories.findIndex((t) => t.NAME === place)
    : -1;
  const dependencies = new Set(
    selected < 0
      ? []
      : index.territories
          .filter((t) => t.dep && t.ov === selected)
          .map((t) => t.id),
  );
  return (id: number) => ({
    selected: id === selected,
    overlordSelected: dependencies.has(id),
  });
}

/* ---- One running change ------------------------------------------------- */

interface Prepared {
  from: YearGeometry;
  to: YearGeometry;
  fromIndex: YearIndex;
  toIndex: YearIndex;
}

export function createBorderTransitions(
  host: TransitionHost,
): BorderTransitions {
  const { map, container } = host;
  const geometry = geometryClient();
  let renderer: TransitionRenderer | null = null;
  const gpu = new Map<number, GpuGeometry>();
  let machine: Machine = { kind: 'idle' };
  let prepared: { token: number; data: Prepared } | null = null;
  let run: Run | null = null;
  let destroyed = false;

  /**
   * The renderer lives in the map's own context: getContext returns the
   * context MapLibre created for its canvas (null if that is not WebGL 2).
   */
  const ensureRenderer = () => {
    if (renderer) return renderer;
    const gl = map.getCanvas().getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 required');
    renderer = new TransitionRenderer(gl);
    return renderer;
  };

  /** Resolves once the shaders compiled in the background (at most ~2 s of waiting). */
  const compiled = () =>
    new Promise<void>((resolve, reject) => {
      let r: TransitionRenderer;
      try {
        r = ensureRenderer();
        r.startCompile();
      } catch (error) {
        reject(error);
        return;
      }
      const started = performance.now();
      const poll = () => {
        if (destroyed) reject(new Error('destroyed'));
        else if (r.compiled || performance.now() - started > 2000) resolve();
        else requestAnimationFrame(poll);
      };
      poll();
    });

  const dispatch = (event: MachineEvent) => {
    if (destroyed) return;
    const next = reduce(machine, event);
    machine = next.state;
    next.effects.forEach(apply);
  };

  const apply = (effect: Effect) => {
    switch (effect.type) {
      case 'snap':
        run?.end(false);
        break;
      case 'show':
        host.showYear(effect.year);
        host.settled();
        break;
      case 'prepare': {
        const { from, to, token } = effect;
        Promise.all([
          geometry.load(from, host.polygonsUrl(from)),
          geometry.load(to, host.polygonsUrl(to)),
          host.index(from),
          host.index(to),
          compiled(),
        ]).then(
          ([fromGeometry, toGeometry, fromIndex, toIndex]) => {
            prepared = {
              token,
              data: {
                from: fromGeometry,
                to: toGeometry,
                fromIndex,
                toIndex,
              },
            };
            dispatch({ type: 'ready', token });
          },
          () => dispatch({ type: 'failed', token }),
        );
        break;
      }
      case 'start': {
        const data = prepared?.token === effect.token ? prepared.data : null;
        prepared = null;
        if (!data || map.isMoving() || document.visibilityState === 'hidden') {
          // Not a good moment: show the year at once.
          machine = { kind: 'idle' };
          host.showYear(effect.to);
          host.settled();
          return;
        }
        try {
          run = new Run(effect.token, effect.from, effect.to, data);
        } catch {
          machine = { kind: 'idle' };
          host.showYear(effect.to);
          host.settled();
        }
        break;
      }
    }
  };

  const onCancel = () => dispatch({ type: 'cancel' });
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') onCancel();
  };
  // A lost context takes every GL object with it: rebuild from scratch.
  const onContextLost = () => {
    onCancel();
    renderer = null;
    gpu.clear();
  };
  map.on('movestart', onCancel);
  map.on('resize', onCancel);
  map.on('webglcontextlost', onContextLost);
  document.addEventListener('visibilitychange', onVisibility);

  class Run {
    private fader: Fader;
    private start: number | null = null;
    private fadeOutAt: number | null = null;
    private shown = false;
    private shownAt = 0;
    private drawnAt = 0;
    private ended = false;
    private failed = false;
    private layer: CustomLayerInterface;
    private fromKeys: Uint16Array;
    private toKeys: Uint16Array;
    private keyCount: number;
    private seeds: Array<{ key: number; x: number; y: number }>;
    private palette: Uint8Array;
    private lineHalf = 0;
    private bandR = 0;
    private lineCover = 1;
    private casingR = 0;
    /** Both years' triangles, uploaded on the first frame. */
    private geometries: YearGeometry[];

    constructor(
      private token: number,
      private from: number,
      private to: number,
      data: Prepared,
    ) {
      const keys = sharedKeys(
        data.fromIndex.territories.map((t) => t.NAME),
        data.toIndex.territories.map((t) => t.NAME),
      );
      // Feature ids beyond the index (never expected) get key 0: the
      // lookup textures cover every id the geometry uses.
      const pad = (k: Uint16Array, n: number) => {
        if (k.length >= n) return k;
        const out = new Uint16Array(n);
        out.set(k);
        return out;
      };
      this.fromKeys = pad(keys.from, data.from.props.length);
      this.toKeys = pad(keys.to, data.to.props.length);
      this.keyCount = keys.count;
      this.seeds = interiorSeeds(
        data.from.parts,
        data.to.parts,
        keys.from,
        keys.to,
      );
      // Colours and widths from the live style, at this zoom: throws on an
      // expression the evaluator does not know (the change then snaps).
      const paint = paintSource(map);
      const zoom = map.getZoom();
      const place = host.place();
      const old = buildPalette(
        paint,
        data.from.props,
        keys.from,
        keys.count,
        selectionState(data.fromIndex, place),
        zoom,
      );
      const next = buildPalette(
        paint,
        data.to.props,
        keys.to,
        keys.count,
        selectionState(data.toIndex, place),
        zoom,
      );
      this.palette = new Uint8Array(old.rows.length * 2);
      this.palette.set(old.rows);
      this.palette.set(next.rows, old.rows.length);
      const ratio = map.getPixelRatio();
      // Borders under 2 device px become a crisp hairline with partial ink.
      const half = (Math.max(old.lineWidth, next.lineWidth) * ratio) / 2;
      this.lineHalf = half;
      this.lineCover = Math.min(1, half * 2);
      const casing = (Math.max(old.casingWidth, next.casingWidth) * ratio) / 2;
      this.casingR = paint.casing && casing > Math.max(1, half) ? casing : 0;
      this.bandR = paint.band
        ? Math.max(old.bandWidth, next.bandWidth) * ratio
        : 0;

      this.fader = new Fader(map, fadesFor(map));
      this.layer = {
        id: OVERLAY_LAYER_ID,
        type: 'custom',
        renderingMode: '2d',
        prerender: (gl, args) => this.prerender(gl, args),
        render: () => this.render(),
      };
      this.geometries = [data.from, data.to];
      map.addLayer(this.layer, overlayBefore(map));
      container.dataset.borderTransition = 'running';
      this.fader.hide(TIMING.fadeIn);
      map.triggerRepaint();
    }

    private prerender(
      gl: WebGL2RenderingContext,
      args: CustomRenderMethodInput,
    ) {
      if (this.ended || this.failed || renderer?.ready) return;
      try {
        if (!(gl instanceof WebGL2RenderingContext))
          throw new Error('WebGL 2 required');
        if (this.keyCount > gl.getParameter(gl.MAX_TEXTURE_SIZE))
          throw new Error('too many territories');
        const r = ensureRenderer();
        const [from, to] = this.geometries.map((g) => {
          let entry = gpu.get(g.year);
          if (!entry) {
            entry = r.upload(g);
            gpu.set(g.year, entry);
          }
          return entry;
        });
        // GPU geometry for any other year is dropped.
        for (const [year, entry] of gpu)
          if (year !== this.from && year !== this.to) {
            r.free(entry);
            gpu.delete(year);
          }
        const bounds = map.getBounds();
        const field = fieldSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
        const started = performance.now();
        r.prepare({
          from,
          to,
          fromKeys: this.fromKeys,
          toKeys: this.toKeys,
          seeds: this.seeds,
          palette: this.palette,
          keyCount: this.keyCount,
          matrix: Float32Array.from(args.defaultProjectionData.mainMatrix),
          wraps: worldCopies(bounds.getWest(), bounds.getEast()),
          field,
          steps: jumpSteps(field.width, field.height),
          reach: 0.12 * Math.min(field.width, field.height),
        });
        performance.measure?.('border-transition:prepare', { start: started });
      } catch (error) {
        this.failed = true;
        if (import.meta.env.DEV) console.warn('Border animation off:', error);
      }
    }

    private render() {
      if (this.ended) return;
      if (this.failed || !renderer?.ready) {
        // Nothing to draw: finish as an instant change.
        queueMicrotask(() => {
          if (run === this) {
            machine = { kind: 'idle' };
            this.end(false);
          }
        });
        return;
      }
      const now = performance.now();
      this.start ??= now;
      const elapsed = now - this.start;
      let frame = frameAt(elapsed, this.fadeOutAt);
      if (frame.phase !== 'fade-in' && !this.shown) {
        // Under the now opaque overlay, the vector map takes the new year.
        this.shown = true;
        this.shownAt = now;
        host.showYear(this.to);
      }
      if (this.shown && !this.drawnAt) {
        const drawn =
          host.bordersYear() === this.to &&
          map.isSourceLoaded(SOURCE.borders) &&
          map.isSourceLoaded(SOURCE.labels);
        if (drawn) {
          this.drawnAt = now;
          // How long MapLibre took to draw the new year under the overlay.
          performance.measure?.('border-transition:vector-load', {
            start: this.shownAt,
            end: now,
          });
        }
      }
      if (frame.phase === 'hold') {
        if (
          this.drawnAt ||
          elapsed > TIMING.fadeIn + TIMING.grow + TIMING.settleTimeout
        ) {
          this.fadeOutAt = elapsed;
          this.fader.restore(TIMING.fadeOut);
          frame = frameAt(elapsed, this.fadeOutAt);
        }
      }
      if (frame.phase === 'done') {
        queueMicrotask(() => {
          if (run === this) this.end(true);
        });
        return;
      }
      renderer.draw({
        progress: frame.progress,
        mix: frame.progress,
        alpha: frame.alpha,
        lineHalf: this.lineHalf,
        lineCover: this.lineCover,
        casingR: this.casingR,
        bandR: this.bandR,
      });
      map.triggerRepaint();
    }

    reassert() {
      if (!this.ended && this.fadeOutAt === null) this.fader.hide(0);
    }

    /** Removes the overlay; `finished` is false for a snap. */
    end(finished: boolean) {
      if (this.ended) return;
      this.ended = true;
      if (!this.shown) {
        this.shown = true;
        host.showYear(this.to);
      }
      if (!finished) this.fader.restore(0);
      this.fader.clearTransitions();
      if (map.getLayer(OVERLAY_LAYER_ID)) map.removeLayer(OVERLAY_LAYER_ID);
      renderer?.release();
      // Keep only the new year's triangles: it is the next change's start.
      for (const [year, entry] of gpu)
        if (year !== this.to) {
          renderer?.free(entry);
          gpu.delete(year);
        }
      delete container.dataset.borderTransition;
      if (run === this) run = null;
      if (finished) dispatch({ type: 'done', token: this.token });
      host.settled();
      map.triggerRepaint();
    }
  }

  return {
    request(from, to) {
      dispatch({ type: 'request', from, to });
    },
    snap() {
      // A change still preparing reads the style when it starts: keep it.
      if (machine.kind === 'running') dispatch({ type: 'cancel' });
    },
    abort() {
      if (machine.kind === 'running') dispatch({ type: 'cancel' });
      // A preparing change is dropped: its 'ready' no longer matches.
      machine = { kind: 'idle' };
    },
    get running() {
      return run !== null;
    },
    get busy() {
      return machine.kind !== 'idle';
    },
    reassert() {
      run?.reassert();
    },
    destroy() {
      destroyed = true;
      map.off('movestart', onCancel);
      map.off('resize', onCancel);
      map.off('webglcontextlost', onContextLost);
      document.removeEventListener('visibilitychange', onVisibility);
      geometry.destroy();
      prepared = null;
      run = null;
      // The map (and its GL context) is being removed with everything on it.
    },
  };
}
