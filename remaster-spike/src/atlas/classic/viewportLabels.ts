/**
 * Viewport-aware state names.
 *
 * T1 publishes one label point per territory part (its pole of
 * inaccessibility), so a very large territory has no name whenever that
 * point is off screen. In 1914 Europe the Russian Empire's point lies at
 * 67° E, past the right edge of a classroom view of Europe, and a phone
 * showed no Russia at all.
 *
 * After each move, territories whose own label points are off screen, too
 * close to an edge, or under the map key get one extra anchor: the point of
 * their *visible* area farthest from its edges, found on a coarse raster of
 * the rendered map. Their own points are hidden meanwhile
 * (`ClassicStyleOptions.relocatedLabels`), so a name is never drawn twice.
 *
 * Why not more label points at build time: a static anchor grid repeats a
 * name across a large territory at overview zooms (MapLibre has no
 * per-name de-duplication for points) and still misses views whose visible
 * part falls between anchors. One anchor per territory per view, from what
 * is actually on screen, has neither problem and needs no data change.
 *
 * Cost: nothing while the map moves. Once per settled move, and only when
 * a territory overlapping the view needs an anchor: one filtered
 * `queryRenderedFeatures` for those territories, the 110m land (already
 * loaded for the locator globe) as the water mask, and a raster of about
 * 240×120 cells. The app runs it in an idle callback.
 */
import type { Map as MLMap } from 'maplibre-gl';
import { LAYER } from './contract';
import { labelMinKm2 } from './expressions';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A territory's state name and label points, from the year's labels file. */
export interface LabelTerritory {
  id: number;
  name: string;
  /** Largest part's area in km² (the labels source's `a`). */
  areaKm2: number;
  /** Every label point of the territory, [lng, lat]. */
  points: readonly [number, number][];
}

export interface AnchorFeature {
  type: 'Feature';
  id: number;
  properties: { n: string; a: number };
  geometry: { type: 'Point'; coordinates: [number, number] };
}

export interface AnchorCollection {
  type: 'FeatureCollection';
  features: AnchorFeature[];
  /**
   * Territories whose every label point is under an HTML panel and whose
   * visible part is too small for an anchor. Their names are hidden rather
   * than drawn half under the panel.
   */
  hidden?: number[];
}

/** Every territory id whose own label points are hidden. */
export const relocatedIds = (a: AnchorCollection | null | undefined) => [
  ...(a?.features.map((f) => f.id) ?? []),
  ...(a?.hidden ?? []),
];

export const VIEWPORT_LABEL = {
  /** Raster cell size in CSS px. */
  cellPx: 6,
  /** A label point closer than this to a side edge (px) would be clipped. */
  edgeMarginX: 56,
  /** … or to the top or bottom edge. */
  edgeMarginY: 18,
  /** Margin kept around an obstacle (the map key, the panel). */
  obstacleMargin: 12,
  /** A territory needs this share of the uncovered map to get an anchor. */
  minShare: 0.025,
  /** The anchor must be at least this far (px) inside the visible part. */
  /**
   * Off-screen or clipped names get an anchor only for territories this large
   * (km²): a reasonable part of a big empire is worth naming, a sliver of a
   * small one is not. Names under a panel qualify at any labelled size.
   */
  edgeMinKm2: 100_000,
  minDepthPx: 15,
  /** A name near a panel moves to a visible region of at least this many cells. */
  panelMinCells: 40,
  /** A previous anchor stays while it keeps this share of the best depth (no jitter). */
  keepShare: 0.75,
} as const;

const inside = (x: number, y: number, r: Rect) =>
  x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

const grow = (r: Rect, m: number): Rect => ({
  left: r.left - m,
  top: r.top - m,
  right: r.right + m,
  bottom: r.bottom + m,
});

export type Placement = 'comfortable' | 'edge' | 'beside' | 'under';

/**
 * Where a label point (in CSS px) falls: far enough inside the map and
 * clear of every obstacle for its name to be read ('comfortable'), off
 * screen or so close to an edge that it is clipped ('edge'), close enough
 * to an obstacle that its name may run under it ('beside'), or under it
 * ('under').
 */
export function placementOf(
  x: number,
  y: number,
  size: { width: number; height: number },
  obstacles: readonly Rect[] = [],
  c: Pick<
    typeof VIEWPORT_LABEL,
    'edgeMarginX' | 'edgeMarginY' | 'obstacleMargin'
  > = VIEWPORT_LABEL,
): Placement {
  if (!isComfortable(x, y, size, [], c)) return 'edge';
  if (obstacles.some((o) => inside(x, y, grow(o, c.obstacleMargin))))
    return 'under';
  return isComfortable(x, y, size, obstacles, c) ? 'comfortable' : 'beside';
}

/**
 * True when a label point (in CSS px) is far enough inside the map and
 * clear of every obstacle for its name to be read there.
 */
export function isComfortable(
  x: number,
  y: number,
  size: { width: number; height: number },
  obstacles: readonly Rect[] = [],
  c: Pick<
    typeof VIEWPORT_LABEL,
    'edgeMarginX' | 'edgeMarginY' | 'obstacleMargin'
  > = VIEWPORT_LABEL,
): boolean {
  const safe: Rect = {
    left: c.edgeMarginX,
    top: c.edgeMarginY,
    right: size.width - c.edgeMarginX,
    bottom: size.height - c.edgeMarginY,
  };
  if (!inside(x, y, safe)) return false;
  // A name runs sideways from its point: keep the side margin around obstacles too.
  return !obstacles.some((o) =>
    inside(x, y, {
      left: o.left - c.obstacleMargin - c.edgeMarginX,
      right: o.right + c.obstacleMargin + c.edgeMarginX,
      top: o.top - c.obstacleMargin - c.edgeMarginY,
      bottom: o.bottom + c.obstacleMargin + c.edgeMarginY,
    }),
  );
}

/**
 * Chamfer distance (in cells) from each cell to the nearest edge of its
 * region: a cell whose 4-neighbour holds another value, or the grid border.
 * Cells holding -1 (no candidate) are 0.
 */
export function edgeDistance(
  grid: Int32Array,
  w: number,
  h: number,
): Float32Array {
  const d = new Float32Array(w * h);
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = grid[i];
      const edge =
        v < 0 ||
        x === 0 ||
        y === 0 ||
        x === w - 1 ||
        y === h - 1 ||
        grid[i - 1] !== v ||
        grid[i + 1] !== v ||
        grid[i - w] !== v ||
        grid[i + w] !== v;
      d[i] = edge ? 0 : Infinity;
    }
  }
  for (let y = 1; y < h; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        d[i - 1] + 1,
        d[i - w] + 1,
        d[i - w - 1] + D,
        d[i - w + 1] + D,
      );
    }
  }
  for (let y = h - 2; y >= 0; y--) {
    for (let x = w - 2; x >= 1; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      d[i] = Math.min(
        d[i],
        d[i + 1] + 1,
        d[i + w] + 1,
        d[i + w + 1] + D,
        d[i + w - 1] + D,
      );
    }
  }
  return d;
}

export interface GridAnchor {
  /** Cell column and row. */
  cx: number;
  cy: number;
  /** Distance to the visible region's edge, in cells. */
  depth: number;
  /** Visible cells of the territory. */
  cells: number;
}

/**
 * For every territory id in the grid that covers at least `minCells` cells,
 * the cell deepest inside its visible area (if at least `minDepth` deep).
 * A previous anchor is kept while it is still inside the territory and at
 * least `keepShare` of the best depth, so names do not hop on small moves.
 */
export function pickAnchors(
  grid: Int32Array,
  w: number,
  h: number,
  opts: {
    minCells: number;
    minDepth: number;
    keepShare?: number;
    previous?: ReadonlyMap<number, { cx: number; cy: number }>;
  },
): Map<number, GridAnchor> {
  const depth = edgeDistance(grid, w, h);
  const best = new Map<number, GridAnchor>();
  for (let i = 0; i < grid.length; i++) {
    const id = grid[i];
    if (id < 0) continue;
    const current = best.get(id);
    if (!current) {
      best.set(id, { cx: i % w, cy: (i / w) | 0, depth: depth[i], cells: 1 });
      continue;
    }
    current.cells++;
    if (depth[i] > current.depth) {
      current.depth = depth[i];
      current.cx = i % w;
      current.cy = (i / w) | 0;
    }
  }
  const keep = opts.keepShare ?? VIEWPORT_LABEL.keepShare;
  for (const [id, anchor] of best) {
    if (anchor.cells < opts.minCells || anchor.depth < opts.minDepth) {
      best.delete(id);
      continue;
    }
    const prev = opts.previous?.get(id);
    if (!prev || prev.cx < 0 || prev.cy < 0 || prev.cx >= w || prev.cy >= h)
      continue;
    const j = prev.cy * w + prev.cx;
    if (grid[j] === id && depth[j] >= keep * anchor.depth) {
      anchor.cx = prev.cx;
      anchor.cy = prev.cy;
      anchor.depth = depth[j];
    }
  }
  return best;
}

/** Packs a territory id into an opaque colour; blue 255 marks a territory. */
export const idColor = (id: number) =>
  `rgb(${id & 255}, ${(id >> 8) & 255}, 255)`;

/**
 * Turns RGBA pixels back into ids: -1 for water, obstacles, empty land and
 * anti-aliased edge pixels (any pixel whose 4-neighbours disagree).
 */
export function decodeIds(rgba: Uint8ClampedArray, w: number, h: number) {
  const raw = new Int32Array(w * h);
  for (let i = 0; i < raw.length; i++) {
    const o = i * 4;
    raw[i] =
      rgba[o + 3] === 255 && rgba[o + 2] === 255
        ? rgba[o] + rgba[o + 1] * 256
        : -1;
  }
  const out = new Int32Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = raw[i];
      if (v < 0) continue;
      if (x > 0 && raw[i - 1] !== v) continue;
      if (x < w - 1 && raw[i + 1] !== v) continue;
      if (y > 0 && raw[i - w] !== v) continue;
      if (y < h - 1 && raw[i + w] !== v) continue;
      out[i] = v;
    }
  }
  return out;
}

/* ---- Runtime ------------------------------------------------------------------ */

type Ring = number[][];

const mercX = (lng: number) => (lng + 180) / 360;
const mercY = (lat: number) => {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};

/** Polygons of a GeoJSON geometry as lists of rings. */
const polygonsOf = (g: { type: string; coordinates?: unknown }): Ring[][] =>
  g.type === 'Polygon'
    ? [g.coordinates as Ring[]]
    : g.type === 'MultiPolygon'
      ? (g.coordinates as Ring[][])
      : [];

/** Every polygon (outer ring and holes) of a GeoJSON FeatureCollection. */
export function landPolygons(fc: {
  features: { geometry: { type: string; coordinates?: unknown } | null }[];
}): Ring[][] {
  return fc.features.flatMap((f) => (f.geometry ? polygonsOf(f.geometry) : []));
}

/**
 * True when two [w, s, e, n] boxes overlap, in any world copy. A box that
 * crosses the antimeridian may give east < west (T1's index does, e.g. the
 * Russian Empire is [17.89, 35.25, -169.83, 77.6]) or east > 180.
 */
export function bboxesIntersect(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
): boolean {
  if (a[1] > b[3] || a[3] < b[1]) return false;
  const span = ([w, , e]: readonly number[]): [number, number] => [
    w,
    e < w ? e + 360 : e,
  ];
  const [aw, ae] = span(a);
  const [bw, be] = span(b);
  return [-720, -360, 0, 360, 720].some((k) => aw + k <= be && ae + k >= bw);
}

export interface ViewportLabelInput {
  /** The year's territories with a state name, by id. */
  territories: ReadonlyMap<number, LabelTerritory>;
  /** A territory's [w, s, e, n] (T1 index); territories outside the view are skipped cheaply. */
  bboxOf?: (
    id: number,
  ) => readonly [number, number, number, number] | undefined;
  /**
   * Land polygons (Natural Earth 110m, `landPolygons`) used as the water
   * mask. Without them the rendered ocean mask is queried, which costs more.
   */
  land?: readonly Ring[][] | null;
  /** HTML panels over the map, in px relative to the map canvas. */
  obstacles?: readonly Rect[];
  /** The selected territory always qualifies, whatever its area. */
  selectedId?: number | null;
  /** The last result, to keep anchors steady. */
  previous?: AnchorCollection | null;
}

/**
 * Computes this view's anchors. Returns an empty collection when every
 * territory that should be named has a label point comfortably on screen.
 */
export function viewportAnchors(
  map: MLMap,
  input: ViewportLabelInput,
  c = VIEWPORT_LABEL,
): AnchorCollection {
  const empty: AnchorCollection = { type: 'FeatureCollection', features: [] };
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height || !map.getLayer(LAYER.territoryFill)) return empty;
  const obstacles = input.obstacles ?? [];
  const size = { width, height };
  const minKm2 = labelMinKm2(map.getZoom());
  const b = map.getBounds();
  const view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] as const;

  // 1. Who needs an anchor: named at this zoom, no label point comfortably
  // visible. `nearPanel` notes those with a point under or beside a panel.
  const candidates = new Set<number>();
  const nearPanel = new Set<number>();
  for (const t of input.territories.values()) {
    if (t.areaKm2 <= minKm2 && t.id !== input.selectedId) continue;
    const bbox = input.bboxOf?.(t.id);
    if (bbox && !bboxesIntersect(bbox, view)) continue;
    const places = t.points.map(([lng, lat]) => {
      const p = map.project([lng, lat]);
      return placementOf(p.x, p.y, size, obstacles, c);
    });
    if (places.includes('comfortable')) continue;
    const near = places.includes('under') || places.includes('beside');
    if (!near && t.areaKm2 < c.edgeMinKm2 && t.id !== input.selectedId)
      continue;
    candidates.add(t.id);
    if (near) nearPanel.add(t.id);
  }
  if (!candidates.size) return empty;

  // 2. Rasterise the candidates' rendered polygons, then water and obstacles over them.
  const w = Math.ceil(width / c.cellPx);
  const h = Math.ceil(height / c.cellPx);
  const ctx = context2d(w, h);
  if (!ctx) return empty;
  ctx.clearRect(0, 0, w, h);
  ctx.setTransform(1 / c.cellPx, 0, 0, 1 / c.cellPx, 0, 0);

  const center = map.getCenter();
  const origin = map.project(center);
  const worldPx = 512 * 2 ** map.getZoom();
  const cx0 = mercX(center.lng);
  const cy0 = mercY(center.lat);
  const trace = (rings: Ring[]) => {
    for (const ring of rings) {
      if (ring.length < 3) continue;
      // Draw each ring in the world copy nearest the view centre.
      const shift = Math.round((center.lng - ring[0][0]) / 360) * 360;
      ring.forEach(([lng, lat], i) => {
        const x = origin.x + (mercX(lng + shift) - cx0) * worldPx;
        const y = origin.y + (mercY(lat) - cy0) * worldPx;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  };
  const box: [[number, number], [number, number]] = [
    [0, 0],
    [width, height],
  ];
  // Only the candidates' features: converting every rendered polygon to
  // GeoJSON is the expensive part of a query.
  for (const f of map.queryRenderedFeatures(box, {
    layers: [LAYER.territoryFill],
    filter: ['in', ['id'], ['literal', [...candidates]]],
  })) {
    if (typeof f.id !== 'number' || !candidates.has(f.id)) continue;
    ctx.fillStyle = idColor(f.id);
    for (const polygon of polygonsOf(f.geometry)) {
      ctx.beginPath();
      trace(polygon);
      ctx.fill('evenodd');
    }
  }
  ctx.fillStyle = '#000';
  if (input.land?.length) {
    // Keep candidate pixels only on land: one path, so one composite.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    for (const polygon of input.land) trace(polygon);
    ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'source-over';
  } else if (map.getLayer(LAYER.ocean)) {
    for (const f of map.queryRenderedFeatures(box, { layers: [LAYER.ocean] }))
      for (const polygon of polygonsOf(f.geometry)) {
        ctx.beginPath();
        trace(polygon);
        ctx.fill('evenodd');
      }
  }
  for (const o of obstacles) {
    const r = grow(o, c.obstacleMargin);
    ctx.fillRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
  }
  const grid = decodeIds(ctx.getImageData(0, 0, w, h).data, w, h);

  // 3. The deepest visible cell of each candidate.
  let uncovered = w * h;
  for (const o of obstacles) {
    const r = grow(o, c.obstacleMargin);
    const cw = Math.max(0, Math.min(width, r.right) - Math.max(0, r.left));
    const ch = Math.max(0, Math.min(height, r.bottom) - Math.max(0, r.top));
    uncovered -= (cw * ch) / (c.cellPx * c.cellPx);
  }
  const previous = new Map<number, { cx: number; cy: number }>();
  for (const f of input.previous?.features ?? []) {
    const p = map.project(f.geometry.coordinates);
    previous.set(f.id, {
      cx: Math.floor(p.x / c.cellPx),
      cy: Math.floor(p.y / c.cellPx),
    });
  }
  const anchors = pickAnchors(grid, w, h, {
    minCells: c.panelMinCells,
    minDepth: c.minDepthPx / c.cellPx,
    keepShare: c.keepShare,
    previous,
  });
  // Off-screen names need a reasonable share of the map; a name pushed out
  // by a panel only needs room for itself.
  const edgeMinCells = Math.max(c.panelMinCells, uncovered * c.minShare);
  for (const [id, a] of anchors)
    if (!nearPanel.has(id) && a.cells < edgeMinCells) anchors.delete(id);

  // A name under or beside a panel with nowhere to go is hidden rather
  // than drawn half under the panel.
  const hidden = [...nearPanel].filter(
    (id) => !anchors.has(id) && id !== input.selectedId,
  );
  if (hidden.length) empty.hidden = hidden;
  for (const [id, a] of anchors) {
    const t = input.territories.get(id);
    if (!t) continue;
    const ll = map.unproject([
      (a.cx + 0.5) * c.cellPx,
      (a.cy + 0.5) * c.cellPx,
    ]);
    empty.features.push({
      type: 'Feature',
      id,
      properties: { n: t.name, a: t.areaKm2 },
      geometry: {
        type: 'Point',
        coordinates: [round5(ll.lng), round5(ll.lat)],
      },
    });
  }
  return empty;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

let shared:
  CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
function context2d(w: number, h: number) {
  if (!shared) {
    const canvas: HTMLCanvasElement | OffscreenCanvas =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : document.createElement('canvas');
    shared = canvas.getContext('2d', { willReadFrequently: true }) as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  }
  if (shared && (shared.canvas.width !== w || shared.canvas.height !== h)) {
    shared.canvas.width = w;
    shared.canvas.height = h;
  }
  return shared;
}

/**
 * Builds the territory list from a parsed labels file (T1): features with a
 * name `n`, an area `a` and the territory id as feature id.
 */
export function labelTerritories(labels: {
  features: {
    id?: number | string;
    properties?: Record<string, unknown> | null;
    geometry?: { type: string; coordinates: unknown } | null;
  }[];
}): Map<number, LabelTerritory> {
  const out = new Map<number, LabelTerritory>();
  for (const f of labels.features) {
    const name = f.properties?.n;
    if (
      typeof f.id !== 'number' ||
      typeof name !== 'string' ||
      f.geometry?.type !== 'Point'
    )
      continue;
    const point = f.geometry.coordinates as [number, number];
    const area = Number(f.properties?.a) || 0;
    const t = out.get(f.id);
    if (t) {
      (t.points as [number, number][]).push(point);
      t.areaKm2 = Math.max(t.areaKm2, area);
    } else out.set(f.id, { id: f.id, name, areaKm2: area, points: [point] });
  }
  return out;
}
