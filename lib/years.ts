/**
 * Year formatting and era grouping for the timeline.
 *
 * Years are stored as signed integers: negative values are BC, positive are AD.
 * There is no year zero in the source data (1 BC is stored as -1).
 */

export interface Era {
  id: string;
  label: string;
  shortLabel: string;
  /** Inclusive lower bound; the first era has no lower bound. */
  from: number;
}

/** Ordered oldest → newest. Boundaries are conventional, not authoritative. */
export const ERAS: readonly Era[] = [
  {
    id: 'prehistory',
    label: 'Prehistory',
    shortLabel: 'Prehist.',
    from: -Infinity,
  },
  { id: 'ancient', label: 'Ancient', shortLabel: 'Ancient', from: -3000 },
  { id: 'medieval', label: 'Medieval', shortLabel: 'Medieval', from: 500 },
  {
    id: 'early-modern',
    label: 'Early modern',
    shortLabel: 'Early mod.',
    from: 1500,
  },
  { id: 'modern', label: 'Modern', shortLabel: 'Modern', from: 1800 },
];

export const eraOf = (year: number): Era => {
  for (let index = ERAS.length - 1; index >= 0; index -= 1) {
    if (year >= ERAS[index].from) return ERAS[index];
  }
  return ERAS[0];
};

export interface EraSpan {
  era: Era;
  /** Index of the first year in this era within the sorted years array. */
  start: number;
  /** Number of years in this era. */
  count: number;
}

/** Groups a sorted list of years into contiguous era spans. */
export const eraSpans = (years: readonly number[]): EraSpan[] => {
  const spans: EraSpan[] = [];
  years.forEach((year, index) => {
    const era = eraOf(year);
    const last = spans[spans.length - 1];
    if (last && last.era.id === era.id) {
      last.count += 1;
    } else {
      spans.push({ era, start: index, count: 1 });
    }
  });
  return spans;
};

const numberFormat = new Intl.NumberFormat('en-US');

export interface YearParts {
  /** Magnitude, grouped for readability (e.g. "123,000"). */
  value: string;
  /** "BC" or "AD". */
  suffix: 'BC' | 'AD';
}

export const yearParts = (year: number): YearParts => ({
  value: year < 0 ? numberFormat.format(-year) : String(year),
  suffix: year < 0 ? 'BC' : 'AD',
});

/** Compact label: "500 BC", "1492". AD is implied for positive years. */
export const formatYear = (year: number): string =>
  year < 0 ? `${numberFormat.format(-year)} BC` : String(year);

/** Unambiguous label for assistive technology and metadata: "1492 AD". */
export const formatYearLong = (year: number): string => {
  const { value, suffix } = yearParts(year);
  return `${value} ${suffix}`;
};

/** Parses a route segment such as "1492" or "-500" against the known years. */
export const parseYearParam = (
  value: string | string[] | undefined,
  years: readonly number[],
): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^-?\d+$/.test(raw)) return undefined;
  const year = Number(raw);
  return years.includes(year) ? year : undefined;
};

export const yearPath = (year: number) => `/year/${year}`;
