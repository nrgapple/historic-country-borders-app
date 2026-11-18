/**
 * Marker and pattern images, drawn once on a canvas and registered with
 * `map.addImage`. Keeping them in code avoids a sprite build.
 */
import type { Map as MLMap } from 'maplibre-gl';
import { MARKER } from './contract';
import { COLOR, FALLBACK_WASH, WASHES } from './tokens';

type Draw = (g: CanvasRenderingContext2D, c: number, size: number) => void;

function raster(size: number, draw: Draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d')!;
  draw(g, size / 2, size);
  return {
    width: size,
    height: size,
    data: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer),
  };
}

const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
};

/** Living city: an ink dot with a paper keyline. */
const city: Draw = (g, c) => {
  dot(g, c, c, 5.5);
  g.fillStyle = COLOR.ink;
  g.fill();
  g.lineWidth = 2.6;
  g.strokeStyle = COLOR.sheet;
  g.stroke();
};

/** Capital: the atlas star-in-circle, a five-pointed ink star in a paper ring. */
const capital: Draw = (g, c) => {
  dot(g, c, c, 12.5);
  g.fillStyle = COLOR.sheet;
  g.fill();
  g.lineWidth = 2.4;
  g.strokeStyle = COLOR.ink;
  g.stroke();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.6 : 9;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
  }
  g.closePath();
  g.fillStyle = COLOR.ink;
  g.fill();
};

/** Archaeological site: ∴, three ink dots, the conventional mark for ruins. */
const site: Draw = (g, c) => {
  g.fillStyle = COLOR.ink;
  for (const [x, y] of [
    [c, c - 5],
    [c - 5, c + 4],
    [c + 5, c + 4],
  ]) {
    dot(g, x, y, 3.4);
    g.lineWidth = 1.6;
    g.strokeStyle = COLOR.sheet;
    g.stroke();
    g.fill();
  }
};

/** Dependency hatch: thin diagonals in the overlord's edge pigment, 10 px apart on screen. */
const hatch =
  (color: string): Draw =>
  (g, _c, size) => {
    g.strokeStyle = color;
    g.globalAlpha = 0.5;
    g.lineWidth = 1.6;
    for (const o of [-size, 0, size]) {
      g.beginPath();
      g.moveTo(o, size);
      g.lineTo(o + size, 0);
      g.stroke();
    }
  };

/** Registers every marker and hatch image. Safe to call again after a style reload. */
export function addMarkerImages(map: MLMap) {
  const add = (id: string, size: number, draw: Draw) => {
    if (!map.hasImage(id))
      map.addImage(id, raster(size, draw), { pixelRatio: 2 });
  };
  add(MARKER.city, 22, city);
  add(MARKER.capital, 30, capital);
  add(MARKER.site, 24, site);
  WASHES.forEach((w, i) => add(`${MARKER.hatchPrefix}${i}`, 20, hatch(w.edge)));
  add(`${MARKER.hatchPrefix}x`, 20, hatch(FALLBACK_WASH.edge));
}
