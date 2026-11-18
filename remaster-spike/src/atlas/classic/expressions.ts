/**
 * Pure builders for the Classic-atlas style expressions. Everything that
 * depends on the user's Settings, the selection or Projector text is built
 * here, so it can be unit-tested without a map.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import {
  AREA_TO_KM2,
  BORDER_ATTR,
  CAPITAL_ATTR,
  FEATURE_STATE,
  FONTSTACK,
  LABEL_ATTR,
  MARKER,
  PLACE_KIND_SITE,
} from './contract';
import {
  COLOR,
  FALLBACK_WASH,
  OVERLORD_SELECTED_FILL,
  WASHES,
  WASH_SLOTS,
  dependencyTint,
  type Wash,
} from './tokens';
import type {
  ClassicStyleOptions,
  MapSettings,
  Selection,
  TextSize,
} from './options';

export type Expr = ExpressionSpecification;
const e = (v: unknown) => v as Expr;

/* ---- Washes ---------------------------------------------------------------- */

/** Wash for a data index 0–11; anything else is the fallback wash. */
export const washFor = (index: number | null | undefined): Wash =>
  Number.isInteger(index) && index! >= 0 && index! < WASH_SLOTS
    ? WASHES[index! % WASHES.length]
    : FALLBACK_WASH;

type WashKey = 'fill' | 'edge' | 'tint';
const washValue = (w: Wash, key: WashKey) =>
  key === 'tint' ? dependencyTint(w) : w[key];

/** `match` on a wash-index attribute; precomputed per slot so the GPU path is a lookup. */
export const washMatch = (attr: string, key: WashKey): Expr =>
  e([
    'match',
    ['get', attr],
    ...Array.from({ length: WASH_SLOTS }, (_, i) => [
      i,
      washValue(washFor(i), key),
    ]).flat(),
    washValue(FALLBACK_WASH, key),
  ]);

export const isDependency = e(['==', ['get', BORDER_ATTR.dependency], 1]);
export const isSelected = e([
  'boolean',
  ['feature-state', FEATURE_STATE.selected],
  false,
]);
export const isOverlordSelected = e([
  'boolean',
  ['feature-state', FEATURE_STATE.overlordSelected],
  false,
]);

/** Own wash, or a lighter tint of the overlord's wash for a dependency; selection overrides both. */
export const fillColor = e([
  'case',
  isSelected,
  COLOR.selectedFill,
  isOverlordSelected,
  OVERLORD_SELECTED_FILL,
  isDependency,
  washMatch(BORDER_ATTR.overlordWash, 'tint'),
  washMatch(BORDER_ATTR.wash, 'fill'),
]);

/** Dependencies take their overlord's edge pigment, so the family reads as one. */
export const edgeColor = e([
  'case',
  isDependency,
  washMatch(BORDER_ATTR.overlordWash, 'edge'),
  washMatch(BORDER_ATTR.wash, 'edge'),
]);

/** Hatch tile for a dependency: one per overlord wash. */
export const hatchImage = e([
  'concat',
  MARKER.hatchPrefix,
  [
    'case',
    [
      'all',
      ['>=', ['coalesce', ['get', BORDER_ATTR.overlordWash], -1], 0],
      ['<', ['coalesce', ['get', BORDER_ATTR.overlordWash], -1], WASH_SLOTS],
    ],
    ['to-string', ['%', ['get', BORDER_ATTR.overlordWash], WASHES.length]],
    'x',
  ],
]);

/* ---- Settings: fill opacity and border width ------------------------------- */

/** The mock's 62% fill corresponds to the app's default 0.7 opacity preference. */
const OPACITY_SCALE = 0.62 / 0.7;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const round3 = (v: number) => Math.round(v * 1000) / 1000;

export const baseFillOpacity = (s: MapSettings) =>
  round3(clamp(s.countryOpacity, 0.1, 1) * OPACITY_SCALE);

export const fillOpacity = (s: MapSettings): Expr => {
  const base = baseFillOpacity(s);
  return e([
    'case',
    isSelected,
    round3(Math.min(1, base + 0.3)),
    isOverlordSelected,
    round3(Math.min(1, base + 0.15)),
    base,
  ]);
};

/** Ink border: the mock's 0.5–1.1 px at the default thickness of 2; 0 hides it. */
export const borderWidth = (s: MapSettings): Expr => {
  const k = clamp(s.borderThickness, 0, 4) / 2;
  return e([
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    round3(0.5 * k),
    6,
    round3(1.1 * k),
    10,
    round3(1.8 * k),
  ]);
};

/** Selection line never thins below the mock's 1.6–3 px; it thickens with the setting. */
export const selectedLineWidth = (s: MapSettings): Expr => {
  const k = Math.max(1, clamp(s.borderThickness, 0, 4) / 2);
  const at = (w: number) => [
    'case',
    isSelected,
    round3(w * k),
    isOverlordSelected,
    round3(w * 0.45),
    0,
  ];
  return e(['interpolate', ['linear'], ['zoom'], 2, at(1.6), 6, at(3)]);
};

export const selectedLineOpacity = e([
  'case',
  isSelected,
  1,
  isOverlordSelected,
  0.6,
  0,
]);

/* ---- Settings: label size, case and font ----------------------------------- */

/** Size multiplier per Settings text size. "large" is the projector size. */
export const TEXT_SCALE: Record<TextSize, number> = {
  small: 0.9,
  medium: 1,
  large: 1.3,
};
/** Projector text (Atkinson) is set a little larger again. */
export const PROJECTOR_SCALE = 1.1;
/** No map label is smaller than this, at any setting (projector legibility). */
export const MIN_LABEL_PX = 13;

export const textScale = (
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText'>,
) =>
  (TEXT_SCALE[o.settings.textSize] ?? 1) *
  (o.projectorText ? PROJECTOR_SCALE : 1);

const px = (size: number, scale: number) =>
  Math.max(MIN_LABEL_PX, Math.round(size * scale * 10) / 10);

/** Territory area in km², from the label attribute. */
export const areaKm2 = e(['*', ['get', LABEL_ATTR.area], AREA_TO_KM2]);

/** State label sizes at z2 by log10(km²) steps 4, 5, 5.8, 6.6; ×1.55 by z5. Mock: 12/14/17/21. */
export const STATE_SIZES = [13, 14.5, 17, 21] as const;
export const STATE_GROWTH = 1.55;
export const SELECTED_STATE_SIZES = [18, 28] as const;

const selectedName = (sel: Selection | null) =>
  sel ? ['==', ['get', LABEL_ATTR.name], sel.name] : false;

/**
 * Label size by area and zoom. MapLibre allows one zoom `interpolate` per
 * expression, so the selected territory's size is a `case` inside each stop.
 */
export const stateLabelSize = (
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText' | 'selected'>,
): Expr => {
  const k = textScale(o);
  const byArea = (growth: number) => [
    'interpolate',
    ['linear'],
    ['log10', ['max', areaKm2, 1]],
    4,
    px(STATE_SIZES[0] * growth, k),
    5,
    px(STATE_SIZES[1] * growth, k),
    5.8,
    px(STATE_SIZES[2] * growth, k),
    6.6,
    px(STATE_SIZES[3] * growth, k),
  ];
  const stop = (growth: number, selectedSize: number) =>
    o.selected
      ? ['case', selectedName(o.selected), px(selectedSize, k), byArea(growth)]
      : byArea(growth);
  return e([
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    stop(1, SELECTED_STATE_SIZES[0]),
    5,
    stop(STATE_GROWTH, SELECTED_STATE_SIZES[1]),
  ]);
};

const uppercase = (
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText'>,
) => o.settings.textCase === 'upper' || o.projectorText;

export const textTransform = (
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText'>,
) => (uppercase(o) ? ('uppercase' as const) : ('none' as const));

/** Wider tracking for larger empires; uppercase adds a little more. */
export const stateLetterSpacing = (
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText'>,
): Expr => {
  const extra = uppercase(o) ? 0.04 : 0;
  return e([
    'step',
    areaKm2,
    0.04 + extra,
    200000,
    0.1 + extra,
    1000000,
    0.18 + extra,
  ]);
};

const font = (stack: string) => ['literal', [stack]];

export const stateFont = (
  o: Pick<ClassicStyleOptions, 'projectorText' | 'selected'>,
): Expr => {
  const bold = o.projectorText ? FONTSTACK.projectorBold : FONTSTACK.stateBold;
  const medium = o.projectorText
    ? FONTSTACK.projectorMedium
    : FONTSTACK.stateMedium;
  const byArea = ['step', areaKm2, font(medium), 250000, font(bold)];
  return e(
    o.selected
      ? ['case', selectedName(o.selected), font(bold), byArea]
      : byArea,
  );
};

/** Territories under 18,000 km² aren't labelled at overview zooms; the selection always is. */
export const LABEL_MIN_KM2 = 18000;
/** Area floors by zoom: [from zoom, minimum km²]. Shared by the filter and `labelMinKm2`. */
export const LABEL_MIN_KM2_STEPS = [
  [0, LABEL_MIN_KM2],
  [4, 4000],
  [5.5, 0],
] as const;

/** The smallest territory (km², exclusive) that gets a state name at `zoom`. */
export const labelMinKm2 = (zoom: number): number =>
  [...LABEL_MIN_KM2_STEPS].reverse().find(([z]) => zoom >= z)?.[1] ?? 0;

/**
 * Which label points draw a state name. `exclude` lists territory ids whose
 * name is drawn at a viewport anchor instead (`ClassicStyleOptions.relocatedLabels`).
 * MapLibre allows `['zoom']` only in a top-level step, so the exclusion is
 * repeated inside each stop.
 */
export const stateLabelFilter = (
  sel: Selection | null,
  exclude: readonly number[] = [],
): Expr => {
  const or = (cond: unknown) => (sel ? ['any', selectedName(sel), cond] : cond);
  const keep = (cond: unknown) =>
    exclude.length
      ? [
          'all',
          cond,
          ['!', ['in', ['coalesce', ['id'], -1], ['literal', [...exclude]]]],
        ]
      : cond;
  const [[, z0km2], [z1, z1km2], [z2]] = LABEL_MIN_KM2_STEPS;
  return e([
    'step',
    ['zoom'],
    keep(or(['>', areaKm2, z0km2])),
    z1,
    keep(or(['>', areaKm2, z1km2])),
    z2,
    keep(['has', LABEL_ATTR.name]),
  ]);
};

/**
 * Larger territories place their names first; the selection always first.
 * Symbol layers are placed top-down, so this orders names *within* the state
 * layers, and every state layer sits above the city and capital layers.
 */
export const stateSortKey = (sel: Selection | null): Expr =>
  e(
    sel
      ? ['case', selectedName(sel), -1e12, ['-', 0, areaKm2]]
      : ['-', 0, areaKm2],
  );

/**
 * When a name collides at its label point, MapLibre tries it just above, then
 * just below the point before dropping it. In 1914 the German Empire's name
 * touched the Austro-Hungarian Empire's and was dropped; one line up it fits.
 * Left and right shifts are left out: a long name would leave its territory.
 */
export const STATE_VARIABLE_ANCHORS = ['center', 'bottom', 'top'] as const;

export const stateTextColor = (sel: Selection | null): Expr | string =>
  sel
    ? e(['case', selectedName(sel), COLOR.selectedInk, COLOR.ink])
    : COLOR.ink;

/* ---- Places, ruins and capitals -------------------------------------------- */

export const isSite = e(['==', ['get', LABEL_ATTR.placeKind], PLACE_KIND_SITE]);

export const placeFont = (
  o: Pick<ClassicStyleOptions, 'projectorText'>,
): Expr =>
  o.projectorText
    ? e(font(FONTSTACK.projectorMedium))
    : e(['case', isSite, font(FONTSTACK.riverItalic), font(FONTSTACK.city)]);

/** Ruins carry an italic "(ruins)" so the class reads without the key. */
export const placeText = e([
  'case',
  isSite,
  ['concat', ['get', LABEL_ATTR.place], ' (ruins)'],
  ['get', LABEL_ATTR.place],
]);
export const placeIcon = e(['case', isSite, MARKER.site, MARKER.city]);

export const PLACE_PX = 14;
export const CAPITAL_PX = 15;
export const SELECTED_CAPITAL_PX = 16;
export const labelPx = (
  size: number,
  o: Pick<ClassicStyleOptions, 'settings' | 'projectorText'>,
) => px(size, textScale(o));

/**
 * Capitals other than the selected territory's appear from this zoom.
 * Chosen by screenshot review (docs/product/style-review/): at z4 the 1914
 * Europe view gains about a dozen capitals without dropping state names.
 */
export const CAPITAL_MINZOOM = 4;

export const capitalFilter = (
  sel: Selection | null,
  selected: boolean,
): Expr => {
  const tid = ['get', CAPITAL_ATTR.territory];
  if (selected) return e(['==', tid, sel ? sel.id : -1]);
  return e(sel ? ['!=', tid, sel.id] : ['has', CAPITAL_ATTR.name]);
};

/* ---- Waterlines ------------------------------------------------------------ */

/** Seaward offsets (px) of the four engraved waterlines, innermost first. */
export const WATERLINE_OFFSETS = [2.5, 5.5, 9.5, 14.5] as const;
/** Landmasses smaller than this get the coast stroke but no ripples. */
export const WATERLINE_MIN_KM2 = 5000;
/** Plan §9.2 P3: four lines below z3.5, two up to z5, none from z5. */
export const WATERLINE_RULE = [
  { below: 3.5, count: 4 },
  { below: 5, count: 2 },
] as const;

/** How many waterlines the rule draws at `zoom`. */
export const waterlineCount = (zoom: number): number =>
  WATERLINE_RULE.find((r) => zoom < r.below)?.count ?? 0;

/** Exclusive layer `maxzoom` for waterline `i`: the first zoom where the rule drops it. */
export const waterlineMaxzoom = (i: number): number =>
  Math.max(0, ...WATERLINE_RULE.filter((r) => r.count > i).map((r) => r.below));

/** Mock opacities 0.62 → 0.23 seaward; each line fades to 40% by the zoom it disappears. */
export const waterlineOpacity = (i: number): Expr => {
  const base = round3(0.62 - i * 0.13);
  return e([
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    base,
    waterlineMaxzoom(i),
    round3(base * 0.4),
  ]);
};
