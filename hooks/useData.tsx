import type {
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Point,
  Polygon,
  Feature,
} from 'geojson';
import { useEffect, useMemo, useState } from 'react';
import stc from 'string-to-color';
import polylabel from 'polylabel';
import { convertYearString, mapBCFormat, yearPrefix } from '../util/constants';
import PolygonArea from '@turf/area';

export interface CountryData {
  labels: FeatureCollection;
  borders: FeatureCollection;
}

export const useData = (year: string, user: string, id: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [data, setData] = useState<CountryData | undefined>(undefined);
  const [placesData, setPlacesData] = useState<FeatureCollection | undefined>(
    undefined,
  );

  const places = useMemo(
    () =>
      placesData
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
        : ({ type: 'FeatureCollection' } as FeatureCollection),
    [year, placesData],
  );

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
        const color = stc('a' + name + 'p');
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
        if (!label) {
          console.log(feature);
        }
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
          const placesResp = await fetch(
            `https://raw.githubusercontent.com/${user}/${id}/master/geojson/places.geojson`,
          );
          const mapData = await resp.json();
          const pd = await placesResp.json();
          setPlacesData(pd);
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

  return [isLoading, data, places] as const;
};
