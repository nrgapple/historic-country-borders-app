import { FeatureCollection } from 'geojson';
import { NextApiRequest, NextApiResponse } from 'next';
import { getEventsForYear } from '../../../util/severUtil';

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse<FeatureCollection>,
) {
  const year = parseInt(req.query.year as string);
  const collection = await getEventsForYear(year);
  if (!collection) {
    res.status(204).end();
    return;
  }
  res.json(collection);
}
