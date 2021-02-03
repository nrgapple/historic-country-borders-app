import { FeatureCollection } from 'geojson';

export const getMapEvents = async (year: number) => {
  const resp = await fetch(`http://localhost:3000/api/events/${year}`);
  if (resp.status === 204) {
    return null;
  }
  const data = (await resp.json()) as FeatureCollection;
  return data;
};
