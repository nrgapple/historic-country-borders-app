/**
 * A year's territory polygons as triangles in Web Mercator (0–1, MapLibre's
 * world square), for the border-change animation's id raster. Runs in a
 * worker (`geometry.worker.ts`); pure, so it is unit tested in Node.
 */
import earcut from 'earcut';
import type { Part } from './plan';

/** Paint-relevant feature properties (T1: `c`, `dep`, `ov`, `oc`). */
export type FeatureProps = Record<string, number>;

export interface YearGeometry {
  year: number;
  /** x, y per vertex in Web Mercator. */
  positions: Float32Array;
  /** Territory id (the feature id) per vertex. */
  ids: Uint16Array;
  /** Triangle indices into `positions`. */
  indices: Uint32Array;
  /** Properties by territory id. */
  props: FeatureProps[];
  /** Every polygon part with its bbox and a point deep inside it. */
  parts: Part[];
}

const MAX_LAT = 85.051129;

export const mercatorX = (lng: number) => (lng + 180) / 360;
export const mercatorY = (lat: number) => {
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  return (
    (180 -
      (180 / Math.PI) *
        Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360))) /
    360
  );
};

type Ring = number[][];
type Polygon = Ring[];

const polygonsOf = (geometry: {
  type: string;
  coordinates: unknown;
}): Polygon[] => {
  if (geometry?.type === 'Polygon') return [geometry.coordinates as Polygon];
  if (geometry?.type === 'MultiPolygon')
    return geometry.coordinates as Polygon[];
  return [];
};

/** Even-odd test against every ring (holes included). */
function inside(x: number, y: number, rings: Float64Array[]): boolean {
  let hit = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i],
        yi = ring[i + 1],
        xj = ring[j],
        yj = ring[j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        hit = !hit;
    }
  return hit;
}

function edgeDistance(x: number, y: number, rings: Float64Array[]): number {
  let best = Infinity;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const ax = ring[j],
        ay = ring[j + 1];
      const dx = ring[i] - ax,
        dy = ring[i + 1] - ay;
      const len = dx * dx + dy * dy;
      const t =
        len > 0
          ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len))
          : 0;
      const ex = ax + t * dx - x,
        ey = ay + t * dy - y;
      best = Math.min(best, ex * ex + ey * ey);
    }
  return Math.sqrt(best);
}

/**
 * An approximate pole of inaccessibility: the best of a coarse grid, then a
 * finer grid around it. Always inside the polygon when any sample is; a
 * sliver too thin for the grid falls back to its first vertex.
 */
export function deepPoint(
  rings: Float64Array[],
  bbox: [number, number, number, number],
): [number, number] {
  const [minX, minY, maxX, maxY] = bbox;
  let best: [number, number] = [rings[0][0], rings[0][1]];
  let bestD = -1;
  const search = (x0: number, y0: number, w: number, h: number, n: number) => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = x0 + ((i + 0.5) / n) * w;
        const y = y0 + ((j + 0.5) / n) * h;
        if (!inside(x, y, rings)) continue;
        const d = edgeDistance(x, y, rings);
        if (d > bestD) {
          bestD = d;
          best = [x, y];
        }
      }
  };
  const w = maxX - minX,
    h = maxY - minY;
  search(minX, minY, w, h, 10);
  if (bestD > 0) search(best[0] - w / 10, best[1] - h / 10, w / 5, h / 5, 6);
  return best;
}

/** Triangulates a year's GeoJSON polygons (T1's split `polygons` file). */
export function triangulate(
  year: number,
  collection: {
    features?: Array<{
      id?: unknown;
      properties?: Record<string, unknown> | null;
      geometry: { type: string; coordinates: unknown };
    }>;
  },
): YearGeometry {
  const features = Array.isArray(collection?.features)
    ? collection.features
    : [];
  let vertexCount = 0;
  for (const feature of features)
    for (const polygon of polygonsOf(feature.geometry))
      for (const ring of polygon) vertexCount += ring.length;

  const positions = new Float32Array(vertexCount * 2);
  const ids = new Uint16Array(vertexCount);
  const indices: number[] = [];
  const props: FeatureProps[] = [];
  const parts: Part[] = [];
  let base = 0;

  for (const feature of features) {
    const id = Number(feature.id);
    if (!Number.isInteger(id) || id < 0 || id > 65534) continue;
    const own: FeatureProps = {};
    for (const [k, v] of Object.entries(feature.properties ?? {}))
      if (typeof v === 'number') own[k] = v;
    props[id] = own;
    for (const polygon of polygonsOf(feature.geometry)) {
      const flat: number[] = [];
      const holes: number[] = [];
      const rings: Float64Array[] = [];
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      polygon.forEach((ring, r) => {
        if (r > 0) holes.push(flat.length / 2);
        const out = new Float64Array(ring.length * 2);
        ring.forEach(([lng, lat], i) => {
          const x = mercatorX(lng),
            y = mercatorY(lat);
          flat.push(x, y);
          out[i * 2] = x;
          out[i * 2 + 1] = y;
          if (r === 0) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        });
        rings.push(out);
      });
      const count = flat.length / 2;
      if (count < 3) {
        base += count;
        continue;
      }
      for (let i = 0; i < count; i++) {
        positions[(base + i) * 2] = flat[i * 2];
        positions[(base + i) * 2 + 1] = flat[i * 2 + 1];
        ids[base + i] = id;
      }
      const triangles = earcut(flat, holes.length ? holes : undefined, 2);
      for (const index of triangles) indices.push(base + index);
      const bbox: [number, number, number, number] = [minX, minY, maxX, maxY];
      parts.push({ id, bbox, seed: deepPoint(rings, bbox) });
      base += count;
    }
  }

  return {
    year,
    positions: positions.subarray(0, base * 2),
    ids: ids.subarray(0, base),
    indices: Uint32Array.from(indices),
    props,
    parts,
  };
}
