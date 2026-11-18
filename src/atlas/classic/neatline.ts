/**
 * Degree-ladder neatline: an SVG frame drawn from the live projection, with
 * segments alternating ink and paper every 5° and labels every 10°. Phones
 * get a single rule. Pure string building, so it is testable without a map.
 */
import type { Map as MLMap } from 'maplibre-gl';
import { COLOR } from './tokens';

export interface NeatlineInput {
  width: number;
  height: number;
  west: number;
  east: number;
  south: number;
  north: number;
  /** Screen x of a longitude along the top edge. */
  x: (lon: number) => number;
  /** Screen y of a latitude along the left edge. */
  y: (lat: number) => number;
  phone: boolean;
}

export const LADDER_PX = 5;
const STEP = 5;
const r1 = (v: number) => Math.round(v * 10) / 10;
const odd = (deg: number) => (((deg / STEP) % 2) + 2) % 2 === 1;
const fmt = (deg: number, pos: string, neg: string) =>
  `${Math.abs(deg)}°${deg < 0 ? neg : deg > 0 ? pos : ''}`;

export function neatlineSvg(n: NeatlineInput): string {
  const { width: w, height: h } = n;
  const frame = `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="none" stroke="${COLOR.ink}"/>`;
  if (n.phone) return frame;
  const L = LADDER_PX;
  const rect = (x: number, y: number, rw: number, rh: number, fill: string) =>
    `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(Math.max(0, rw))}" height="${r1(Math.max(0, rh))}" fill="${fill}"/>`;
  const label = (x: number, y: number, text: string, anchor = 'start') =>
    `<text x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" font-family="Alegreya, serif" font-size="13" font-weight="500" fill="${COLOR.ink}" paint-order="stroke" stroke="${COLOR.water}" stroke-width="3">${text}</text>`;
  // Ladders are built one screen beyond each edge, so a pan can translate them
  // (see attachNeatline) without exposing a gap before the next rebuild.
  const spanX = n.east - n.west;
  const spanY = n.north - n.south;
  let gx = '';
  for (
    let lon = Math.floor((n.west - spanX) / STEP) * STEP;
    lon <= n.east + spanX;
    lon += STEP
  ) {
    const a = n.x(lon);
    const b = n.x(lon + STEP);
    const fill = odd(lon) ? COLOR.ink : COLOR.sheet;
    gx +=
      rect(Math.min(a, b), 0, Math.abs(b - a), L, fill) +
      rect(Math.min(a, b), h - L, Math.abs(b - a), L, fill);
    if (lon % 10 === 0) gx += label(a, L + 14, fmt(lon, 'E', 'W'), 'middle');
  }
  let gy = '';
  for (
    let lat = Math.max(-85, Math.floor((n.south - spanY) / STEP) * STEP);
    lat <= Math.min(85, n.north + spanY);
    lat += STEP
  ) {
    const a = n.y(lat);
    const b = n.y(lat + STEP);
    const fill = odd(lat) ? COLOR.ink : COLOR.sheet;
    gy +=
      rect(0, Math.min(a, b), L, Math.abs(b - a), fill) +
      rect(w - L, Math.min(a, b), L, Math.abs(b - a), fill);
    if (lat % 10 === 0) gy += label(L + 4, a + 4, fmt(lat, 'N', 'S'));
  }
  // Labels stay clear of the corners: the clip keeps them 30 px inside.
  const clip = `<clipPath id="hb-nl-clip"><rect x="30" y="0" width="${Math.max(0, w - 60)}" height="${h}"/><rect x="0" y="30" width="${w}" height="${Math.max(0, h - 60)}"/></clipPath>`;
  return (
    `<defs>${clip}</defs><g clip-path="url(#hb-nl-clip)"><g data-axis="x">${gx}</g><g data-axis="y">${gy}</g></g>` +
    frame +
    `<rect x="${L}" y="${L}" width="${w - 2 * L}" height="${h - 2 * L}" fill="none" stroke="${COLOR.ink}" stroke-width=".6"/>`
  );
}

/**
 * Keeps an `<svg>` overlay in sync with the map. Profiling showed a full SVG
 * rebuild per frame cost 5-12 ms while panning, more than any map layer, so a
 * pan at constant zoom only translates the two ladder groups (Web Mercator
 * pans are pure translations). The ladder is rebuilt when the zoom changes,
 * on `moveend` and on resize.
 */
/** `simple()` is true on phones and in low-power mode: draw the single rule. */
export function attachNeatline(
  map: MLMap,
  svg: SVGSVGElement,
  simple: () => boolean,
): () => void {
  let queued = false;
  let built: {
    zoom: number;
    lng: number;
    lat: number;
    x: number;
    y: number;
  } | null = null;
  let gx: SVGGElement | null = null;
  let gy: SVGGElement | null = null;
  const rebuild = () => {
    const el = map.getContainer();
    const b = map.getBounds();
    const w = el.clientWidth;
    const h = el.clientHeight;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.innerHTML = neatlineSvg({
      width: w,
      height: h,
      west: b.getWest(),
      east: b.getEast(),
      south: b.getSouth(),
      north: b.getNorth(),
      x: (lon) => map.project([lon, b.getNorth()]).x,
      y: (lat) => map.project([b.getWest(), lat]).y,
      phone: simple(),
    });
    gx = svg.querySelector('g[data-axis="x"]');
    gy = svg.querySelector('g[data-axis="y"]');
    const c = map.getCenter();
    const p = map.project(c);
    built = { zoom: map.getZoom(), lng: c.lng, lat: c.lat, x: p.x, y: p.y };
  };
  const draw = () => {
    queued = false;
    if (!built || Math.abs(map.getZoom() - built.zoom) > 1e-6) return rebuild();
    const p = map.project([built.lng, built.lat]);
    const dx = Math.round((p.x - built.x) * 10) / 10;
    const dy = Math.round((p.y - built.y) * 10) / 10;
    gx?.setAttribute('transform', `translate(${dx} 0)`);
    gy?.setAttribute('transform', `translate(0 ${dy})`);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  };
  const reset = () => {
    built = null;
    queue();
  };
  map.on('move', queue);
  map.on('moveend', reset);
  map.on('resize', reset);
  queue();
  return () => {
    map.off('move', queue);
    map.off('moveend', reset);
    map.off('resize', reset);
  };
}
