/**
 * The map key's scale bar (plan §2.1, §9.2 P3).
 *
 * Acceptance: the bar is within ±2% of the haversine distance at the view's
 * centre latitude, at z2–8. Web Mercator stretches distances by 1/cos(lat),
 * and at z2 a bar spans tens of degrees of longitude, where the chord along
 * a parallel and the great-circle distance part ways. So the bar is solved
 * from the haversine itself: for a round distance D, find the longitude span
 * whose great-circle length at the centre latitude is D, and convert that
 * span to screen pixels with MapLibre's 512-px world.
 */

/** Mean Earth radius (IUGG), km. */
export const EARTH_RADIUS_KM = 6371.0088;
/** MapLibre's world is 512 px wide at zoom 0. */
export const WORLD_PX = 512;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km between two [lng, lat] points. */
export function haversineKm(a: [number, number], b: [number, number]) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Screen pixels per degree of longitude at `zoom`. */
export const pxPerDegree = (zoom: number) => (WORLD_PX * 2 ** zoom) / 360;

/**
 * Pixel length of a horizontal bar, centred on latitude `lat`, whose ends
 * are `km` apart along a great circle; null if no span at that latitude is
 * that long (near the poles).
 */
export function barPx(km: number, lat: number, zoom: number): number | null {
  const s = Math.sin(km / (2 * EARTH_RADIUS_KM)) / Math.cos(rad(lat));
  if (!(s > 0 && s <= 1) || km / EARTH_RADIUS_KM >= Math.PI) return null;
  const dLngDeg = (2 * Math.asin(s) * 180) / Math.PI;
  return dLngDeg * pxPerDegree(zoom);
}

/** Round distances, km: 1, 2, 5 × 10ⁿ, with 250 and 2,500 for even halves. */
export const NICE_KM = [
  1, 2, 5, 10, 20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000,
] as const;

export interface ScaleBar {
  /** The distance the whole bar represents, km. */
  km: number;
  /** Bar length in CSS px. */
  px: number;
  /** Centre latitude the bar is true at, rounded to whole degrees. */
  lat: number;
}

/**
 * The longest round distance whose bar fits in `maxPx` (and is at least
 * `minPx` when possible) at the view's centre latitude and zoom.
 */
export function scaleBar(
  lat: number,
  zoom: number,
  maxPx: number,
  minPx = 0,
): ScaleBar {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  let best: ScaleBar | null = null;
  for (const km of NICE_KM) {
    const px = barPx(km, clampedLat, zoom);
    if (px === null || px > maxPx) break;
    best = { km, px, lat: Math.round(clampedLat) };
  }
  if (best && best.px >= minPx) return best;
  // Zoomed far out: the smallest round distance, even if longer than wanted.
  const km = best?.km ?? NICE_KM[0];
  return {
    km,
    px: barPx(km, clampedLat, zoom) ?? maxPx,
    lat: Math.round(clampedLat),
  };
}

/** "47° N", "12° S", "0°". */
export const formatLatitude = (lat: number) =>
  lat === 0 ? '0°' : `${Math.abs(lat)}° ${lat > 0 ? 'N' : 'S'}`;

export const formatKm = (km: number) => km.toLocaleString('en-US');
