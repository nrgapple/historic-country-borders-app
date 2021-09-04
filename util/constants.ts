import { FeatureCollection, MultiPolygon, Polygon, Feature } from 'geojson';
import { Theater } from './types';

export const dates = [
  -2000, -1000, -500, -323, -200, -1, 400, 600, 800, 1000, 1279, 1492, 1530,
  1650, 1715, 1783, 1815, 1880, 1914, 1920, 1938, 1945, 1994,
];

export const yearPrefix = 'historicborders-';

export const convertYearString = (
  format: (value: number) => string,
  year: number,
) => {
  if (year < 0) {
    return format(year);
  }
  return year.toString();
};

export const mapBCFormat = (value: number) => `bc${(value * -1).toString()}`;

export const timelineBCFormat = (value: number) =>
  `${(value * -1).toString()} BC`;

export const mod = (n: number, m: number) => {
  return ((n % m) + m) % m;
};

export const getYearFromFile = (fileName: string) =>
  parseInt(
    fileName
      .replace(/.geojson/g, '')
      .replace(/world_/g, '')
      .replace(/bc/g, '-'),
  );

export const githubToken = process.env.NEXT_PUBLIC_GITHUB_API;

export const multiPolygonToPolygon = (
  collection: FeatureCollection<MultiPolygon>,
): FeatureCollection<Polygon> => ({
  ...collection,
  features: collection.features
    .map((feat) =>
      feat.geometry.coordinates.map(
        (coord) =>
          ({
            ...feat,
            geometry: {
              ...feat.geometry,
              coordinates: coord,
              type: 'Polygon',
            } as Polygon,
          } as Feature<Polygon>),
      ),
    )
    //@ts-ignore
    .flat(1),
});

const padZero = (str: string, len: number = 2) => {
  var zeros = new Array(len).join('0');
  return (zeros + str).slice(-len);
};

export const invertColor = (hex: string, bw: boolean) => {
  if (hex.indexOf('#') === 0) {
    hex = hex.slice(1);
  }
  // convert 3-digit hex to 6-digits.
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) {
    throw new Error('Invalid HEX color.');
  }
  var r: string | number = parseInt(hex.slice(0, 2), 16),
    g: string | number = parseInt(hex.slice(2, 4), 16),
    b: string | number = parseInt(hex.slice(4, 6), 16);
  if (bw) {
    // http://stackoverflow.com/a/3943023/112731
    return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
  }
  // invert color components
  r = (255 - r).toString(16);
  g = (255 - g).toString(16);
  b = (255 - b).toString(16);
  // pad each with zeros and return
  return '#' + padZero(r) + padZero(g) + padZero(b);
};

export const amphitheaterDataSetup = (data: FeatureCollection) => {
  return data.features.map((f, i) => {
    return {
      id: i,
      feature: f,
      title: f.properties?.label ?? null,
      lastUse: f.properties?.lastUse?.date ?? null,
      created: f.properties?.created
        ? cleanDateErrors(f.properties?.created)
        : null,
      capacity: f.properties?.capacity?.quantity ?? null,
      emperor: f.properties?.emperor ?? null,
    } as Theater;
  });
};

export const cleanDateErrors = (date: number) => {
  return date > 1000 ? date / 10 : date;
};
