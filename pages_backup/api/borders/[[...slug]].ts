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

const handler: NextApiHandler = async (req, res) => {
  const { slug } = req.query;

  const [user, id, year] = slug ?? [];
  const url = `https://raw.githubusercontent.com/${user}/${id}/master/geojson/world_${year}.geojson`;

  try {
    const resp = await fetch(url);
    const placesResp = await fetch(
      `https://raw.githubusercontent.com/${user}/${id}/master/geojson/places.geojson`,
    );
    const mapData = await resp.json();
    const placesData = await placesResp.json();
    const data = processData(mapData as FeatureCollection);
    const places = getPlaces(year, placesData);
    return res.json({ data, places });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error });
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
