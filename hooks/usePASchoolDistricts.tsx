import { createResource, fetchJson, useResource } from '../lib/resource';
import { BordersEndpointData } from '../util/types';

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

export interface SchoolDistrictArtifact extends BordersEndpointData {
  schemaVersion: number;
  source: SchoolDistrictSource;
  validation: {
    districtCount: number;
    geometryCounts: { Polygon: number; MultiPolygon: number };
    requiredProperties: string[];
  };
}

export const PA_SCHOOL_DISTRICTS_URL = '/data/pa-school-districts.json';
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

export const validateSchoolDistrictArtifact = (
  value: unknown,
): SchoolDistrictArtifact => {
  const artifact = value as SchoolDistrictArtifact;
  if (
    !artifact ||
    artifact.schemaVersion !== 1 ||
    !artifact.source?.vintage ||
    artifact.data?.borders?.type !== 'FeatureCollection' ||
    artifact.data?.labels?.type !== 'FeatureCollection' ||
    !Array.isArray(artifact.data.borders.features) ||
    artifact.data.labels.features.length !==
      artifact.data.borders.features.length
  ) {
    throw new Error('The school district artifact is malformed.');
  }
  return artifact;
};

/** The artifact is ~12 MB parsed; one copy is plenty. */
export const schoolDistricts = createResource(
  async (url, signal) =>
    validateSchoolDistrictArtifact(await fetchJson<unknown>(url, signal)),
  { maxEntries: 1 },
);

export const usePASchoolDistricts = () => {
  const { value, isLoading, error, retry } = useResource(
    schoolDistricts,
    PA_SCHOOL_DISTRICTS_URL,
  );

  return {
    data: value,
    isLoading,
    isEmpty: Boolean(value && value.data.borders.features.length === 0),
    isError: error,
    isStale: Boolean(value && isSourceStale(value.source.vintage)),
    retry,
  } as const;
};
