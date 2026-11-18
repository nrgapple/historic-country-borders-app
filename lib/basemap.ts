import type { StyleSpecification } from 'mapbox-gl';

/**
 * A deliberately plain physical basemap for historical maps, like the base
 * layer of a textbook atlas: land, sea, major rivers and gentle relief.
 *
 * It has no modern country borders, roads, or place names — those would be
 * anachronistic under a historical map and confuse students — and it loads
 * far less than Mapbox Standard, which matters on school Chromebooks.
 */
export const HISTORICAL_BASEMAP: StyleSpecification = {
  version: 8,
  name: 'Historic Borders physical atlas',
  glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
  projection: { name: 'mercator' },
  sources: {
    streets: {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-streets-v8',
    },
    relief: {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 8,
    },
  },
  layers: [
    {
      id: 'land',
      type: 'background',
      paint: { 'background-color': '#EEE9DD' },
    },
    {
      id: 'relief',
      type: 'hillshade',
      source: 'relief',
      paint: {
        'hillshade-exaggeration': 0.28,
        'hillshade-shadow-color': '#7D7462',
        'hillshade-highlight-color': '#FFFBF2',
        'hillshade-accent-color': '#8E846F',
      },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'streets',
      'source-layer': 'water',
      paint: { 'fill-color': '#BFD5DA' },
    },
    {
      id: 'rivers',
      type: 'line',
      source: 'streets',
      'source-layer': 'waterway',
      minzoom: 4,
      filter: ['==', ['get', 'class'], 'river'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#A9C7CE',
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 2.2],
      },
    },
  ],
};
