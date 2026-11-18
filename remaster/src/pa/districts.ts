/**
 * District formatting and finder options, ported from the current app's
 * components/SchoolDistrictsAtlas.tsx (same output, same tests).
 */
import type { PlaceFact } from '../components/PlacePanel';
import type { PlaceOption } from '../lib/places';
import type { Bbox } from '../atlas/store';
import { CLASS_NAMES, piaaName } from './colourBy';
import type { DistrictSports } from './usePASchoolDistricts';

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
  sports?: DistrictSports | null;
}

/** Finder values for PIAA districts and football classes (never district names). */
export const PIAA_PREFIX = 'piaa:';
export const CLASS_PREFIX = 'class:';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "Up to 6A · 3 schools" or "6A"; undefined without football. */
export const footballLine = (sports: DistrictSports | null | undefined) => {
  if (!sports?.football) return undefined;
  return sports.footballSchools > 1
    ? `Up to ${sports.football} · ${sports.footballSchools} schools`
    : sports.football;
};

/** The second line of a district name per colour mode (label properties). */
export const sportsLabelLines = (sports: DistrictSports | null | undefined) => {
  const lines: Record<'sf' | 'sp' | 'se', string> = {} as never;
  if (!sports) return lines;
  const football = footballLine(sports);
  if (football) lines.sf = football;
  else if (sports.schools.length) lines.sf = 'No PIAA football';
  if (sports.piaa) lines.sp = piaaName(sports.piaa);
  if (sports.enrollment) lines.se = `${fmt(sports.enrollment)} students`;
  return lines;
};

/**
 * Panel facts from PIAA: PIAA district, football class and grade 9–11
 * enrollment, each credited to PIAA with the season.
 */
export const sportsFacts = (
  sports: DistrictSports | null | undefined,
  source: { season: string; enrollmentDate: string },
): PlaceFact[] => {
  if (sports === undefined) return [];
  if (sports === null)
    return [
      {
        label: 'PIAA high school',
        value: 'None listed',
        detail: 'Students may attend another district’s high school',
        source: 'PIAA',
      },
    ];
  const facts: PlaceFact[] = [];
  if (sports.piaa) {
    const others = (sports.piaaAll ?? []).filter((p) => p !== sports.piaa);
    facts.push({
      label: 'PIAA district',
      value: piaaName(sports.piaa),
      detail: others.length
        ? `Some schools: ${others.map(piaaName).join(', ')}`
        : undefined,
      source: 'PIAA',
    });
  }
  const football = sports.schools.filter((s) => s.football);
  facts.push({
    label: 'Football class',
    value: sports.football
      ? football.length > 1
        ? `Up to ${sports.football}`
        : sports.football
      : 'No PIAA football team',
    detail: [
      football.length > 1
        ? `${plural(football.length, 'high school team')}, listed below`
        : football.length === 1
          ? `${football[0].name}${football[0].coop ? ' (co-op team)' : ''}`
          : sports.schools.length
            ? 'Students may play for a neighbouring school’s co-op team'
            : undefined,
      `${source.season} seasons`,
    ]
      .filter(Boolean)
      .join(' · '),
    source: 'PIAA',
  });
  if (sports.enrollment)
    facts.push({
      label: 'High-school enrollment, grades 9–11',
      value: fmt(sports.enrollment),
      detail: `${sports.boys ? `${fmt(sports.boys)} boys · ` : ''}${plural(sports.schools.length, 'public high school')} · reported ${source.enrollmentDate}`,
      source: 'PIAA',
    });
  return facts;
};

/** "6A" → 6; anything else → 0. */
export const classRank = (value: string | null | undefined) =>
  value ? CLASS_NAMES.indexOf(value as (typeof CLASS_NAMES)[number]) + 1 : 0;

/** The union of a set of boxes, or undefined when empty. */
export const unionBounds = (boxes: readonly Bbox[]): Bbox | undefined => {
  if (!boxes.length) return undefined;
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
};

/** Every district in a PIAA district (by number) or football class ("6A"). */
export const groupMembers = (
  districts: readonly Locatable[],
  value: string,
): Locatable[] => {
  if (value.startsWith(PIAA_PREFIX)) {
    const n = Number(value.slice(PIAA_PREFIX.length));
    return districts.filter((d) => d.sports?.piaa === n);
  }
  if (value.startsWith(CLASS_PREFIX)) {
    const cls = value.slice(CLASS_PREFIX.length);
    return districts.filter((d) => d.sports?.football === cls);
  }
  return [];
};

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
      keywords: [name, county, d.sports?.football ?? undefined].filter(
        (v): v is string => Boolean(v),
      ),
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
  // "District III" or "6A": frame the group and colour the map by it.
  const piaa = new Map<number, number>();
  const classes = new Map<string, number>();
  for (const d of districts) {
    if (d.sports?.piaa)
      piaa.set(d.sports.piaa, (piaa.get(d.sports.piaa) ?? 0) + 1);
    if (d.sports?.football)
      classes.set(d.sports.football, (classes.get(d.sports.football) ?? 0) + 1);
  }
  for (const n of [...piaa.keys()].sort((a, b) => a - b))
    options.push({
      name: `${PIAA_PREFIX}${n}`,
      label: `PIAA ${piaaName(n)}`,
      detail: `${plural(piaa.get(n)!, 'school district')} · colours by PIAA district`,
      keywords: [piaaName(n), `District ${n}`, `D${n}`],
    });
  for (const cls of CLASS_NAMES)
    if (classes.has(cls))
      options.push({
        name: `${CLASS_PREFIX}${cls}`,
        label: `${cls} football`,
        detail: `${plural(classes.get(cls)!, 'school district')} · colours by football class`,
        keywords: [`Class ${cls}`, 'A'.repeat(Number(cls[0]))],
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
