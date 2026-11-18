import type { Feature, Geometry, Position } from 'geojson';

/**
 * Helpers for the "Find a place" combobox: building a de-duplicated index of
 * the loaded features, matching names, and framing a result on the map.
 * Everything runs on data the browser has already downloaded.
 */

export type Bounds = [[number, number], [number, number]];

export interface PlaceOption {
  /** The feature `NAME`; also the selection key and the `?place=` value. */
  name: string;
  /** Text shown in the result list. */
  label: string;
  /** Secondary line, e.g. a county. */
  detail?: string;
  /** Extra searchable text that ranks below the label, e.g. a county name. */
  keywords: string[];
}

export const MAX_RESULTS = 8;

/** Case- and diacritic-insensitive form: "Kraków" → "krakow". */
export const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const wordStarts = (text: string, query: string) =>
  text.split(/[\s\-–—'’(),/]+/).some((word) => word.startsWith(query));

/** Lower is better; `undefined` means no match. */
const rank = (option: PlaceOption, query: string): number | undefined => {
  const label = normalizeSearchText(option.label);
  if (label.startsWith(query)) return 0;
  if (wordStarts(label, query)) return 1;
  if (label.includes(query)) return 2;
  const keywords = option.keywords.map(normalizeSearchText);
  if (keywords.some((keyword) => keyword.startsWith(query))) return 3;
  if (keywords.some((keyword) => wordStarts(keyword, query))) return 4;
  if (keywords.some((keyword) => keyword.includes(query))) return 5;
  return undefined;
};

/** Prefix matches first, then word prefixes, then substrings; A–Z within each. */
export const searchPlaces = (
  options: readonly PlaceOption[],
  query: string,
  limit = MAX_RESULTS,
): PlaceOption[] => {
  const needle = normalizeSearchText(query);
  if (!needle) return [];
  return options
    .map((option) => ({ option, score: rank(option, needle) }))
    .filter(
      (entry): entry is { option: PlaceOption; score: number } =>
        entry.score !== undefined,
    )
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.option.label.localeCompare(b.option.label, 'en', {
          sensitivity: 'base',
        }),
    )
    .slice(0, limit)
    .map((entry) => entry.option);
};

const featureName = (feature: Feature) => {
  const name = feature.properties?.NAME;
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
};

interface OptionBuilder {
  label?: (properties: Record<string, unknown>) => string | undefined;
  detail?: (properties: Record<string, unknown>) => string | undefined;
  keywords?: (properties: Record<string, unknown>) => string[];
}

/** One option per distinct `NAME`; a territory can span several features. */
export const placeOptionsFromFeatures = (
  features: readonly Feature[],
  builder: OptionBuilder = {},
): PlaceOption[] => {
  const options = new Map<string, PlaceOption>();
  features.forEach((feature) => {
    const name = featureName(feature);
    if (!name || options.has(name)) return;
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    options.set(name, {
      name,
      label: builder.label?.(properties) ?? name,
      detail: builder.detail?.(properties),
      keywords: builder.keywords?.(properties) ?? [],
    });
  });
  return Array.from(options.values());
};

export const featuresNamed = (features: readonly Feature[], name: string) =>
  features.filter((feature) => featureName(feature) === name);

const eachPosition = (
  geometry: Geometry | null | undefined,
  visit: (position: Position) => void,
) => {
  if (!geometry) return;
  switch (geometry.type) {
    case 'Point':
      visit(geometry.coordinates);
      break;
    case 'MultiPoint':
    case 'LineString':
      geometry.coordinates.forEach(visit);
      break;
    case 'MultiLineString':
    case 'Polygon':
      geometry.coordinates.forEach((line) => line.forEach(visit));
      break;
    case 'MultiPolygon':
      geometry.coordinates.forEach((polygon) =>
        polygon.forEach((ring) => ring.forEach(visit)),
      );
      break;
    case 'GeometryCollection':
      geometry.geometries.forEach((child) => eachPosition(child, visit));
      break;
  }
};

/**
 * The bounding box of every feature's geometry. When a territory straddles the
 * antimeridian (e.g. Russia, which reaches Alaska in some years) the box is
 * expressed with an eastern edge past 180° so the map frames the short way.
 */
export const featureBounds = (
  features: readonly Feature[],
): Bounds | undefined => {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  // The same box with western-hemisphere longitudes shifted by +360°.
  let shiftedWest = Infinity;
  let shiftedEast = -Infinity;

  features.forEach((feature) =>
    eachPosition(feature.geometry, ([lng, lat]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
      const shifted = lng < 0 ? lng + 360 : lng;
      shiftedWest = Math.min(shiftedWest, shifted);
      shiftedEast = Math.max(shiftedEast, shifted);
    }),
  );

  if (!Number.isFinite(south)) return undefined;
  if (shiftedEast - shiftedWest < east - west) {
    return [
      [shiftedWest, south],
      [shiftedEast, north],
    ];
  }
  return [
    [west, south],
    [east, north],
  ];
};

export interface FocusPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Matches the 640px breakpoint where the panel becomes a bottom sheet. */
const PHONE_MAX_WIDTH = 640;
const PANEL_WIDTH = 380;
const MIN_VISIBLE = 80;

const fit = (a: number, b: number, available: number): [number, number] => {
  const room = available - MIN_VISIBLE;
  if (a + b <= room) return [a, b];
  const scale = Math.max(0, room) / (a + b);
  return [Math.floor(a * scale), Math.floor(b * scale)];
};

/**
 * Camera padding that keeps a framed place clear of the top bar and the
 * details panel: a left-hand card on wider screens, a bottom sheet on phones.
 */
export const focusPadding = ({
  width,
  height,
  topbarBottom = 0,
}: {
  width: number;
  height: number;
  topbarBottom?: number;
}): FocusPadding => {
  const phone = width <= PHONE_MAX_WIDTH;
  const raw: FocusPadding = phone
    ? {
        top: topbarBottom + 16,
        right: 24,
        bottom: Math.round(height * 0.52) + 16,
        left: 24,
      }
    : {
        top: topbarBottom + 24,
        right: 72,
        bottom: 56,
        left: Math.min(PANEL_WIDTH, width - 24) + 12 + 32,
      };
  const [left, right] = fit(raw.left, raw.right, width);
  const [top, bottom] = fit(raw.top, raw.bottom, height);
  return { top, right, bottom, left };
};

/** Shift from the canvas centre to the centre of the padded area, in pixels. */
export const paddingOffset = (padding: FocusPadding): [number, number] => [
  (padding.left - padding.right) / 2,
  (padding.top - padding.bottom) / 2,
];
