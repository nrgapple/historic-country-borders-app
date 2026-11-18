import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isSourceStale,
  schoolDistricts,
  usePASchoolDistricts,
  validateSchoolDistrictArtifact,
} from '../../hooks/usePASchoolDistricts';

const artifact = {
  schemaVersion: 1,
  source: {
    title: 'Fixture districts',
    publisher: 'Fixture publisher',
    vintage: '2025-10',
    sourceUrl: 'https://example.com/source',
    metadataUrl: 'https://example.com/metadata',
    accessConstraints: 'None',
    license: 'Fixture terms',
    disclaimer: 'Fixture disclaimer',
    retrievedAt: '2026-09-02T00:00:00Z',
    sha256: 'fixture',
  },
  validation: {
    districtCount: 1,
    geometryCounts: { Polygon: 1, MultiPolygon: 0 },
    requiredProperties: ['SCHOOL_NAM'],
  },
  data: {
    labels: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-77.6, 41] },
          properties: { NAME: 'Fixture' },
        },
      ],
    },
    borders: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-77.7, 40.9],
                [-77.5, 40.9],
                [-77.5, 41.1],
                [-77.7, 40.9],
              ],
            ],
          },
          properties: { NAME: 'Fixture' },
        },
      ],
    },
  },
  places: { type: 'FeatureCollection', features: [] },
};

beforeEach(() => schoolDistricts.clear());
afterEach(() => vi.unstubAllGlobals());

describe('usePASchoolDistricts', () => {
  it('reports loading and then validated static data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => artifact }),
    );
    const { result } = renderHook(() => usePASchoolDistricts());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.data.borders.features).toHaveLength(1);
    expect(result.current.isEmpty).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/data/pa-school-districts.json',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('reports empty and malformed artifacts distinctly', async () => {
    const empty = structuredClone(artifact);
    empty.data.borders.features = [];
    empty.data.labels.features = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => empty }),
    );
    const emptyResult = renderHook(() => usePASchoolDistricts());
    await waitFor(() => expect(emptyResult.result.current.isEmpty).toBe(true));

    expect(() => validateSchoolDistrictArtifact({ schemaVersion: 1 })).toThrow(
      'artifact is malformed',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ schemaVersion: 1 }),
      }),
    );
    schoolDistricts.clear();
    const malformedResult = renderHook(() => usePASchoolDistricts());
    await waitFor(() =>
      expect(malformedResult.result.current.isError).toBeTruthy(),
    );
  });

  it('reports unavailable static data and exposes a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    const { result } = renderHook(() => usePASchoolDistricts());
    await waitFor(() => expect(result.current.isError).toBeTruthy());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.retry).toEqual(expect.any(Function));
  });

  it('deduplicates cold-load consumers and classifies source vintage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => artifact });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(
      () => [usePASchoolDistricts(), usePASchoolDistricts()] as const,
    );
    await waitFor(() => expect(result.current[1].data).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(isSourceStale('2025-10', new Date('2026-09-02'))).toBe(false);
    expect(isSourceStale('2025-10', new Date('2027-04-01'))).toBe(true);
    expect(isSourceStale('unknown', new Date('2026-09-02'))).toBe(true);
  });
});
