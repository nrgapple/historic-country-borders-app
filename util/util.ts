import { Feature, FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import prisma from '../lib/prisma';
import { YearEventsRowType } from './types';

export const fetchMapEvents = async (year: number) => {
  const resp = await fetch(`/api/events/${year}`);
  if (resp.status === 204) {
    return null;
  }
  const data = (await resp.json()) as FeatureCollection;
  return data;
};

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
    return null;
  }
};

const rowToFeature = (row: YearEventsRowType) => {
  const feature = {
    geometry: {
      type: 'Point',
      coordinates: [row.long, row.lat],
    },
    properties: {
      id: row.long,
      title: row.title,
      content: row.content,
      author: row.author.name,
      actualDate: row.actualDate.toUTCString(),
      flagged: row.flagged,
    } as GeoJsonProperties,
  } as Feature<Point>;
  return feature;
};
