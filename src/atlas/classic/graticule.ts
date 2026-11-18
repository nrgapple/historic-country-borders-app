import type { FeatureCollection, LineString } from 'geojson';

/** 10° graticule as GeoJSON (about 4 kB), generated client-side. */
export function graticule(
  step = 10,
): FeatureCollection<LineString, { kind: string; value: number }> {
  const features: FeatureCollection<
    LineString,
    { kind: string; value: number }
  >['features'] = [];
  for (let lon = -180; lon <= 180; lon += step) {
    features.push({
      type: 'Feature',
      properties: { kind: 'meridian', value: lon },
      geometry: {
        type: 'LineString',
        coordinates: [
          [lon, -80],
          [lon, 84],
        ],
      },
    });
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const coordinates: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 5) coordinates.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { kind: lat === 0 ? 'equator' : 'parallel', value: lat },
      geometry: { type: 'LineString', coordinates },
    });
  }
  return { type: 'FeatureCollection', features };
}
