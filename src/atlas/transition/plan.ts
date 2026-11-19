/**
 * Border-change animation: the pure parts (no DOM, no WebGL), so they can be
 * unit tested and imported by the map controller without loading the
 * renderer. See `index.ts` for the lifecycle and `gl.ts` for the GPU passes.
 *
 * The animation answers "where did the borders end up?", not "in what order
 * did events happen": every changing pixel switches owner when a front from
 * its new owner's old land (or, for a new territory, from its own interior)
 * reaches it, and every changing region finishes at the same moment.
 */

/** Phase lengths in ms. The whole change reads in about 1.2 s. */
export const TIMING = {
  /** The overlay fades in over the vector borders while the labels fade out. */
  fadeIn: 160,
  /** The fronts move. */
  grow: 1000,
  /** The overlay fades out over the new year's vector layers; labels fade in. */
  fadeOut: 260,
  /** Longest wait for the new year's vector tiles after the fronts stop. */
  settleTimeout: 4000,
} as const;

/** Smooth start and stop for the fronts (cubic in-out). */
export const ease = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

export type SkipReason =
  | 'setting-off'
  | 'reduced-motion'
  | 'low-power'
  | 'no-webgl2'
  | 'projection'
  | 'hidden'
  | 'first-load'
  | 'same-year'
  | 'reload'
  | 'moving';

export interface SkipInput {
  /** Settings → "Animate border changes". */
  enabled: boolean;
  reducedMotion: boolean;
  /** T6's low-power decision (`?lowPower=1`, software GL, Save-Data…). */
  lowPower: boolean;
  /** The map's own context is WebGL 2 (integer render targets are core there). */
  webgl2: boolean;
  /** The map's projection; only Web Mercator is handled. */
  projection: string;
  /** `document.visibilityState === 'hidden'`: no frames would be drawn. */
  hidden: boolean;
  /** The year on screen has drawn at least once. */
  shown: boolean;
  from: number;
  to: number;
  /** "Try again" reloads the same year. */
  reload: boolean;
  /** The camera is moving (a fling or an ease). */
  moving: boolean;
}

/**
 * Why a year change is shown at once instead of animated, or null to
 * animate. Order matters only for the reported reason.
 */
export function skipReason(input: SkipInput): SkipReason | null {
  if (!input.enabled) return 'setting-off';
  if (input.reducedMotion) return 'reduced-motion';
  if (input.lowPower) return 'low-power';
  if (!input.webgl2) return 'no-webgl2';
  if (input.projection !== 'mercator') return 'projection';
  if (input.hidden) return 'hidden';
  if (input.reload) return 'reload';
  if (!input.shown) return 'first-load';
  if (input.from === input.to) return 'same-year';
  if (input.moving) return 'moving';
  return null;
}

/**
 * When a changing pixel switches owner, as a share of the growth (0–1).
 *
 * - `d1`: distance to the nearest pixel the new owner held in the old year
 *   (or a seed inside a brand-new territory); null when there is none.
 * - `d2`: distance to the nearest pixel that is the new owner's in neither
 *   year (the far side of the region: the land it is taken from); null when
 *   none is on screen.
 * - `reach`: fallback length in px for a region with only one side.
 *
 * `d1 / (d1 + d2)` is 0 where the region touches the old owner's land and 1
 * at its far edge, so every region, a sliver or half a continent, finishes
 * exactly when the growth does. The shader in gl.ts mirrors this function.
 */
export function switchTime(
  d1: number | null,
  d2: number | null,
  reach: number,
): number {
  if (d1 === null && d2 === null) return 0.5;
  // Nothing to grow from: swell from the region's middle outwards.
  if (d1 === null) return 1 - Math.min(1, d2! / reach);
  // Nothing on the far side: advance at a steady speed from the source.
  if (d2 === null) return d1 / (d1 + reach);
  const sum = d1 + d2;
  return sum <= 0 ? 0 : d1 / sum;
}

export interface Frame {
  phase: 'fade-in' | 'grow' | 'hold' | 'fade-out' | 'done';
  /** Overlay opacity. */
  alpha: number;
  /** Eased growth, 0–1. */
  progress: number;
}

/**
 * The overlay at `elapsed` ms after its first frame. `fadeOutAt` is when the
 * fade-out began (the new year's vector layers were ready), or null while
 * still waiting for them.
 */
export function frameAt(elapsed: number, fadeOutAt: number | null): Frame {
  if (elapsed < TIMING.fadeIn)
    return { phase: 'fade-in', alpha: elapsed / TIMING.fadeIn, progress: 0 };
  const grown = (elapsed - TIMING.fadeIn) / TIMING.grow;
  if (grown < 1) return { phase: 'grow', alpha: 1, progress: ease(grown) };
  if (fadeOutAt === null) return { phase: 'hold', alpha: 1, progress: 1 };
  const out = (elapsed - fadeOutAt) / TIMING.fadeOut;
  if (out >= 1) return { phase: 'done', alpha: 0, progress: 1 };
  return { phase: 'fade-out', alpha: 1 - Math.max(0, out), progress: 1 };
}

/* ---- Interrupted transitions ------------------------------------------- */

export type Machine =
  | { kind: 'idle' }
  /** Loading geometry for `from → to`; the map still shows `from`. */
  | { kind: 'preparing'; from: number; to: number; token: number }
  /** The overlay is on screen. */
  | { kind: 'running'; from: number; to: number; token: number };

export type MachineEvent =
  /** A year change; `from` is the year the borders source shows. */
  | { type: 'request'; from: number; to: number }
  | { type: 'ready'; token: number }
  | { type: 'failed'; token: number }
  /** Pan, zoom, resize, a style change: finish at once. */
  | { type: 'cancel' }
  | { type: 'done'; token: number };

export type Effect =
  /** Remove the overlay and show `year` as the vector map would. */
  | { type: 'snap'; year: number }
  /** Load geometry for both years. */
  | { type: 'prepare'; from: number; to: number; token: number }
  /** Put the overlay on screen. */
  | { type: 'start'; from: number; to: number; token: number }
  /** No animation: give the map the year's data now. */
  | { type: 'show'; year: number };

let tokens = 0;

/**
 * The transition state machine. A year change while the overlay runs snaps
 * it to its target and starts the next change from there; a change while
 * preparing just retargets. Only the latest request is ever kept, so fast
 * clicking never builds a backlog.
 */
export function reduce(
  state: Machine,
  event: MachineEvent,
): { state: Machine; effects: Effect[] } {
  switch (event.type) {
    case 'request': {
      const effects: Effect[] = [];
      let from = event.from;
      if (state.kind === 'running') {
        effects.push({ type: 'snap', year: state.to });
        from = state.to;
      } else if (state.kind === 'preparing') from = state.from;
      if (from === event.to) {
        effects.push({ type: 'show', year: event.to });
        return { state: { kind: 'idle' }, effects };
      }
      const token = ++tokens;
      effects.push({ type: 'prepare', from, to: event.to, token });
      return {
        state: { kind: 'preparing', from, to: event.to, token },
        effects,
      };
    }
    case 'ready':
      if (state.kind !== 'preparing' || state.token !== event.token)
        return { state, effects: [] };
      return {
        state: { ...state, kind: 'running' },
        effects: [
          { type: 'start', from: state.from, to: state.to, token: state.token },
        ],
      };
    case 'failed':
      if (state.kind !== 'preparing' || state.token !== event.token)
        return { state, effects: [] };
      return {
        state: { kind: 'idle' },
        effects: [{ type: 'show', year: state.to }],
      };
    case 'cancel':
      if (state.kind === 'running')
        return {
          state: { kind: 'idle' },
          effects: [{ type: 'snap', year: state.to }],
        };
      // While preparing, the map still shows `from`: let it finish loading.
      return { state, effects: [] };
    case 'done':
      if (state.kind !== 'running' || state.token !== event.token)
        return { state, effects: [] };
      return { state: { kind: 'idle' }, effects: [] };
  }
}

/* ---- Shared territory keys ---------------------------------------------- */

/**
 * Territory ids are per-year positions, so the two years are compared by
 * name: each name gets one key (1…n; 0 is "no territory"). This is the only
 * correspondence the animation needs; it never matches shapes.
 */
export function sharedKeys(
  fromNames: readonly string[],
  toNames: readonly string[],
): { from: Uint16Array; to: Uint16Array; count: number } {
  const keys = new Map<string, number>();
  const keyOf = (name: string) => {
    let key = keys.get(name);
    if (key === undefined) {
      key = keys.size + 1;
      keys.set(name, key);
    }
    return key;
  };
  const from = Uint16Array.from(fromNames, keyOf);
  const to = Uint16Array.from(toNames, keyOf);
  return { from, to, count: keys.size + 1 };
}

/** One polygon part: its territory id, Web Mercator bbox and deep point. */
export interface Part {
  id: number;
  bbox: [number, number, number, number];
  /** A point well inside the part (pole of inaccessibility, approximate). */
  seed: [number, number];
}

const overlaps = (a: Part['bbox'], b: Part['bbox']) =>
  a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/**
 * Parts of the new year that grow from their own interior: those of a
 * territory absent from the old year, and those far from any of its old
 * land (a new colony overseas). Every other part grows from the old land.
 */
export function interiorSeeds(
  fromParts: readonly Part[],
  toParts: readonly Part[],
  fromKeys: Uint16Array,
  toKeys: Uint16Array,
): Array<{ key: number; x: number; y: number }> {
  const oldByKey = new Map<number, Part['bbox'][]>();
  for (const part of fromParts) {
    const key = fromKeys[part.id];
    if (!key) continue;
    const list = oldByKey.get(key) ?? [];
    list.push(part.bbox);
    oldByKey.set(key, list);
  }
  const seeds: Array<{ key: number; x: number; y: number }> = [];
  for (const part of toParts) {
    const key = toKeys[part.id];
    if (!key) continue;
    const old = oldByKey.get(key);
    if (old?.some((bbox) => overlaps(bbox, part.bbox))) continue;
    seeds.push({ key, x: part.seed[0], y: part.seed[1] });
  }
  return seeds;
}

/** World copies (0 = the main one) that overlap the visible longitudes. */
export function worldCopies(west: number, east: number): number[] {
  const first = Math.max(-3, Math.floor((west + 180) / 360));
  const last = Math.min(3, Math.floor((east + 180) / 360));
  const out: number[] = [];
  for (let i = first; i <= last; i++) out.push(i);
  return out;
}

/**
 * The resolution of the distance field: the drawing buffer scaled down to at
 * most `maxPixels`, so a 3x phone does the same work as a 1x laptop.
 */
export function fieldSize(
  width: number,
  height: number,
  maxPixels = 520_000,
): { width: number; height: number; scale: number } {
  const scale = Math.max(1, Math.sqrt((width * height) / maxPixels));
  return {
    width: Math.max(1, Math.ceil(width / scale)),
    height: Math.max(1, Math.ceil(height / scale)),
    scale,
  };
}

/** Jump-flood step sizes: halving from the next power of two, then 1 again (JFA+1). */
export function jumpSteps(width: number, height: number): number[] {
  let step = 1;
  while (step < Math.max(width, height)) step *= 2;
  const steps: number[] = [];
  for (step /= 2; step >= 1; step /= 2) steps.push(step);
  steps.push(1);
  return steps;
}
