/// <reference lib="webworker" />
/**
 * Fetches a year's polygons (the same immutable URL MapLibre's worker reads,
 * so one download serves both through the HTTP cache) and triangulates them
 * off the main thread.
 */
import { triangulate } from './geometry';

export interface GeometryRequest {
  id: number;
  year: number;
  url: string;
}

self.onmessage = async (event: MessageEvent<GeometryRequest>) => {
  const { id, year, url } = event.data;
  try {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const geometry = triangulate(year, await response.json());
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(
      { id, geometry },
      [geometry.positions.buffer, geometry.ids.buffer, geometry.indices.buffer],
    );
  } catch (error) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      id,
      error: String(error),
    });
  }
};
