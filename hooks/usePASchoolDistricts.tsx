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

// Fetch through our API route to bypass CORS
const PASDA_GEOJSON_URL = '/api/pa-school-districts';
const DB_NAME = 'pa-school-districts-cache';
const DB_VERSION = 1;
const STORE_NAME = 'processed-data';
const CACHE_KEY = 'pa-districts-data';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Check if IndexedDB is available and usable
const isIndexedDBAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!window.indexedDB) return false;
  
  // Some browsers (like Firefox in private mode) have indexedDB but it throws errors
  // We'll catch those errors in the actual operations
  return true;
};

// IndexedDB helper functions for caching large data
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDBAvailable()) {
      reject(new Error('IndexedDB not available'));
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        // Common causes: private browsing mode, storage disabled, quota exceeded
        const error = request.error;
        console.warn('IndexedDB open failed:', error?.name, error?.message);
        reject(error || new Error('IndexedDB open failed'));
      };
      
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch (error) {
      // Catch synchronous errors (e.g., in private browsing mode)
      reject(error);
    }
  });
};

// Get cached data from IndexedDB
const getCachedData = async (): Promise<BordersEndpointData | null> => {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        // Check if cache is still valid
        const { data, expiry } = result;
        if (Date.now() > expiry) {
          // Cache expired, delete it
          deleteCachedData().then(() => resolve(null));
          return;
        }

        resolve(data as BordersEndpointData);
      };

      request.onerror = () => {
        console.warn('Failed to read from IndexedDB cache:', request.error);
        resolve(null);
      };
    });
  } catch (error) {
    console.warn('IndexedDB cache read error:', error);
    return null;
  }
};

// Save data to IndexedDB cache
const setCachedData = async (data: BordersEndpointData): Promise<void> => {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const expiry = Date.now() + CACHE_TTL_MS;
      
      const request = store.put({ data, expiry }, CACHE_KEY);

      request.onsuccess = () => {
        console.log('PA school districts data cached in IndexedDB');
        resolve();
      };

      request.onerror = () => {
        console.warn('Failed to write to IndexedDB cache:', request.error);
        // Don't reject - caching is optional, app should continue working
        resolve();
      };
    });
  } catch (error) {
    console.warn('IndexedDB cache write error:', error);
    // Don't throw - caching is optional
  }
};

// Delete cached data
const deleteCachedData = async (): Promise<void> => {
  if (!isIndexedDBAvailable()) {
    return;
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('Failed to delete from IndexedDB cache:', request.error);
        resolve();
      };
    });
  } catch (error) {
    console.warn('IndexedDB cache delete error:', error);
  }
};

const fetcher = async (url: string): Promise<BordersEndpointData> => {
  // Check cache first
  const cached = await getCachedData();
  if (cached) {
    console.log('PA school districts cache hit (IndexedDB)');
    return cached;
  }
  
  console.log('PA school districts cache miss - fetching from API');
  
  // Fetch through our API route (which handles CORS)
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch PA school districts: ${response.statusText}`);
  }
  
  // Note: Progress tracking doesn't work well through the API proxy
  // because the browser buffers the streamed response. We just show a loading toast instead.
  const mapData = await response.json() as FeatureCollection;
  
  // Process on client side
  const data = processData(mapData);
  const places = { type: 'FeatureCollection', features: [] } as FeatureCollection;
  
  const result = { data, places };
  
  // Cache the processed data in IndexedDB (async, don't wait)
  setCachedData(result).catch((error) => {
    console.warn('Failed to cache PA school districts data:', error);
  });
  
  return result;
};

export const usePASchoolDistricts = () => {
  const { data, error } = useSWR<BordersEndpointData>(
    PASDA_GEOJSON_URL,
    fetcher
  );

  return {
    data,
    isLoading: !error && !data,
    isError: error,
  } as const;
};

