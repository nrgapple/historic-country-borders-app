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

const handler: NextApiHandler = async (req, res) => {
  const { slug } = req.query;

  const [user, id, year] = slug;
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
    .filter((x) => (x.geometry as MultiPolygon).coordinates.length)
    .map((feature) => {
      const name = feature.properties?.NAME ?? 'unclaimed';
      const { NAME, SUBJECTO } = feature.properties as Record<string, string>;
      const color = stc(SUBJECTO ?? NAME);
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
