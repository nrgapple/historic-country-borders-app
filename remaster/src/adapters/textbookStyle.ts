/**
 * Direction B, "Modern textbook", as a MapLibre style (design/living-atlas,
 * `b-modern-textbook.html`, ported to the production sources).
 *
 * B is built from T6's Classic-atlas layer stack rather than beside it: every
 * layer keeps its id, source and filter, and B replaces paint and layout
 * values, hides A's decorations (edge bands, the selection band, waterlines)
 * and shows three layers of its own (selection hatch, white border casing,
 * coastal shelf). Both themes therefore have the same layers in the same
 * order, so switching is only `setPaintProperty`/`setLayoutProperty` on a
 * live map: the camera, the year's sources, the selection's feature-state
 * and the viewport labels all survive, and nothing is downloaded again.
 *
 * Cartography (B column of design/living-atlas/README.md):
 * - textbook pastels at 92 % under a white casing and a same-hue border;
 * - light-blue water with a blurred shelf band along the coast (no
 *   graticule: the owner removed it from every map);
 * - Atkinson Hyperlegible Next Bold capitals for states, Literata Italic for
 *   water and ruins, Atkinson Medium for cities;
 * - the selection as a diagonal hatch in the map accent over the territory's
 *   own tint, an accent outline and an accent name (never a fill colour
 *   alone: a blue fill read as sea).
 */
import type { LayerSpecification, Map as MLMap } from 'maplibre-gl';
import {
  areaKm2,
  BASEMAP_LAYER,
  BORDER_ATTR,
  FEATURE_ATTR,
  isDependency,
  isOverlordSelected,
  isSelected,
  isSite,
  LABEL_ATTR,
  LAYER,
  LOW_POWER_HIDDEN,
  MARINE_KIND_OCEAN,
  MIN_LABEL_PX,
  SOURCE,
  STATE_GROWTH,
  textScale,
  WASH_SLOTS,
  type ClassicStyleOptions,
  type Expr,
} from '@repo/remaster-spike/src/atlas/classic';
import {
  TEXTBOOK_COLOR,
  TEXTBOOK_FALLBACK_WASH,
  TEXTBOOK_MAP_ACCENT,
  TEXTBOOK_WASHES,
} from '../styles/tokens';
import { FONTSTACK } from './glyphs';

const e = (v: unknown) => v as Expr;
const round3 = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const ramp = (a: number, b: number, z0 = 2, z1 = 6): Expr =>
  e(['interpolate', ['linear'], ['zoom'], z0, a, z1, b]);

/** B's map colours beyond the shared tokens (from the B mock). */
export const TEXTBOOK_MAP = {
  ink: TEXTBOOK_COLOR.ink,
  land: TEXTBOOK_COLOR.land,
  water: TEXTBOOK_COLOR.water,
  waterInk: TEXTBOOK_COLOR.waterInk,
  accent: TEXTBOOK_MAP_ACCENT,
  casing: '#FFFFFF',
  shelf: '#D2EAF3',
  coast: '#5E93AB',
  river: '#4C9BC2',
  /** Dependencies of the selected territory: a light accent wash. */
  overlordSelectedFill: TEXTBOOK_COLOR.selectedFill,
  stateHalo: 'rgba(255, 255, 255, 0.95)',
  placeHalo: '#FFFFFF',
  riverHalo: 'rgba(255, 255, 255, 0.9)',
  seaHalo: 'rgba(188, 221, 235, 0.9)',
} as const;

/** B's own layers. Present (hidden) in the Classic style too, so both share one layer list. */
export const TEXTBOOK_LAYER = {
  /** The selection hatch, over the territory's own tint. */
  selectedHatch: 'selected-hatch',
  /** White casing under each border. */
  borderCasing: 'border-casing',
  /** Lighter shallow-water band along the coast. */
  shelf: 'shelf',
} as const;

/** A's decorations that B does not draw. */
export const TEXTBOOK_HIDDEN: readonly string[] = [
  LAYER.edgeBand,
  LAYER.selectedBand,
  LAYER.waterline(0),
  LAYER.waterline(1),
  LAYER.waterline(2),
  LAYER.waterline(3),
];

/** B's low-power rule: T6's (no dependency hatch), plus no coastal shelf. */
export const TEXTBOOK_LOW_POWER_HIDDEN: readonly string[] = [
  ...LOW_POWER_HIDDEN,
  TEXTBOOK_LAYER.shelf,
];

/** Every B image id starts with this (see `addTextbookImages`). */
export const TEXTBOOK_IMAGE_PREFIX = 'tb-';

/** B's marker and pattern images (registered by `addTextbookImages`). */
export const TEXTBOOK_MARKER = {
  city: 'tb-city',
  capital: 'tb-capital',
  selectedCapital: 'tb-capital-selected',
  site: 'tb-site',
  selectedHatch: 'tb-hatch-selected',
  /** Dependency hatch, one per overlord wash: `${prefix}${0..11}` and `${prefix}x`. */
  hatchPrefix: 'tb-hatch-',
} as const;

/* ---- Expressions ----------------------------------------------------------- */

type Wash = { fill: string; edge: string };
const washFor = (i: number): Wash =>
  i >= 0 && i < WASH_SLOTS
    ? TEXTBOOK_WASHES[i % TEXTBOOK_WASHES.length]
    : TEXTBOOK_FALLBACK_WASH;
/** sRGB mix; `t` is the share of `b`. */
const mix = (a: string, b: string, t: number) =>
  `#${[1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(a.slice(i, i + 2), 16) * (1 - t) +
          parseInt(b.slice(i, i + 2), 16) * t,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
/** A dependency is washed in a lighter tint of its overlord's pastel (as in A). */
export const textbookDependencyTint = (w: Wash) =>
  mix(w.fill, TEXTBOOK_MAP.land, 0.4);

const washMatch = (attr: string, pick: (w: Wash) => string): Expr =>
  e([
    'match',
    ['get', attr],
    ...Array.from({ length: WASH_SLOTS }, (_, i) => [
      i,
      pick(washFor(i)),
    ]).flat(),
    pick(TEXTBOOK_FALLBACK_WASH),
  ]);

/** Own pastel, or a tint of the overlord's for a dependency; the selection keeps its own tint. */
export const textbookFillColor = e([
  'case',
  isOverlordSelected,
  TEXTBOOK_MAP.overlordSelectedFill,
  isDependency,
  washMatch(BORDER_ATTR.overlordWash, textbookDependencyTint),
  washMatch(BORDER_ATTR.wash, (w) => w.fill),
]);

/** Same-hue border; dependencies take the overlord's; the selection is accent. */
export const textbookEdgeColor = e([
  'case',
  isSelected,
  TEXTBOOK_MAP.accent,
  isDependency,
  washMatch(BORDER_ATTR.overlordWash, (w) => w.edge),
  washMatch(BORDER_ATTR.wash, (w) => w.edge),
]);

const hatchImage = e([
  'concat',
  TEXTBOOK_MARKER.hatchPrefix,
  [
    'case',
    [
      'all',
      ['>=', ['coalesce', ['get', BORDER_ATTR.overlordWash], -1], 0],
      ['<', ['coalesce', ['get', BORDER_ATTR.overlordWash], -1], WASH_SLOTS],
    ],
    [
      'to-string',
      ['%', ['get', BORDER_ATTR.overlordWash], TEXTBOOK_WASHES.length],
    ],
    'x',
  ],
]);

/** The mock's 92 % fill at the app's default 0.7 opacity preference. */
const OPACITY_SCALE = 0.92 / 0.7;
export const textbookFillOpacity = (o: ClassicStyleOptions): number =>
  round3(clamp(o.settings.countryOpacity, 0.1, 1) * OPACITY_SCALE);

const thickness = (o: ClassicStyleOptions) =>
  clamp(o.settings.borderThickness, 0, 4) / 2;

const px = (size: number, scale: number) =>
  Math.max(MIN_LABEL_PX, Math.round(size * scale * 10) / 10);
const labelPx = (size: number, o: ClassicStyleOptions) =>
  px(size, textScale(o));

/** State sizes at z2 by log10(km²) 4, 5, 5.8, 6.6 (mock 11/12.5/15/18, floored at 13 px). */
export const TEXTBOOK_STATE_SIZES = [13, 13.5, 15.5, 18] as const;
export const TEXTBOOK_SELECTED_STATE_SIZES = [17, 25] as const;

const selectedName = (o: ClassicStyleOptions) =>
  o.selected ? ['==', ['get', LABEL_ATTR.name], o.selected.name] : false;

export const textbookStateSize = (o: ClassicStyleOptions): Expr => {
  const k = textScale(o);
  const byArea = (growth: number) => [
    'interpolate',
    ['linear'],
    ['log10', ['max', areaKm2, 1]],
    4,
    px(TEXTBOOK_STATE_SIZES[0] * growth, k),
    5,
    px(TEXTBOOK_STATE_SIZES[1] * growth, k),
    5.8,
    px(TEXTBOOK_STATE_SIZES[2] * growth, k),
    6.6,
    px(TEXTBOOK_STATE_SIZES[3] * growth, k),
  ];
  const stop = (growth: number, selected: number) =>
    o.selected
      ? ['case', selectedName(o), px(selected, k), byArea(growth)]
      : byArea(growth);
  return e([
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    stop(1, TEXTBOOK_SELECTED_STATE_SIZES[0]),
    5,
    stop(STATE_GROWTH, TEXTBOOK_SELECTED_STATE_SIZES[1]),
  ]);
};

/** Fontstacks B requests: Atkinson (shared with Projector text) and Literata Italic. */
export const textbookFonts = (
  o: Pick<ClassicStyleOptions, 'projectorText'>,
) => ({
  state: FONTSTACK.projectorBold,
  city: FONTSTACK.projectorMedium,
  selectedCity: FONTSTACK.projectorBold,
  // Projector text keeps every label in Atkinson, as in A.
  italic: o.projectorText
    ? FONTSTACK.projectorMedium
    : FONTSTACK.textbookItalic,
});

/* ---- Layers ---------------------------------------------------------------- */

type Patch = {
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
};

const vis = (on: boolean) => (on ? 'visible' : 'none');

/** B's paint and layout for each shared layer id. */
function textbookPatches(o: ClassicStyleOptions): Record<string, Patch> {
  const k = thickness(o);
  const f = textbookFonts(o);
  const font = (stack: string) => [stack];
  const sel = o.selected;
  const stateLayer: Patch = {
    layout: {
      'text-font': e(['literal', font(f.state)]),
      'text-size': textbookStateSize(o),
      // Textbook maps set state names in capitals, whatever the case setting.
      'text-transform': 'uppercase',
      'text-letter-spacing': e([
        'step',
        areaKm2,
        0.03,
        200000,
        0.07,
        1000000,
        0.12,
      ]),
    },
    paint: {
      'text-color': sel
        ? e(['case', selectedName(o), TEXTBOOK_MAP.accent, TEXTBOOK_MAP.ink])
        : TEXTBOOK_MAP.ink,
      'text-halo-color': TEXTBOOK_MAP.stateHalo,
      'text-halo-width': round3(2 * Math.min(1.2, textScale(o))),
      'text-halo-blur': 0,
    },
  };
  const hidden: Patch = { layout: { visibility: 'none' } };
  const patches: Record<string, Patch> = {
    [LAYER.land]: { paint: { 'background-color': TEXTBOOK_MAP.land } },
    [LAYER.territoryFill]: {
      paint: {
        'fill-color': textbookFillColor,
        'fill-opacity': textbookFillOpacity(o),
      },
    },
    [LAYER.dependencyHatch]: {
      paint: { 'fill-pattern': hatchImage, 'fill-opacity': 0.55 },
    },
    [LAYER.border]: {
      paint: {
        'line-color': textbookEdgeColor,
        'line-width': e([
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          round3(0.7 * k),
          6,
          round3(1.4 * k),
          10,
          round3(2.2 * k),
        ]),
        'line-opacity': 1,
      },
    },
    [LAYER.selectedLine]: {
      paint: {
        'line-color': TEXTBOOK_MAP.accent,
        'line-width': e([
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          [
            'case',
            isSelected,
            round3(2.2 * Math.max(1, k)),
            isOverlordSelected,
            1,
            0,
          ],
          6,
          [
            'case',
            isSelected,
            round3(4 * Math.max(1, k)),
            isOverlordSelected,
            1.8,
            0,
          ],
        ]),
        'line-opacity': e(['case', isSelected, 1, isOverlordSelected, 0.7, 0]),
      },
    },
    [LAYER.ocean]: { paint: { 'fill-color': TEXTBOOK_MAP.water } },
    [LAYER.coast]: {
      paint: { 'line-color': TEXTBOOK_MAP.coast, 'line-width': 1 },
    },
    [LAYER.lakes]: { paint: { 'fill-color': TEXTBOOK_MAP.water } },
    [LAYER.lakeShore]: {
      paint: { 'line-color': TEXTBOOK_MAP.coast, 'line-width': 0.8 },
    },
    [LAYER.rivers]: {
      paint: {
        'line-color': TEXTBOOK_MAP.river,
        'line-width': e([
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          ['match', ['get', FEATURE_ATTR.rank], [1, 2], 1.1, 0.6],
          6,
          ['match', ['get', FEATURE_ATTR.rank], [1, 2], 2.4, 1.3],
        ]),
      },
    },
    [LAYER.riverLabels]: {
      layout: {
        'text-font': font(f.italic),
        'text-letter-spacing': 0.02,
      },
      paint: {
        'text-color': TEXTBOOK_MAP.waterInk,
        'text-halo-color': TEXTBOOK_MAP.riverHalo,
        'text-halo-width': 1.6,
      },
    },
    [LAYER.seaLabels]: {
      layout: {
        'text-field': e(['get', FEATURE_ATTR.name]),
        'text-font': font(f.italic),
        'text-size': e([
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          [
            'match',
            ['get', FEATURE_ATTR.kind],
            MARINE_KIND_OCEAN,
            labelPx(16, o),
            labelPx(13, o),
          ],
          5,
          [
            'match',
            ['get', FEATURE_ATTR.kind],
            MARINE_KIND_OCEAN,
            labelPx(22, o),
            labelPx(18, o),
          ],
        ]),
        'text-letter-spacing': 0.04,
      },
      paint: {
        'text-color': TEXTBOOK_MAP.waterInk,
        'text-halo-color': TEXTBOOK_MAP.seaHalo,
        'text-halo-width': 1.2,
      },
    },
    [LAYER.places]: {
      layout: {
        'icon-image': e([
          'case',
          isSite,
          TEXTBOOK_MARKER.site,
          TEXTBOOK_MARKER.city,
        ]),
        'text-font': e([
          'case',
          isSite,
          ['literal', font(f.italic)],
          ['literal', font(f.city)],
        ]),
      },
      paint: {
        'text-color': TEXTBOOK_MAP.ink,
        'text-halo-color': TEXTBOOK_MAP.placeHalo,
        'text-halo-width': 1.8,
      },
    },
    [LAYER.capitals]: {
      layout: {
        'icon-image': TEXTBOOK_MARKER.capital,
        'text-font': font(f.city),
      },
      paint: {
        'text-color': TEXTBOOK_MAP.ink,
        'text-halo-color': TEXTBOOK_MAP.placeHalo,
        'text-halo-width': 1.8,
      },
    },
    [LAYER.selectedCapital]: {
      layout: {
        'icon-image': TEXTBOOK_MARKER.selectedCapital,
        'text-font': font(f.selectedCity),
        'text-size': labelPx(15, o),
      },
      paint: {
        'text-color': TEXTBOOK_MAP.ink,
        'text-halo-color': TEXTBOOK_MAP.placeHalo,
        'text-halo-width': 2,
      },
    },
    [LAYER.stateLabels]: stateLayer,
    [LAYER.viewportStateLabels]: stateLayer,
    [LAYER.selectedCapitalMark]: {
      layout: { 'icon-image': TEXTBOOK_MARKER.selectedCapital },
    },
    [LAYER.relief]: {
      // A's sepia relief, turned to a quiet slate shade.
      paint: {
        'raster-opacity': 0.55,
        'raster-saturation': -1,
        'raster-contrast': 0.1,
      },
    },
  };
  for (const id of TEXTBOOK_HIDDEN) patches[id] = hidden;
  return patches;
}

/** B's own layers, styled for B; the Classic style carries them hidden. */
function extraLayers(
  o: ClassicStyleOptions,
  visible: boolean,
): Record<string, LayerSpecification> {
  const k = thickness(o);
  const on = (id: string) =>
    vis(visible && !(o.lowPower && TEXTBOOK_LOW_POWER_HIDDEN.includes(id))) as
      'visible' | 'none';
  return {
    [TEXTBOOK_LAYER.selectedHatch]: {
      id: TEXTBOOK_LAYER.selectedHatch,
      type: 'fill',
      source: SOURCE.borders,
      layout: { visibility: on(TEXTBOOK_LAYER.selectedHatch) },
      paint: {
        'fill-pattern': TEXTBOOK_MARKER.selectedHatch,
        // Feature-state, not a filter: a new selection never re-tiles the borders.
        'fill-opacity': e(['case', isSelected, 1, 0]),
      },
    },
    [TEXTBOOK_LAYER.borderCasing]: {
      id: TEXTBOOK_LAYER.borderCasing,
      type: 'line',
      source: SOURCE.borders,
      layout: {
        visibility: on(TEXTBOOK_LAYER.borderCasing),
        'line-join': 'round',
      },
      paint: {
        'line-color': TEXTBOOK_MAP.casing,
        'line-width': ramp(round3(1.6 * k), round3(3.4 * k)),
      },
    },
    [TEXTBOOK_LAYER.shelf]: {
      id: TEXTBOOK_LAYER.shelf,
      type: 'line',
      source: SOURCE.basemap,
      'source-layer': BASEMAP_LAYER.coast,
      layout: { visibility: on(TEXTBOOK_LAYER.shelf), 'line-join': 'round' },
      paint: {
        'line-color': TEXTBOOK_MAP.shelf,
        'line-width': ramp(5, 14),
        // Coast rings have water on the right: positive offsets go seaward.
        'line-offset': ramp(2.5, 7),
        'line-blur': 2,
      },
    },
  };
}

/** Where B's layers sit in T6's stack: each goes right after the named layer. */
const EXTRA_AFTER: Array<[after: string, id: string]> = [
  [LAYER.dependencyHatch, TEXTBOOK_LAYER.selectedHatch],
  [LAYER.selectedBand, TEXTBOOK_LAYER.borderCasing],
  [LAYER.ocean, TEXTBOOK_LAYER.shelf],
];

/**
 * Inserts B's layers into T6's Classic stack, styled for `theme` (hidden
 * for Classic), and patches the shared layers for Modern textbook.
 */
export function themeLayers(
  classic: LayerSpecification[],
  o: ClassicStyleOptions,
  textbook: boolean,
): LayerSpecification[] {
  const extras = extraLayers(o, textbook);
  const patches = textbook ? textbookPatches(o) : {};
  const out: LayerSpecification[] = [];
  for (const layer of classic) {
    const patch = patches[layer.id];
    out.push(
      patch
        ? ({
            ...layer,
            layout: { ...(layer.layout ?? {}), ...patch.layout },
            paint: { ...(layer.paint ?? {}), ...patch.paint },
          } as LayerSpecification)
        : layer,
    );
    for (const [after, id] of EXTRA_AFTER)
      if (after === layer.id) out.push(extras[id]);
  }
  return out;
}

/* ---- Images ---------------------------------------------------------------- */

type Draw = (g: CanvasRenderingContext2D, c: number, size: number) => void;

function raster(size: number, draw: Draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return null;
  draw(g, size / 2, size);
  return {
    width: size,
    height: size,
    data: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer),
  };
}

const star =
  (fill: string, outer: number, inner: number): Draw =>
  (g, c) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 2.2;
    g.strokeStyle = '#FFFFFF';
    g.stroke();
  };

const dot = (g: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = TEXTBOOK_MAP.ink;
  g.fill();
  g.lineWidth = 2.4;
  g.strokeStyle = '#FFFFFF';
  g.stroke();
};

const hatch =
  (color: string, alpha: number, width: number): Draw =>
  (g, _c, size) => {
    g.strokeStyle = color;
    g.globalAlpha = alpha;
    g.lineWidth = width;
    for (const o of [-size, 0, size]) {
      g.beginPath();
      g.moveTo(o, size);
      g.lineTo(o + size, 0);
      g.stroke();
    }
  };

/** Registers B's markers and hatch tiles. Idempotent; safe after a style reload. */
export function addTextbookImages(map: MLMap) {
  const add = (id: string, size: number, draw: Draw) => {
    if (map.hasImage(id)) return;
    const image = raster(size, draw);
    if (image) map.addImage(id, image, { pixelRatio: 2 });
  };
  add(TEXTBOOK_MARKER.city, 22, (g, c) => dot(g, c, c, 5.5));
  add(TEXTBOOK_MARKER.site, 24, (g, c) => {
    dot(g, c, c - 5, 3.2);
    dot(g, c - 5, c + 4, 3.2);
    dot(g, c + 5, c + 4, 3.2);
  });
  add(TEXTBOOK_MARKER.capital, 26, star(TEXTBOOK_MAP.ink, 10.5, 4.4));
  add(
    TEXTBOOK_MARKER.selectedCapital,
    32,
    star(TEXTBOOK_MAP.accent, 13.5, 5.6),
  );
  add(TEXTBOOK_MARKER.selectedHatch, 16, hatch(TEXTBOOK_MAP.accent, 0.55, 3));
  TEXTBOOK_WASHES.forEach((w, i) =>
    add(`${TEXTBOOK_MARKER.hatchPrefix}${i}`, 20, hatch(w.edge, 0.5, 1.6)),
  );
  add(
    `${TEXTBOOK_MARKER.hatchPrefix}x`,
    20,
    hatch(TEXTBOOK_FALLBACK_WASH.edge, 0.5, 1.6),
  );
}
