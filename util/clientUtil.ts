import { GeoJsonProperties, Feature, Point, FeatureCollection } from 'geojson';
import { YearEventsRowType, mapEventPropertiesType } from './types';

export const rowToFeature = (row: YearEventsRowType) => {
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

export const getCurrentEventProps = (
  mapEvents: FeatureCollection,
  currentEventId: number,
) => {
  return mapEvents.features.find((x) => x.properties!.id == currentEventId)
    ?.properties as mapEventPropertiesType;
};

export const fetchMapEvents = async (year: number) => {
  const resp = await fetch(`/api/events/${year}`);
  if (resp.status === 204) {
    return null;
  }
  const data = (await resp.json()) as FeatureCollection;
  return data;
};
