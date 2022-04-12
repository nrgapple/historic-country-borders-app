import { Feature, FeatureCollection } from 'geojson';
import { Layout } from 'mapbox-gl';

export interface GithubFileInfoType {
  name: string;
  path: string;
  size: number;
  url: string;
  type: FileType;
  download_url: string;
}

type FileType = 'dir' | 'file';

export interface ConfigType {
  name: string;
  description?: string;
  default?: boolean;
  commitDate?: string;
}

export interface Theater {
  id: number;
  feature: Feature;
  title: string;
  created?: number;
  lastUse?: number;
  capacity?: number;
  emperor?: string;
  chronoGroup?: string;
  latintoponym?: string;
}

export interface FeatureCollectionOptStyle extends FeatureCollection {
  style?: MapStyle;
}

export interface MapStyle {
  layout?: Layout;
  image?: MapImage;
}

export interface MapImage {
  url: string;
  id: string;
}

export interface CountryData {
  labels: FeatureCollection;
  borders: FeatureCollection;
}

export interface BordersEndpointData {
  data: CountryData;
  places: FeatureCollection;
}
