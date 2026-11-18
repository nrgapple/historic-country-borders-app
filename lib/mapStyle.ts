import type { ExpressionSpecification } from 'mapbox-gl';
import type { Settings } from '../contexts/SettingsContext';

/**
 * The data pipelines assign each feature one of 30 legacy "flat UI" colors.
 * The map remaps them to a muted atlas palette at render time so the published
 * data stays stable and the visual theme can change without a data refresh.
 */
const SOURCE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E9',
  '#F8C471',
  '#82E0AA',
  '#F1C40F',
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#9B59B6',
  '#E67E22',
  '#1ABC9C',
  '#34495E',
  '#F39C12',
  '#D35400',
  '#27AE60',
  '#2980B9',
  '#8E44AD',
  '#16A085',
  '#F4D03F',
  '#58D68D',
  '#5DADE2',
  '#AF7AC5',
  '#F8D7DA',
  '#D5DBDB',
];

export const ATLAS_PALETTE = [
  '#DCBDAD',
  '#B2D7C9',
  '#CE9CD3',
  '#C8D49B',
  '#C6D4E2',
  '#E4C3CA',
  '#ADDCB1',
  '#C0B2D7',
  '#D3C19C',
  '#9BD4D2',
  '#E2C6DB',
  '#D2E4C3',
  '#ADB5DC',
  '#D7B6B2',
  '#9CD3B3',
  '#C49BD4',
  '#E1E2C6',
  '#C3DAE4',
  '#DCADC0',
  '#B6D7B2',
  '#A69CD3',
  '#D4B59B',
  '#C6E2DB',
  '#E4C3E3',
  '#CCDCAD',
  '#B2C0D7',
  '#D39CA1',
  '#9BD4A7',
  '#D4C6E2',
  '#E4DDC3',
];

const FALLBACK_FILL = '#D9D4C7';

export const fillColorExpression = [
  'match',
  ['upcase', ['to-string', ['get', 'COLOR']]],
  ...SOURCE_COLORS.flatMap((color, index) => [color, ATLAS_PALETTE[index]]),
  FALLBACK_FILL,
] as unknown as ExpressionSpecification;

export const INK = '#2B2824';
export const HALO = 'rgba(255, 253, 248, 0.92)';
export const SELECTED_STROKE = '#8F2D1C';

const LABEL_SIZES: Record<Settings['textSize'], [number, number]> = {
  small: [9, 16],
  medium: [10.5, 19],
  large: [12.5, 23],
};

export const labelSizeExpression = (
  textSize: Settings['textSize'],
  [zoomMin, zoomMax]: [number, number],
) => {
  const [min, max] = LABEL_SIZES[textSize] ?? LABEL_SIZES.medium;
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    zoomMin,
    min,
    zoomMax,
    max,
  ] as unknown as ExpressionSpecification;
};

export const placeSizeExpression = (textSize: Settings['textSize']) => {
  const scale = textSize === 'small' ? 0.85 : textSize === 'large' ? 1.2 : 1;
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    3,
    9 * scale,
    7,
    13 * scale,
  ] as unknown as ExpressionSpecification;
};

/** Border width grows with zoom; `thickness` is the user's 0–4 preference. */
export const borderWidthExpression = (thickness: number) =>
  [
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    thickness * 0.35,
    6,
    thickness * 0.8,
    10,
    thickness * 1.4,
  ] as unknown as ExpressionSpecification;

export const selectedWidthExpression = (thickness: number) =>
  [
    'interpolate',
    ['linear'],
    ['zoom'],
    2,
    Math.max(1.6, thickness * 0.9),
    8,
    Math.max(3, thickness * 1.8),
  ] as unknown as ExpressionSpecification;

/** Selected features gain opacity; others keep the user's opacity. */
export const fillOpacityExpression = (
  opacity: number,
  selectedName: string | undefined,
) =>
  selectedName
    ? ([
        'case',
        ['==', ['get', 'NAME'], selectedName],
        Math.min(1, opacity + 0.2),
        opacity,
      ] as unknown as ExpressionSpecification)
    : opacity;

/** Modern streets and town names help people locate their district. */
export const SCHOOL_MAP_STYLE_URL = 'mapbox://styles/mapbox/light-v11';
export const LABEL_FONT = ['Lato Bold'];
