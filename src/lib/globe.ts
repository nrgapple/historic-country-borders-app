/**
 * The map key's locator globe (plan §2.1, from Direction B): Natural Earth
 * 1:110m land in an orthographic projection centred on the view, with the
 * view's extent outlined in the era accent. Drawn on a canvas, only when
 * asked (the key calls it on `moveend`, never per frame).
 */

export type LngLat = [number, number];
export type Ring = LngLat[];

export interface GlobeView {
  center: LngLat;
  /** The visible extent: [west, south, east, north]; east may exceed 180. */
  bounds: [number, number, number, number];
}

export interface GlobeColors {
  water: string;
  land: string;
  coast: string;
  ink: string;
  accent: string;
}

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The globe tilts toward the view, but never so far that a pole fills it. */
export const MAX_TILT = 60;

/**
 * Orthographic projection onto a disc of radius `r` centred at (c, c).
 * Returns [x, y, visible]; `visible` is false on the far hemisphere.
 */
export function orthographic(center: LngLat, c: number, r: number) {
  const lon0 = rad(center[0]);
  const lat0 = rad(Math.max(-MAX_TILT, Math.min(MAX_TILT, center[1])));
  const sin0 = Math.sin(lat0);
  const cos0 = Math.cos(lat0);
  return ([lng, lat]: LngLat): [number, number, boolean] => {
    const l = rad(lng) - lon0;
    const p = rad(lat);
    const cosc = sin0 * Math.sin(p) + cos0 * Math.cos(p) * Math.cos(l);
    return [
      c + r * Math.cos(p) * Math.sin(l),
      c - r * (cos0 * Math.sin(p) - sin0 * Math.cos(p) * Math.cos(l)),
      cosc >= 0,
    ];
  };
}

/** The view's outline as a ring traced along its edges (10 steps a side). */
export function viewOutline([w, s, e, n]: GlobeView['bounds']): Ring {
  const north = Math.min(85, n);
  const south = Math.max(-85, s);
  const span = Math.min(360, e - w);
  const east = w + span;
  const out: Ring = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) out.push([w + (i / steps) * span, north]);
  for (let i = 1; i <= steps; i++)
    out.push([east, north - (i / steps) * (north - south)]);
  for (let i = 1; i <= steps; i++) out.push([east - (i / steps) * span, south]);
  for (let i = 1; i < steps; i++)
    out.push([w, south + (i / steps) * (north - south)]);
  return out;
}

/** Outer rings of every polygon in a GeoJSON FeatureCollection. */
export function landRings(geojson: {
  features: { geometry: { type: string; coordinates: unknown } | null }[];
}): Ring[] {
  const rings: Ring[] = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') rings.push((g.coordinates as Ring[])[0]);
    else if (g.type === 'MultiPolygon')
      for (const p of g.coordinates as Ring[][]) rings.push(p[0]);
  }
  return rings;
}

/**
 * Draws the globe into a square canvas whose backing size is `canvas.width`
 * (set it to the CSS size × devicePixelRatio).
 */
export function drawGlobe(
  canvas: HTMLCanvasElement,
  land: readonly Ring[],
  view: GlobeView,
  colors: GlobeColors,
) {
  const g = canvas.getContext('2d');
  if (!g) return;
  const size = canvas.width;
  const scale = size / 64;
  const c = size / 2;
  const r = c - 2 * scale;
  const proj = orthographic(view.center, c, r);
  const limb = (x: number, y: number): [number, number] => {
    const d = Math.hypot(x - c, y - c) || 1;
    return [c + ((x - c) / d) * r, c + ((y - c) / d) * r];
  };

  g.clearRect(0, 0, size, size);
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fillStyle = colors.water;
  g.fill();

  g.save();
  g.clip();
  g.fillStyle = colors.land;
  g.strokeStyle = colors.coast;
  g.lineWidth = 0.6 * scale;
  g.lineJoin = 'round';
  for (const ring of land) {
    let visible = false;
    g.beginPath();
    ring.forEach((pt, i) => {
      const [x, y, v] = proj(pt);
      if (v) visible = true;
      // Points on the far side are pushed to the limb so the ring stays closed.
      const [px, py] = v ? [x, y] : limb(x, y);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    if (!visible) continue;
    g.closePath();
    g.fill();
    g.stroke();
  }

  // The current view, outlined in the era accent over a light wash.
  const outline = viewOutline(view.bounds);
  g.beginPath();
  outline.forEach((pt, i) => {
    const [x, y, v] = proj(pt);
    const [px, py] = v ? [x, y] : limb(x, y);
    if (i) g.lineTo(px, py);
    else g.moveTo(px, py);
  });
  g.closePath();
  g.globalAlpha = 0.2;
  g.fillStyle = colors.accent;
  g.fill();
  g.globalAlpha = 1;
  g.lineWidth = 1.6 * scale;
  g.strokeStyle = colors.accent;
  g.stroke();
  g.restore();

  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.lineWidth = 1.2 * scale;
  g.strokeStyle = colors.ink;
  g.stroke();
}
