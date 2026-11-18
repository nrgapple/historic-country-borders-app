import { formatYear, formatYearLong } from './years';

/** Wikidata lifespan as published in public/data/context/*.json (`existed`). */
export interface Existed {
  start?: number;
  end?: number;
  startApprox?: boolean;
  endApprox?: boolean;
}

/**
 * Years are signed with no year zero: 1 BC (-1) is followed by AD 1.
 * Astronomical numbering (1 BC = 0, 2 BC = -1) makes differences exact.
 */
export const toAstronomical = (year: number) => (year < 0 ? year + 1 : year);

/** Elapsed years from `from` to `to`, counting across the missing year zero. */
export const yearsBetween = (from: number, to: number) =>
  toAstronomical(to) - toAstronomical(from);

export type MarkerPlacement = 'within' | 'before' | 'after';

export interface LifespanEnd {
  year: number;
  approx: boolean;
  /** "c. 1299", "500 BC", "476 AD" (AD only when the span crosses the eras). */
  label: string;
}

export interface LifespanLayout {
  start: LifespanEnd;
  end: LifespanEnd;
  /** The map year on the bar, clamped to its ends. */
  marker: {
    year: number;
    /** 0 at the start, 1 at the end. */
    position: number;
    placement: MarkerPlacement;
    label: string;
  };
  /** One sentence for assistive technology. */
  description: string;
}

const endLabel = (year: number, approx: boolean, long: boolean) =>
  `${approx ? 'c. ' : ''}${long ? formatYearLong(year) : formatYear(year)}`;

/**
 * Lays out the "Key dates" lifespan bar. Returns null, so the bar is hidden,
 * unless both ends are known: nothing is invented (plan §2.1).
 */
export const lifespanLayout = (
  existed: Existed | undefined,
  mapYear: number,
): LifespanLayout | null => {
  const start = existed?.start;
  const end = existed?.end;
  if (
    start === undefined ||
    end === undefined ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start === 0 ||
    end === 0 ||
    end < start
  )
    return null;
  const crossesEras = start < 0 && end > 0;
  const startApprox = Boolean(existed?.startApprox);
  const endApprox = Boolean(existed?.endApprox);
  const span = yearsBetween(start, end);
  const placement: MarkerPlacement =
    mapYear < start ? 'before' : mapYear > end ? 'after' : 'within';
  const position =
    placement === 'before'
      ? 0
      : placement === 'after'
        ? 1
        : span === 0
          ? 0.5
          : yearsBetween(start, mapYear) / span;
  const startLabel = endLabel(start, startApprox, crossesEras);
  const endLabelText = endLabel(end, endApprox, crossesEras);
  const map = formatYearLong(mapYear);
  const label =
    placement === 'within'
      ? 'This map'
      : placement === 'before'
        ? `This map (${map}) is earlier`
        : `This map (${map}) is later`;
  const relation =
    placement === 'within'
      ? 'falls within it'
      : placement === 'before'
        ? 'is before it began'
        : 'is after it ended';
  return {
    start: { year: start, approx: startApprox, label: startLabel },
    end: { year: end, approx: endApprox, label: endLabelText },
    marker: { year: mapYear, position, placement, label },
    description: `Existed ${startLabel} to ${endLabelText}. This map, ${map}, ${relation}.`,
  };
};
