/**
 * "Colour districts by" for the Pennsylvania map: the modes, their palettes,
 * the MapLibre expressions that apply them, the legend and the URL parameter.
 *
 * Every colour comes from `colourPalettes(theme)`: `PA_COLOUR_PALETTES` for
 * Classic atlas and `PA_COLOUR_PALETTES_TEXTBOOK` for Modern textbook (the
 * page default), so each map style swaps the palettes in one place. Every fill carries district names in ink
 * (the selected name too, in bold: the madder selection ink is too dark for
 * the darkest steps, and the madder outline marks the selection), so
 * `tokens.test.ts` checks
 * `COLOUR_BY_CONTRAST_PAIRS` for WCAG AA at full fill opacity, the
 * conservative case: the map draws fills translucent over paper, which only
 * lightens them.
 *
 * Tile properties (scripts/build-pa.mjs):
 * - `f`: the district's largest PIAA football class, 1–6 (1A–6A); 0 = none
 * - `p`: PIAA district, 1–12; 0 = unknown
 * - `e`: PIAA grade 9–11 enrollment of its public high schools; 0 = unknown
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { COLOR, TEXTBOOK_COLOR, type ThemeId } from '../styles/tokens';

type Expr = ExpressionSpecification;

export const COLOUR_BY = ['default', 'football', 'piaa', 'enrollment'] as const;
export type ColourBy = (typeof COLOUR_BY)[number];

export const COLOUR_BY_LABELS: Record<ColourBy, string> = {
  default: 'Distinct colours',
  football: 'Football class',
  piaa: 'PIAA district',
  enrollment: 'Enrollment',
};

export const isColourBy = (value: unknown): value is ColourBy =>
  typeof value === 'string' && (COLOUR_BY as readonly string[]).includes(value);

export const CLASS_NAMES = ['1A', '2A', '3A', '4A', '5A', '6A'] as const;
export const ROMAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
] as const;

/** "District III" for 3. */
export const piaaName = (n: number) => `District ${ROMAN[n - 1] ?? n}`;

/**
 * Grade 9–11 enrollment breaks (students in a district's public high
 * schools, PIAA's classification count): the sextiles of the 2026–27 data
 * (224, 349, 502, 772, 1,118), rounded, so each step holds about a sixth of
 * the districts.
 */
export const ENROLLMENT_BREAKS = [225, 350, 500, 750, 1100] as const;

/** The Classic atlas palettes (paper-toned). */
export const PA_COLOUR_PALETTES = {
  /** 1A (light) → 6A (dark), yellow → green → blue. */
  football: ['#F4EEC4', '#D6E5B4', '#AFD4B4', '#8DC0BF', '#7CA6CC', '#7D8DCB'],
  /** A district with no PIAA football team: neutral paper, hatched. */
  noFootball: { fill: '#E6E0D2', hatch: '#9C8B66' },
  /** PIAA districts I–XII: 12 hues, neighbours kept apart. */
  piaa: [
    '#E9A27E',
    '#93BEE6',
    '#C9D66A',
    '#D6A2D3',
    '#76C2AA',
    '#E6CB62',
    '#A9ABE2',
    '#EFA3AE',
    '#A0CB84',
    '#D8B48C',
    '#86C8DA',
    '#C9A6BD',
  ],
  /** Smallest → largest enrollment, pale lilac → violet. */
  enrollment: [
    '#F4EAEF',
    '#E7D2E1',
    '#D7BAD3',
    '#C6A2C6',
    '#B58DBB',
    '#A77FB1',
  ],
  /** No PIAA data for the district. */
  unknown: '#E2DCCD',
} as const;

type Palettes = {
  football: readonly string[];
  noFootball: { fill: string; hatch: string };
  piaa: readonly string[];
  enrollment: readonly string[];
  unknown: string;
};

/**
 * Modern textbook: the same scales, hue for hue, in B's brighter textbook
 * range on a cool white ground (B's pastels for the PIAA districts, in the
 * same order so neighbours stay apart). Ink names pass AA on every fill.
 */
export const PA_COLOUR_PALETTES_TEXTBOOK: Palettes = {
  football: ['#FFF1A8', '#D8EEA0', '#A8DDB0', '#86CDCB', '#86B6E8', '#9AA3EC'],
  noFootball: { fill: '#ECEEF1', hatch: '#8E99A6' },
  piaa: [
    '#F6B9A6',
    '#B3CBEF',
    '#D2E79A',
    '#E3BFE3',
    '#9FD7D3',
    '#F5D77E',
    '#C8BCEB',
    '#F3B3C8',
    '#B4DDA4',
    '#E9CBA1',
    '#A9DCEC',
    '#DCC2D4',
  ],
  enrollment: [
    '#F4EFFA',
    '#E4DAF3',
    '#D2C3EB',
    '#BFACE2',
    '#AD96D9',
    '#9D84D1',
  ],
  unknown: '#E4E0D6',
};

/** The palettes for a map style: the one place every mode reads its colours. */
export const colourPalettes = (theme: ThemeId = 'classic'): Palettes =>
  theme === 'textbook' ? PA_COLOUR_PALETTES_TEXTBOOK : PA_COLOUR_PALETTES;

const inkOf = (theme: ThemeId) =>
  theme === 'textbook' ? TEXTBOOK_COLOR.ink : COLOR.ink;

export const HATCH_IMAGE = 'pa-no-football';
/** The "no PIAA football" hatch image for a map style (its hatch colour differs). */
export const hatchImageId = (theme: ThemeId = 'classic') =>
  theme === 'textbook' ? `${HATCH_IMAGE}-textbook` : HATCH_IMAGE;

/** Per-channel sRGB mix of two #RRGGBB colours; `t` is the share of `b`. */
const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa
    .map((v, i) =>
      Math.round(v + (pb[i] - v) * t)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
};
/** The darker pigment of a fill: A's inner edge band, B's border line. */
export const edgeOf = (fill: string, theme: ThemeId = 'classic') =>
  mix(fill, inkOf(theme), 0.38);

const enrollmentStep = (colours: readonly string[], unknown: string): Expr =>
  [
    'case',
    ['>', ['coalesce', ['get', 'e'], 0], 0],
    [
      'step',
      ['get', 'e'],
      colours[0],
      ...ENROLLMENT_BREAKS.flatMap((b, i) => [b, colours[i + 1]]),
    ],
    unknown,
  ] as unknown as Expr;

/** The fill colour for a mode; `null` keeps the default washes. */
export const fillColour = (
  mode: ColourBy,
  theme: ThemeId = 'classic',
): Expr | null => {
  const P = colourPalettes(theme);
  switch (mode) {
    case 'football':
      return [
        'match',
        ['coalesce', ['get', 'f'], 0],
        ...P.football.flatMap((c, i) => [i + 1, c]),
        P.noFootball.fill,
      ] as unknown as Expr;
    case 'piaa':
      return [
        'match',
        ['coalesce', ['get', 'p'], 0],
        ...P.piaa.flatMap((c, i) => [i + 1, c]),
        P.unknown,
      ] as unknown as Expr;
    case 'enrollment':
      return enrollmentStep(P.enrollment, P.unknown);
    default:
      return null;
  }
};

/** The edge colour for a mode; `null` keeps the default washes. */
export const edgeColour = (
  mode: ColourBy,
  theme: ThemeId = 'classic',
): Expr | null => {
  const P = colourPalettes(theme);
  const edge = (fill: string) => edgeOf(fill, theme);
  switch (mode) {
    case 'football':
      return [
        'match',
        ['coalesce', ['get', 'f'], 0],
        ...P.football.flatMap((c, i) => [i + 1, edge(c)]),
        P.noFootball.hatch,
      ] as unknown as Expr;
    case 'piaa':
      return [
        'match',
        ['coalesce', ['get', 'p'], 0],
        ...P.piaa.flatMap((c, i) => [i + 1, edge(c)]),
        edge(P.unknown),
      ] as unknown as Expr;
    case 'enrollment':
      return enrollmentStep(P.enrollment.map(edge), edge(P.unknown));
    default:
      return null;
  }
};

/** Districts the football hatch covers: those with no football class. */
export const NO_FOOTBALL_FILTER = [
  '==',
  ['coalesce', ['get', 'f'], 0],
  0,
] as unknown as Expr;

/**
 * The label property that holds a mode's second line, set per district from
 * the index in paMap.ts ("6A", "Up to 6A · 3 schools", "1,330 students").
 */
export const SECOND_LINE: Record<Exclude<ColourBy, 'default'>, string> = {
  football: 'sf',
  piaa: 'sp',
  enrollment: 'se',
};

/** The diagonal hatch image for "no football" (a 16 px tile). */
export const hatchImage = (size = 16, theme: ThemeId = 'classic') => {
  const data = new Uint8Array(size * size * 4);
  const [r, g, b] = [1, 3, 5].map((i) =>
    parseInt(colourPalettes(theme).noFootball.hatch.slice(i, i + 2), 16),
  );
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      // A 1.5 px line every 8 px, running bottom-left to top-right.
      const d = (x + y) % 8;
      const alpha = d === 0 ? 200 : d === 1 ? 90 : 0;
      const o = (y * size + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = alpha;
    }
  return { width: size, height: size, data };
};

/* ---- Legend --------------------------------------------------------------- */

export interface ColourLegendEntry {
  id: string;
  label: string;
  /** "105 districts". */
  count?: string;
  fill: string;
  edge: string;
  hatch?: string;
}

export interface ColourLegend {
  title: string;
  /** One line under the entries, e.g. what "Up to" means. */
  note?: string;
  /** Lay the entries out in columns (PIAA's 12 districts). */
  columns?: number;
  entries: ColourLegendEntry[];
}

/** Per-district values the legend counts (from the index). */
export interface ColourValues {
  f: number;
  p: number;
  e: number;
}

const districts = (n: number) => `${n} ${n === 1 ? 'district' : 'districts'}`;
const fmt = (n: number) => n.toLocaleString('en-US');

export const enrollmentBin = (e: number) =>
  e > 0 ? ENROLLMENT_BREAKS.filter((b) => e >= b).length : -1;

export const enrollmentRangeLabel = (i: number) => {
  const lo = ENROLLMENT_BREAKS[i - 1];
  const hi = ENROLLMENT_BREAKS[i];
  if (lo === undefined) return `Under ${fmt(hi)}`;
  if (hi === undefined) return `${fmt(lo)} or more`;
  return `${fmt(lo)}–${fmt(hi - 1)}`;
};

/** The map key's legend for a mode, with district counts; `null` for default. */
export const colourLegend = (
  mode: ColourBy,
  values: readonly ColourValues[],
  season?: string,
  theme: ThemeId = 'classic',
): ColourLegend | null => {
  const P = colourPalettes(theme);
  const edgeFor = (fill: string) => edgeOf(fill, theme);
  const count = (test: (v: ColourValues) => boolean) =>
    districts(values.filter(test).length);
  switch (mode) {
    case 'football':
      return {
        title: 'PIAA football class',
        note: `${season ? `${season}. ` : ''}Districts with several high schools take their largest class.`,
        entries: [
          ...P.football
            .map((fill, i) => ({
              id: CLASS_NAMES[i],
              label: CLASS_NAMES[i],
              count: count((v) => v.f === i + 1),
              fill,
              edge: edgeFor(fill),
            }))
            .reverse(),
          {
            id: 'none',
            label: 'No PIAA football',
            count: count((v) => !v.f),
            fill: P.noFootball.fill,
            edge: P.noFootball.hatch,
            hatch: P.noFootball.hatch,
          },
        ],
      };
    case 'piaa':
      return {
        title: 'PIAA district',
        columns: 2,
        entries: [
          ...P.piaa.map((fill, i) => ({
            id: ROMAN[i],
            label: ROMAN[i],
            count: String(values.filter((v) => v.p === i + 1).length),
            fill,
            edge: edgeFor(fill),
          })),
          ...(values.some((v) => !v.p)
            ? [
                {
                  id: 'unknown',
                  label: 'Unknown',
                  count: String(values.filter((v) => !v.p).length),
                  fill: P.unknown,
                  edge: edgeFor(P.unknown),
                },
              ]
            : []),
        ],
        note: 'Numbers are school districts in each PIAA district.',
      };
    case 'enrollment':
      return {
        title: 'Students in grades 9–11',
        note: 'PIAA’s count for every public high school in the district.',
        entries: [
          ...P.enrollment
            .map((fill, i) => ({
              id: `e${i}`,
              label: enrollmentRangeLabel(i),
              count: count((v) => enrollmentBin(v.e) === i),
              fill,
              edge: edgeFor(fill),
            }))
            .reverse(),
          {
            id: 'unknown',
            label: 'No PIAA data',
            count: count((v) => !(v.e > 0)),
            fill: P.unknown,
            edge: edgeFor(P.unknown),
          },
        ],
      };
    default:
      return null;
  }
};

/* ---- URL ----------------------------------------------------------------- */

export const COLOUR_PARAM = 'colour';

/** The shared mode in `?colour=`, or `undefined` when absent or unknown. */
export const parseColourBy = (search: string): ColourBy | undefined => {
  const raw = new URLSearchParams(search).get(COLOUR_PARAM)?.trim();
  return isColourBy(raw) ? raw : undefined;
};

/** Sets `?colour=` (or removes it for the default), keeping every other parameter. */
export const colourSearch = (search: string, mode: ColourBy) => {
  const params = new URLSearchParams(search);
  if (mode === 'default') params.delete(COLOUR_PARAM);
  else params.set(COLOUR_PARAM, mode);
  const query = params.toString();
  return query ? `?${query}` : '';
};

/* ---- Contrast ------------------------------------------------------------ */

/** Text-on-fill pairs that must pass WCAG AA (both map styles); checked in tokens.test.ts. */
export const COLOUR_BY_CONTRAST_PAIRS: Array<
  [name: string, fg: string, bg: string]
> = (['classic', 'textbook'] as const).flatMap((theme) => {
  const P = colourPalettes(theme);
  const tag = theme === 'textbook' ? 'B ' : '';
  return [
    ...P.football.map((c, i) => [`${CLASS_NAMES[i]} football fill`, c]),
    ['no-football fill', P.noFootball.fill],
    ...P.piaa.map((c, i) => [`PIAA ${ROMAN[i]} fill`, c]),
    ...P.enrollment.map((c, i) => [`enrollment step ${i + 1} fill`, c]),
    ['unknown fill', P.unknown],
  ].map(([name, bg]): [string, string, string] => [
    `${tag}district names on ${name}`,
    inkOf(theme),
    bg,
  ]);
});
