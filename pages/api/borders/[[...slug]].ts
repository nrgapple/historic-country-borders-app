import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import { NextApiHandler } from 'next';
import polylabel from 'polylabel';
import stc from 'string-to-color';
import PolygonArea from '@turf/area';
import { CountryData } from '../../../util/types';
import {
  stringToBrightHexColor,
  stringToVibrantHexColor,
  stringToVibrantHexColor2,
} from '../../../util/stringToColor';

const REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const YEAR_PART = /^(?:[0-9]{1,4}|[0-9]{1,4}bc)$/;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

async function fetchJson(url: string): Promise<FeatureCollection> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  const contentLength = Number(response.headers.get('content-length'));
  if (contentLength > MAX_SOURCE_BYTES)
    throw new Error('Upstream data is too large');
  const text = await response.text();
  if (Buffer.byteLength(text) > MAX_SOURCE_BYTES) {
    throw new Error('Upstream data is too large');
  }
  const value = JSON.parse(text);
  if (value?.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    throw new Error('Upstream data is not a FeatureCollection');
  }
  return value as FeatureCollection;
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = req.query.slug;
  if (
    !Array.isArray(slug) ||
    slug.length !== 3 ||
    !REPOSITORY_PART.test(slug[0]) ||
    !REPOSITORY_PART.test(slug[1]) ||
    slug[0].includes('..') ||
    slug[1].includes('..') ||
    !YEAR_PART.test(slug[2])
  ) {
    return res.status(400).json({ error: 'Invalid border request' });
  }

  const [user, id, year] = slug;
  const root = `https://raw.githubusercontent.com/${user}/${id}/master/geojson`;

  try {
    const [mapData, placesData] = await Promise.all([
      fetchJson(`${root}/world_${year}.geojson`),
      fetchJson(`${root}/places.geojson`),
    ]);
    const data = processData(mapData);
    const places = getPlaces(year, placesData);
    return res.json({ data, places });
  } catch (error) {
    console.error('Border data request failed:', error);
    return res
      .status(502)
      .json({ error: 'Border data is temporarily unavailable' });
  }
};

export default handler;

// Generate classic school atlas colors - bright, distinct, educational
const generateTextbookColor = (inputString: string): string => {
  const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  // Classic school atlas color palette - bright, distinct colors
  const atlasColors = [
    '#FF6B6B', // Coral Red
    '#4ECDC4', // Turquoise
    '#45B7D1', // Sky Blue
    '#FFA07A', // Light Salmon
    '#98D8C8', // Mint Green
    '#F7DC6F', // Golden Yellow
    '#BB8FCE', // Medium Purple
    '#85C1E9', // Light Blue
    '#F8C471', // Orange
    '#82E0AA', // Light Green
    '#F1C40F', // Bright Yellow
    '#E74C3C', // Red
    '#3498DB', // Blue
    '#2ECC71', // Green
    '#9B59B6', // Purple
    '#E67E22', // Orange
    '#1ABC9C', // Teal
    '#34495E', // Dark Gray
    '#F39C12', // Dark Orange
    '#D35400', // Dark Orange Red
    '#27AE60', // Dark Green
    '#2980B9', // Dark Blue
    '#8E44AD', // Dark Purple
    '#16A085', // Dark Teal
    '#F4D03F', // Light Yellow
    '#58D68D', // Medium Green
    '#5DADE2', // Medium Blue
    '#AF7AC5', // Light Purple
    '#F8D7DA', // Light Pink
    '#D5DBDB', // Light Gray
  ];

  const hashValue = Math.abs(hash(inputString));
  return atlasColors[hashValue % atlasColors.length];
};

const getPlaces = (year: string, placesData?: FeatureCollection) => {
  return placesData
    ? ({
        type: 'FeatureCollection',
        features: placesData.features.filter((f) => {
          const since = f.properties?.inhabitedSince;
          const done = f.properties?.inhabitedUntil;
          const yearNumber = Number(year.replace(/bc/g, '-'));
          if (since) {
            if (done) {
              return yearNumber >= since && yearNumber <= done;
            }
            return yearNumber >= since;
          }
          return false;
        }) as Feature[],
      } as FeatureCollection)
    : ({ type: 'FeatureCollection', features: [] } as FeatureCollection);
};

const processData = (data: FeatureCollection) => {
  const dataNoUnclaimed = {
    ...data,
    features: data.features.filter(
      (f) =>
        f.properties?.NAME != null &&
        f.properties?.NAME != 'unclaimed' &&
        f.properties?.NAME != 'Antarctica',
    ),
  };

  const featureParts = dataNoUnclaimed.features
    .filter((x) => (x.geometry as MultiPolygon).coordinates?.length)
    .map((feature) => {
      const name = feature.properties?.NAME ?? 'unclaimed';
      const { NAME, SUBJECTO } = feature.properties as Record<string, string>;
      const color = generateTextbookColor(`${SUBJECTO ?? NAME}`);
      const labels = (feature.geometry as MultiPolygon).coordinates
        .map((x, i) => {
          const polyFeat = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: x,
            } as Polygon,
          } as Feature<Polygon>;
          return {
            labelCords: polylabel(x),
            area: PolygonArea(polyFeat),
          };
        })
        .map(({ labelCords, area }) => ({
          geometry: {
            type: 'Point',
            coordinates: labelCords,
          } as Point,
          properties: {
            ...feature.properties,
            NAME: name,
            COLOR: color,
            AREA: area,
          } as GeoJsonProperties,
        })) as Feature[];
      const maxArea = Math.max(...labels.map((x) => x.properties!.AREA));
      const label = labels.find((x) => x.properties!.AREA === maxArea);
      const bounds = {
        geometry: feature.geometry,
        properties: {
          ...feature.properties,
          COLOR: color,
          NAME: name,
        } as GeoJsonProperties,
      } as Feature;
      return {
        bounds,
        labels: [label],
      };
    });
  const labelCol = {
    ...data,
    //@ts-ignore
    features: featureParts.map((x) => x.labels).flat(1),
  } as FeatureCollection;
  const boundCol = {
    ...data,
    features: featureParts.map((x) => x.bounds),
  } as FeatureCollection;
  return {
    labels: labelCol,
    borders: boundCol,
  } as CountryData;
};
