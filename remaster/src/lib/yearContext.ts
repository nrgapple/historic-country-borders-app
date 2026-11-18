/**
 * Per-year context published by `yarn data:refresh:context`: a few
 * source-linked Wikidata facts per territory plus a "what changed" summary
 * computed from our own border data. See docs/HISTORICAL_CONTEXT.md.
 */
import type { PlaceFact } from '../components/PlacePanel';
import { formatYear } from './years';

export interface ContextValue {
  qid: string;
  label: string;
  start?: number;
  end?: number;
  startApprox?: boolean;
  endApprox?: boolean;
}

export interface PlaceContext {
  qid: string;
  wikipedia?: string;
  existed?: {
    start?: number;
    end?: number;
    startApprox?: boolean;
    endApprox?: boolean;
  };
  capital?: ContextValue[];
  headOfState?: ContextValue[];
  /** Set when head of state comes from holders of this office (P1906 → P39). */
  headOfStateOffice?: string;
  headOfGovernment?: ContextValue[];
}

export interface TerritoryChange {
  name: string;
  field: 'subjectTo' | 'partOf';
  from: string | null;
  to: string | null;
}

export interface YearChanges {
  previousYear: number;
  appeared: string[];
  disappeared: string[];
  changed: TerritoryChange[];
}

export interface YearContext {
  schemaVersion: 1;
  year: number;
  source: { name: string; license: string; retrievedAt: string };
  places: Record<string, PlaceContext>;
  changes: YearChanges | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** Shape check for a fetched context file; details are validated at build. */
export const validateYearContext = (value: unknown): YearContext => {
  const context = value as YearContext;
  const changes = context?.changes;
  if (
    !isRecord(context) ||
    context.schemaVersion !== 1 ||
    !Number.isInteger(context.year) ||
    !isRecord(context.places) ||
    (changes !== null &&
      (!isRecord(changes) ||
        !Number.isInteger(changes.previousYear) ||
        !isStringArray(changes.appeared) ||
        !isStringArray(changes.disappeared) ||
        !Array.isArray(changes.changed)))
  ) {
    throw new Error('The year context data is malformed.');
  }
  return context;
};

export const WIKIDATA_SOURCE = 'Wikidata';

export const wikidataUrl = (qid: string, property?: string) =>
  `https://www.wikidata.org/wiki/${qid}${property ? `#${property}` : ''}`;

const yearText = (year: number, approx?: boolean) =>
  `${approx ? 'c. ' : ''}${formatYear(year)}`;

/**
 * "1299–1922 AD", "c. 3100–30 BC", "27 BC – 476 AD". Era markers are written
 * once when both ends share an era.
 */
export const formatYearRange = (
  start: number,
  end: number,
  { startApprox = false, endApprox = false } = {},
): string => {
  const magnitude = (year: number) =>
    formatYear(-Math.abs(year)).replace(/ BC$/, '');
  if (start > 0 && end > 0)
    return `${startApprox ? 'c. ' : ''}${start}–${endApprox ? 'c. ' : ''}${end} AD`;
  if (start < 0 && end < 0)
    return `${startApprox ? 'c. ' : ''}${magnitude(start)}–${endApprox ? 'c. ' : ''}${magnitude(end)} BC`;
  return `${yearText(start, startApprox)} – ${yearText(end, endApprox)} AD`;
};

const termText = (value: ContextValue): string => {
  if (value.start !== undefined && value.end !== undefined) {
    if (value.start === value.end)
      return `${value.label} (${yearText(value.start, value.startApprox)})`;
    return `${value.label} (${formatYearRange(value.start, value.end, value)})`;
  }
  if (value.start !== undefined)
    return `${value.label} (from ${yearText(value.start, value.startApprox)})`;
  if (value.end !== undefined)
    return `${value.label} (until ${yearText(value.end, value.endApprox)})`;
  return value.label;
};

const existedFact = (
  place: PlaceContext,
): Omit<PlaceFact, 'href' | 'source'> | undefined => {
  const existed = place.existed;
  if (!existed) return undefined;
  const { start, end } = existed;
  if (start !== undefined && end !== undefined)
    return { label: 'Existed', value: formatYearRange(start, end, existed) };
  if (start !== undefined)
    return {
      label: 'Founded',
      value: yearText(start, existed.startApprox),
    };
  if (end !== undefined)
    return { label: 'Ended', value: yearText(end, existed.endApprox) };
  return undefined;
};

/**
 * Source-linked facts for a territory in the loaded year, ready for the
 * place panel. Each links to the Wikidata statement it came from.
 */
export const contextFacts = (
  context: YearContext | undefined,
  name: string,
): PlaceFact[] => {
  const place = context?.places[name];
  if (!place) return [];
  const facts: PlaceFact[] = [];
  const add = (
    label: string,
    values: ContextValue[] | undefined,
    href: string,
    format: (value: ContextValue) => string,
  ) => {
    if (!values?.length) return;
    facts.push({
      label,
      value: values.map(format).join('; '),
      href,
      source: WIKIDATA_SOURCE,
    });
  };
  add(
    'Capital',
    place.capital,
    wikidataUrl(place.qid, 'P36'),
    (value) => value.label,
  );
  add(
    'Head of state',
    place.headOfState,
    place.headOfStateOffice
      ? wikidataUrl(place.headOfStateOffice)
      : wikidataUrl(place.qid, 'P35'),
    termText,
  );
  add(
    'Head of government',
    place.headOfGovernment,
    wikidataUrl(place.qid, 'P6'),
    termText,
  );
  const existed = existedFact(place);
  if (existed)
    facts.push({
      ...existed,
      href: wikidataUrl(place.qid),
      source: WIKIDATA_SOURCE,
    });
  return facts;
};
