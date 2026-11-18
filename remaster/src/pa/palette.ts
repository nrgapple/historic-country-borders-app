/**
 * The default ("Distinct colours") district fills for the Pennsylvania map,
 * per map style: each district's wash slot `c` (assigned at build time so
 * neighbours differ) picks from A's hand-tinted washes or B's textbook
 * pastels. The "Colour districts by" modes read their palettes from
 * `colourPalettes(theme)` in colourBy.ts; paStyle.ts reads only these two
 * modules for district colour.
 */
import type { ExpressionSpecification } from 'maplibre-gl';
import { THEME_TOKENS, type ThemeId } from '../styles/tokens';

type Expr = ExpressionSpecification;

/** The vector-tile attribute holding a district's palette slot (0–11). */
export const DISTRICT_WASH_ATTR = 'c';

export interface DistrictPalette {
  /** One fill per slot, in slot order. */
  fills: readonly string[];
  /** The same hue, darker: B's border line and A's inner edge band. */
  edges: readonly string[];
}

export const districtPalette = (theme: ThemeId): DistrictPalette => {
  const { washes } = THEME_TOKENS[theme];
  return {
    fills: washes.map((w) => w.fill),
    edges: washes.map((w) => w.edge),
  };
};

const bySlot = (colors: readonly string[]): Expr =>
  [
    'match',
    ['get', DISTRICT_WASH_ATTR],
    ...colors.flatMap((color, i) => [i, color]),
    colors[0],
  ] as unknown as Expr;

/** Each district's fill colour in the theme. */
export const districtFill = (theme: ThemeId): Expr =>
  bySlot(districtPalette(theme).fills);

/** Each district's darker same-hue edge in the theme. */
export const districtEdge = (theme: ThemeId): Expr =>
  bySlot(districtPalette(theme).edges);
