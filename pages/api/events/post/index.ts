import { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

interface PostRequestProps {
  title: string;
  content: string;
  year: number;
  lat: number;
  long: number;
  actualDate: Date;
}

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const {
    title,
    content,
    year,
    lat,
    long,
    actualDate,
  } = req.body as PostRequestProps;
  const result = await prisma.mapEvent.create({
    data: {
      title,
      content,
      year,
      lat,
      long,
      actualDate,
    },
  });
  res.json(result);
}
