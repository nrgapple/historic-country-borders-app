/**
 * The district property index (P5): ported from hooks/usePASchoolDistricts.tsx.
 *
 * The old Next.js app downloaded one 11.5 MB GeoJSON artifact. This app draws
 * the polygons from a district vector-tile tree and downloads only this
 * index: every district's properties, bounds and label point (~150 KB raw),
 * with the same provenance record. See docs/PA_SCHOOL_DISTRICTS.md
 * ("Site data format").
 */
import pa from '../data/pa.json';
import { createResource, fetchJson, useResource } from '../lib/resource';

export interface SchoolDistrictSource {
  title: string;
  publisher: string;
  vintage: string;
  sourceUrl: string;
  metadataUrl: string;
  accessConstraints: string;
  license: string;
  disclaimer: string;
  retrievedAt: string;
  sha256: string;
}

/** One PIAA member high school of a district (data/pa-sports.json). */
export interface SportsSchool {
  /** PIAA directory id (`/schools/directory/details.aspx?ID=`). */
  id: number;
  name: string;
  /** PIAA football class "1A"–"6A", or null without a PIAA football team. */
  football: string | null;
  /** The football team is a cooperative sponsorship with another school. */
  coop?: boolean;
  /** PIAA classification enrollment, grades 9–11. */
  total: number | null;
  boys: number | null;
}

/** PIAA facts for a district; null when PIAA lists none of its schools. */
export interface DistrictSports {
  /** PIAA district 1–12 (most of its schools'). */
  piaa: number | null;
  /** Every PIAA district its schools play in, when they differ. */
  piaaAll?: number[];
  /** The largest football class among its schools. */
  football: string | null;
  footballSchools: number;
  enrollment: number | null;
  boys: number | null;
  schools: SportsSchool[];
}

export interface SportsSource {
  publisher: string;
  url: string;
  /** "2026-27 and 2027-28". */
  season: string;
  /** "October 2025". */
  enrollmentDate: string;
  enrollmentBasis: string;
  retrievedAt: string;
}

export interface District {
  /** Feature id in the district tiles and index into `districts`. */
  id: number;
  NAME: string;
  SCHOOL_NAM?: string;
  SCHOOL_DIS?: string;
  CTY_NAME?: string;
  IU_NAME?: string;
  IU_NUM?: string;
  AUN_NUM?: string;
  AVTS?: string;
  /** Area in km². */
  km2: number;
  /** [west, south, east, north]. */
  bbox: [number, number, number, number];
  /** Interior label point [lng, lat]. */
  label: [number, number];
  /** PIAA sports facts (absent in an index built before them). */
  sports?: DistrictSports | null;
}

export interface DistrictIndex {
  schemaVersion: 2;
  source: SchoolDistrictSource;
  validation: {
    districtCount: number;
    geometryCounts: { Polygon: number; MultiPolygon: number };
    requiredProperties: string[];
  };
  sportsSource?: SportsSource;
  /** One label point per PIAA district. */
  piaaLabels?: Array<{
    piaa: number;
    districts: number;
    label: [number, number];
  }>;
  districts: District[];
}

export const PA_DISTRICTS_URL = pa.indexUrl;
export const STALE_AFTER_MONTHS = 18;

export const isSourceStale = (
  vintage: string,
  now = new Date(),
  staleAfterMonths = STALE_AFTER_MONTHS,
): boolean => {
  const match = /^(\d{4})-(\d{2})$/.exec(vintage);
  if (!match) return true;
  const vintageDate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1),
  );
  const staleDate = new Date(vintageDate);
  staleDate.setUTCMonth(staleDate.getUTCMonth() + staleAfterMonths);
  return now >= staleDate;
};

const isBox = (value: unknown) =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((v) => typeof v === 'number' && Number.isFinite(v));

export const validateDistrictIndex = (value: unknown): DistrictIndex => {
  const index = value as DistrictIndex;
  if (
    !index ||
    index.schemaVersion !== 2 ||
    !index.source?.vintage ||
    !Array.isArray(index.districts) ||
    !index.districts.every(
      (d, i) =>
        d &&
        d.id === i &&
        typeof d.NAME === 'string' &&
        d.NAME.trim() !== '' &&
        isBox(d.bbox) &&
        Array.isArray(d.label) &&
        d.label.length === 2,
    )
  ) {
    throw new Error('The school district index is malformed.');
  }
  return index;
};

/** One index is ever needed; it is small. */
export const schoolDistricts = createResource(
  async (url, signal) =>
    validateDistrictIndex(await fetchJson<unknown>(url, signal)),
  { maxEntries: 1 },
);

export const loadDistrictIndex = (signal?: AbortSignal) =>
  schoolDistricts.load(PA_DISTRICTS_URL, signal);

export const usePASchoolDistricts = () => {
  const { value, isLoading, error, retry } = useResource(
    schoolDistricts,
    PA_DISTRICTS_URL,
  );

  return {
    data: value,
    isLoading,
    isEmpty: Boolean(value && value.districts.length === 0),
    isError: error,
    isStale: Boolean(value && isSourceStale(value.source.vintage)),
    retry,
  } as const;
};
