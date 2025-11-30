import useSWR from 'swr';
import { BordersEndpointData } from '../util/types';
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Polygon,
  Point,
} from 'geojson';
import PolygonArea from '@turf/area';
import { CountryData } from '../util/types';

// Generate classic school atlas colors
const generateTextbookColor = (inputString: string): string => {
  const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  const atlasColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    '#F1C40F', '#E74C3C', '#3498DB', '#2ECC71', '#9B59B6',
    '#E67E22', '#1ABC9C', '#34495E', '#F39C12', '#D35400',
    '#27AE60', '#2980B9', '#8E44AD', '#16A085', '#F4D03F',
    '#58D68D', '#5DADE2', '#AF7AC5', '#F8D7DA', '#D5DBDB',
  ];

  const hashValue = Math.abs(hash(inputString));
  return atlasColors[hashValue % atlasColors.length];
};

// Calculate centroid efficiently - sample points to avoid memory issues
const calculateCentroid = (coordinates: number[][][]): [number, number] => {
  if (!coordinates[0] || coordinates[0].length === 0) {
    return [0, 0];
  }
  
  const ring = coordinates[0];
  const ringLength = ring.length;
  
  // For very large polygons, sample points to avoid memory issues
  const maxSamplePoints = 500;
  const step = ringLength > maxSamplePoints ? Math.ceil(ringLength / maxSamplePoints) : 1;
  
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  
  for (let i = 0; i < ringLength; i += step) {
    const point = ring[i];
    if (point && point.length >= 2) {
      sumLng += point[0];
      sumLat += point[1];
      count++;
    }
  }
  
  return count > 0 ? [sumLng / count, sumLat / count] : [0, 0];
};

const processData = (data: FeatureCollection): CountryData => {
  const labels: Feature[] = [];
  const borders: Feature[] = [];

  for (const feature of data.features) {
    if (!feature.properties?.SCHOOL_NAM) continue;

    const geometry = feature.geometry as Polygon;
    if (!geometry?.coordinates?.length) continue;

    const name = feature.properties.SCHOOL_NAM;
    const color = generateTextbookColor(name);
    
    // Calculate area - skip if it fails
    let featureArea = 0;
    try {
      featureArea = PolygonArea({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: geometry.coordinates,
        },
        properties: {},
      } as Feature<Polygon>);
    } catch (e) {
      // Area calculation is optional, continue without it
    }
    
    // Use centroid for label placement - much faster and more reliable than polylabel
    const labelCoords = calculateCentroid(geometry.coordinates);
    
    labels.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: labelCoords,
      } as Point,
      properties: {
        NAME: name,
        COLOR: color,
        AREA: featureArea,
        SCHOOL_NAM: name,
        SCHOOL_DIS: feature.properties.SCHOOL_DIS,
        CTY_NAME: feature.properties.CTY_NAME,
        IU_NAME: feature.properties.IU_NAME,
        IU_NUM: feature.properties.IU_NUM,
        AUN_NUM: feature.properties.AUN_NUM,
        AVTS: feature.properties.AVTS,
      } as GeoJsonProperties,
    });
    
    borders.push({
      type: 'Feature',
      geometry: feature.geometry,
      properties: {
        ...feature.properties,
        COLOR: color,
        NAME: name,
      } as GeoJsonProperties,
    });
  }

  return {
    labels: {
      type: 'FeatureCollection',
      features: labels,
    } as FeatureCollection,
    borders: {
      type: 'FeatureCollection',
      features: borders,
    } as FeatureCollection,
  };
};

const fetcher = async (url: string): Promise<BordersEndpointData> => {
  // Fetch the GeoJSON file directly from public folder
  const response = await fetch('/PaSchoolDistricts2025_10.geojson');
  const mapData = await response.json() as FeatureCollection;
  
  // Process on client side
  const data = processData(mapData);
  const places = { type: 'FeatureCollection', features: [] } as FeatureCollection;
  
  return { data, places };
};

export const usePASchoolDistricts = () => {
  const { data, error } = useSWR<BordersEndpointData>(
    '/PaSchoolDistricts2025_10.geojson',
    fetcher
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
  } as const;
};

