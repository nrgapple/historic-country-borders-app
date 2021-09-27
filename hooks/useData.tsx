import type {
  FeatureCollection,
  GeoJsonProperties,
  Feature,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson';
import { useEffect, useState } from 'react';
import stc from 'string-to-color';
import polylabel from 'polylabel';
import { yearPrefix } from '../util/constants';
import PolygonArea from '@turf/area';

export interface CountryData {
  labels: FeatureCollection;
  borders: FeatureCollection;
}

export const useData = (year: string, user: string, id: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [data, setData] = useState<CountryData | undefined>(undefined);

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
    const featureParts = dataNoUnclaimed.features.map((feature) => {
      const name = feature.properties?.NAME ?? 'unclaimed';
      const color = stc(name);
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
        labels,
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

  useEffect(() => {
    if (year) {
      setIsLoading(true);
      setUrl(
        `https://raw.githubusercontent.com/${user}/${id}/master/geojson/world_${year}.geojson`,
      );
    }
  }, [year]);

  useEffect(() => {
    if (url) {
      (async () => {
        try {
          const resp = await fetch(url);
          const mapData = await resp.json();
          setData(processData(mapData as FeatureCollection));
        } catch (error) {
          console.error(error);
        }
      })();
    }
  }, [url]);

  useEffect(() => {
    if (data) {
      setIsLoading(false);
    }
  }, [data]);

  return [isLoading, data] as const;
};
