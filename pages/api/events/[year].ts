import { Feature, FeatureCollection, GeoJsonProperties, Point } from 'geojson';
import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

interface YearEventsRowType {
  id: number;
  title: string;
  content: string;
  year: number;
  lat: number;
  long: number;
  author: { name: string };
  flagged: boolean;
  actualDate: Date;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<FeatureCollection>,
) {
  const year = parseInt(req.query.year as string);
  console.log(year);
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
      res.status(204).end();
      return;
    }
    const features = result.map((x) => rowToFeature(x));
    const collection = {
      type: 'FeatureCollection',
      features,
    } as FeatureCollection;
    res.json(collection);
    return;
  } catch (e) {
    console.log(`api/events/${year}/`, e);
    res.status(204).end();
    return;
  }
}

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
      actualDate: row.actualDate,
      flagged: row.flagged,
    } as GeoJsonProperties,
  } as Feature<Point>;
  return feature;
};
