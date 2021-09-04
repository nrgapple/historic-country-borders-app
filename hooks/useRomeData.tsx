import { Feature, FeatureCollection, GeoJsonProperties } from 'geojson';
import { SymbolLayout } from 'mapbox-gl';
import { useEffect, useState } from 'react';
import { FeatureCollectionOptStyle, MapStyle, Theater } from '../util/types';
import {
  oldLayout,
  inUseLayout,
  deadLayout,
  currentLayout,
} from '../util/mapStyles';

export type TheaterData = [
  old: FeatureCollectionOptStyle,
  dead: FeatureCollectionOptStyle,
  inUse: FeatureCollectionOptStyle,
  current: FeatureCollectionOptStyle,
  //unknowns: FeatureCollection,
];

export const useRomeData = (year: number, theaters: Theater[]) => {
  const [data, setData] = useState<TheaterData | []>([]);

  const diff = (main: Theater[], other: Theater[]) =>
    main.filter((x) => !other.includes(x));

  const injectLayout = (fe: FeatureCollection, style: MapStyle) =>
    ({
      ...fe,
      style,
    } as FeatureCollection);

  const toFeatureCollection = (theaters: Theater[]) => {
    return {
      type: 'FeatureCollection',
      features: theaters.map(
        ({
          feature: { geometry },
          title,
          created,
          lastUse,
          capacity,
          emperor,
          chronoGroup,
          id,
        }) =>
          ({
            type: 'Feature',
            geometry: geometry,
            properties: {
              id,
              title,
              created,
              lastUse,
              capacity,
              emperor,
              chronoGroup,
            } as GeoJsonProperties,
          } as Feature),
      ),
    } as FeatureCollection;
  };

  const convert = (year: number, theaters: Theater[]) => {
    const currentTh = theaters.filter((x) => x.created === year);
    const notCurrent = diff(theaters, currentTh);
    const unknowns = notCurrent.filter((x) => !x.created);
    const notUnknown = diff(notCurrent, unknowns);
    const inUses = notUnknown.filter((x) => {
      if (x.lastUse) {
        return year > x.created! && year < x.lastUse;
      }
      return Math.abs(x.created! - year) < 100;
    });
    const notInUses = diff(notUnknown, inUses);
    const notBorn = notInUses.filter((x) => x.created! > year);
    const live = diff(notInUses, notBorn);
    const deads = live.filter((x) => {
      if (x.lastUse) {
        return year > x.lastUse;
      }
      return false;
    });
    const notDeads = diff(live, deads);

    const olds = notDeads.filter((x) => x.created !== year);

    setData(
      (curr) =>
        [
          injectLayout(toFeatureCollection(olds), oldLayout),
          injectLayout(toFeatureCollection(deads), deadLayout),
          injectLayout(toFeatureCollection(inUses), inUseLayout),
          injectLayout(toFeatureCollection(currentTh), currentLayout),
          //toFeatureCollection(unknowns),
        ] as TheaterData,
    );
  };

  useEffect(() => {
    if (year && theaters) {
      convert(year, theaters);
    }
  }, [year, theaters]);

  return data;
};
