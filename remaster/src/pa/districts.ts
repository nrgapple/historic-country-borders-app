/**
 * District formatting and finder options, ported from the current app's
 * components/SchoolDistrictsAtlas.tsx (same output, same tests).
 */
import type { PlaceFact } from '../components/PlacePanel';
import type { PlaceOption } from '../lib/places';
import type { Bbox } from '../atlas/store';

/** Any record with the PASDA property names; districts and test fixtures. */
export type DistrictProperties = Partial<
  Record<
    | 'NAME'
    | 'SCHOOL_NAM'
    | 'SCHOOL_DIS'
    | 'CTY_NAME'
    | 'IU_NAME'
    | 'IU_NUM'
    | 'AUN_NUM'
    | 'AVTS',
    unknown
  >
>;

/** Official spellings the source stores in capitals, e.g. "Central IU 10". */
const ACRONYMS: Record<string, string> = {
  arin: 'ARIN',
  avts: 'AVTS',
  blast: 'BLaST',
  ctc: 'CTC',
  iu: 'IU',
  pa: 'PA',
  sd: 'SD',
};
const MINOR_WORDS = new Set(['and', 'for', 'of', 'the']);

/** "PHILADELPHIA IU 26" → "Philadelphia IU 26"; "MCKEAN" → "McKean". */
export const titleCase = (value: string) =>
  value.toLowerCase().replace(/[a-z]+/g, (word, offset: number) => {
    if (ACRONYMS[word]) return ACRONYMS[word];
    if (offset > 0 && MINOR_WORDS.has(word)) return word;
    if (/^mc[a-z]/.test(word))
      return `Mc${word[2].toUpperCase()}${word.slice(3)}`;
    return word[0].toUpperCase() + word.slice(1);
  });

export const text = (value: unknown) =>
  typeof value === 'string' && value.trim() && value.trim() !== 'NULL'
    ? value.trim()
    : undefined;

export const districtFacts = (properties: DistrictProperties): PlaceFact[] => {
  const facts: PlaceFact[] = [];
  const county = text(properties.CTY_NAME);
  const unit = text(properties.IU_NAME);
  const career = text(properties.AVTS);
  const aun = text(properties.AUN_NUM);
  if (county) facts.push({ label: 'County', value: titleCase(county) });
  if (unit) facts.push({ label: 'Intermediate unit', value: titleCase(unit) });
  if (career)
    facts.push({
      label: 'Career & technical school',
      value: titleCase(career),
    });
  if (aun)
    facts.push({ label: 'Administrative unit number (AUN)', value: aun });
  return facts;
};

/** "Pen Argyl Area SD" → "Pen Argyl Area School District". */
export const districtFullName = (properties: DistrictProperties) => {
  const full = text(properties.SCHOOL_DIS) ?? text(properties.NAME) ?? '';
  return full.replace(/\bSD$/, 'School District');
};

/** "2025-10" → "October 2025" (or "Oct 2025"). */
export const formatVintage = (
  vintage: string,
  month: 'long' | 'short' = 'long',
) => {
  const match = /^(\d{4})-(\d{2})$/.exec(vintage);
  if (!match) return vintage;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1),
  ).toLocaleDateString('en-US', {
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });
};

/** "NORTHAMPTON" → "Northampton County". */
export const countyName = (properties: DistrictProperties) => {
  const county = text(properties.CTY_NAME);
  if (!county) return undefined;
  const name = county
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  return / county$/i.test(name) ? name : `${name} County`;
};

/** Finder values for counties are prefixed so they never collide with a district name. */
export const COUNTY_PREFIX = 'county:';

interface Locatable extends DistrictProperties {
  NAME: string;
  bbox: Bbox;
}

/**
 * The finder lists every district (matching its short name and county too)
 * and every county, which frames all of its districts.
 */
export const finderOptions = (districts: readonly Locatable[]) => {
  const options: PlaceOption[] = [];
  const counties = new Map<string, { label: string; count: number }>();
  const seen = new Set<string>();
  for (const d of districts) {
    const name = text(d.NAME);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const county = countyName(d);
    options.push({
      name,
      label: districtFullName(d) || name,
      detail: county,
      keywords: [name, county].filter((v): v is string => Boolean(v)),
    });
    if (county) {
      const entry = counties.get(county) ?? { label: county, count: 0 };
      entry.count += 1;
      counties.set(county, entry);
    }
  }
  for (const [county, { count }] of counties)
    options.push({
      name: `${COUNTY_PREFIX}${county}`,
      label: county,
      detail: `${count} ${count === 1 ? 'district' : 'districts'}`,
      keywords: [],
    });
  return options;
};

/** The union of the boxes of every district in a county. */
export const countyBounds = (
  districts: readonly Locatable[],
  county: string,
): Bbox | undefined => {
  const boxes = districts
    .filter((d) => countyName(d) === county)
    .map((d) => d.bbox);
  if (!boxes.length) return undefined;
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
};
