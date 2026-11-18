// Helpers for scripts/build-pa.mjs, kept free of side effects so tests can import them.

/** District vector tiles: z11 at extent 8192 is a ~1.8 m grid at 41° N. */
export const DISTRICT_TILES = {
  minzoom: 4,
  maxzoom: 11,
  extent: 8192,
  buffer: 128,
  tolerance: 3,
};
export const WASH_COUNT = 12;

const ringsOf = (geometry) =>
  geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat();

/**
 * Neighbour-aware wash index per district: districts that share a boundary
 * vertex never share a wash. Greedy, most-connected first, ties to the least
 * used wash, so the 12 washes spread evenly. Deterministic.
 */
export const districtWashes = (polygons) => {
  const owners = new Map();
  polygons.forEach((f, id) => {
    for (const ring of ringsOf(f.geometry))
      for (const [lng, lat] of ring) {
        const k = `${lng.toFixed(5)},${lat.toFixed(5)}`;
        if (!owners.has(k)) owners.set(k, new Set());
        owners.get(k).add(id);
      }
  });
  const neighbours = polygons.map(() => new Set());
  for (const ids of owners.values())
    if (ids.size > 1)
      for (const a of ids)
        for (const b of ids) if (a !== b) neighbours[a].add(b);
  const order = polygons
    .map((_, id) => id)
    .sort((a, b) => neighbours[b].size - neighbours[a].size || a - b);
  const wash = new Array(polygons.length).fill(-1);
  const used = new Array(WASH_COUNT).fill(0);
  for (const id of order) {
    const taken = new Set([...neighbours[id]].map((n) => wash[n]));
    let best = -1;
    for (let c = 0; c < WASH_COUNT; c += 1)
      if (!taken.has(c) && (best < 0 || used[c] < used[best])) best = c;
    wash[id] = best < 0 ? id % WASH_COUNT : best;
    used[wash[id]] += 1;
  }
  return wash;
};

export const bboxOf = (geometry) => {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const ring of ringsOf(geometry))
    for (const [lng, lat] of ring) {
      w = Math.min(w, lng);
      s = Math.min(s, lat);
      e = Math.max(e, lng);
      n = Math.max(n, lat);
    }
  return [w, s, e, n].map((v) => Math.round(v * 1e5) / 1e5);
};

/** Tile keys as per-zoom rows of [x0, x1] runs (the client's coverage index). */
export const coverageRuns = (tiles) => {
  const rows = {};
  for (const { z, x, y } of tiles) ((rows[z] ??= {})[y] ??= []).push(x);
  const out = {};
  for (const [z, byRow] of Object.entries(rows)) {
    out[z] = {};
    for (const [y, xs] of Object.entries(byRow)) {
      xs.sort((a, b) => a - b);
      const runs = [];
      for (const x of xs) {
        const last = runs[runs.length - 1];
        if (last && x === last[1] + 1) last[1] = x;
        else runs.push([x, x]);
      }
      out[z][y] = runs;
    }
  }
  return out;
};

/**
 * One label point per PIAA district (I–XII): the member district label point
 * nearest the members' area-weighted centre, so it always lies inside the
 * region. Districts with no PIAA district are skipped.
 */
export function piaaLabelPoints(districts) {
  const groups = new Map();
  for (const d of districts) {
    const p = d.sports?.piaa;
    if (!p) continue;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(d);
  }
  return [...groups.keys()]
    .sort((a, b) => a - b)
    .map((p) => {
      const members = groups.get(p);
      const weight = members.reduce((n, d) => n + d.km2, 0);
      const cx = members.reduce((n, d) => n + d.label[0] * d.km2, 0) / weight;
      const cy = members.reduce((n, d) => n + d.label[1] * d.km2, 0) / weight;
      const k = Math.cos((cy * Math.PI) / 180);
      const nearest = members.reduce(
        (best, d) => {
          const dist = ((d.label[0] - cx) * k) ** 2 + (d.label[1] - cy) ** 2;
          return dist < best.dist ? { d, dist } : best;
        },
        { d: members[0], dist: Infinity },
      ).d;
      return { piaa: p, districts: members.length, label: nearest.label };
    });
}
