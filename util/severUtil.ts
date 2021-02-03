import { Feature, FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import prisma from '../lib/prisma';
import { rowToFeature } from './clientUtil';
import { mapEventPropertiesType, YearEventsRowType } from './types';

export const getEventsForYear = async (year: number) => {
  try {
    const result = (await prisma.mapEvent.findMany({
      where: { published: true, year: year },
      include: {
        author: {
          select: { name: true },
        },
      },
    })) as YearEventsRowType[];
    if (result.length < 1) {
      return null;
    }
    const features = result.map((x) => rowToFeature(x));
    const collection = {
      type: 'FeatureCollection',
      features,
    } as FeatureCollection;
    return collection;
  } catch (e) {
    console.log(e);
    return null;
  }
};
