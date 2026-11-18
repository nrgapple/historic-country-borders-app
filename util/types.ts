import type { FeatureCollection, Point } from 'geojson';

export interface ConfigType {
  name: string;
  description?: string;
  commitDate?: string;
}

export interface CountryData {
  labels: FeatureCollection<Point>;
  borders: FeatureCollection;
}

/** Shape of every published per-year historical payload and the school artifact. */
export interface BordersEndpointData {
  data: CountryData;
  places: FeatureCollection<Point>;
}
