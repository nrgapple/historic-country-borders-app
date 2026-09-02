import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PASchoolDistrictsMapContainer from '../../components/PASchoolDistrictsMapContainer';
import { usePASchoolDistricts } from '../../hooks/usePASchoolDistricts';

vi.mock('../../hooks/usePASchoolDistricts', () => {
  const result = {
    data: {
      source: {
        vintage: '2025-10',
        metadataUrl: 'https://example.com/metadata',
      },
      data: {
        labels: { type: 'FeatureCollection', features: [] },
        borders: {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { NAME: 'Fixture Area' } }],
        },
      },
    },
    isLoading: false,
    isEmpty: false,
    isError: undefined,
    isStale: false,
    retry: vi.fn(),
  };
  return { usePASchoolDistricts: vi.fn(() => result) };
});

vi.mock('../../hooks/useMapQuery', () => ({
  useMapQuery: () => ({
    viewState: undefined,
    updateMapView: vi.fn(),
    isReady: true,
  }),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: {} }),
}));

vi.mock('../../hooks/useCountryInfo', () => ({
  useCountryInfo: () => ({ info: 'Not Found', title: '', isLoading: false }),
}));

vi.mock('../../util/MapboxDefaultMap', async () => {
  const ReactModule = await import('react');
  return {
    default: ReactModule.forwardRef(function FixtureMap(props: any, ref) {
      ReactModule.useImperativeHandle(ref, () => ({
        getMap: () => ({
          off: vi.fn(),
          on: vi.fn(),
          isStyleLoaded: () => false,
        }),
      }));
      return (
        <button
          type="button"
          onClick={() =>
            props.onClick({
              originalEvent: { stopPropagation: vi.fn() },
              lngLat: { lng: -77.6, lat: 41 },
              features: [
                {
                  properties: {
                    NAME: 'Fixture Area',
                    SCHOOL_NAM: 'Fixture Area',
                    SCHOOL_DIS: 'Fixture Area SD',
                    CTY_NAME: 'Fixture County',
                    AUN_NUM: '100000001',
                  },
                },
              ],
            })
          }
        >
          Select fixture district
        </button>
      );
    }),
  };
});

vi.mock('react-ga4', () => ({
  default: { event: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: { loading: vi.fn(), dismiss: vi.fn() },
}));

describe('PASchoolDistrictsMapContainer', () => {
  it('displays the selected fixture district details', () => {
    render(<PASchoolDistrictsMapContainer />);

    expect(screen.getByText(/District boundaries: 2025-10/)).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Select fixture district' }),
    );

    expect(screen.getAllByText('Fixture Area')).toHaveLength(2);
    expect(screen.getByText('Fixture Area SD')).toBeVisible();
    expect(screen.getByText('Fixture County')).toBeVisible();
    expect(screen.getByText('100000001')).toBeVisible();
  });

  it('shows useful loading, empty, unavailable, and stale states', () => {
    const hook = vi.mocked(usePASchoolDistricts);
    const ready = hook();

    hook.mockReturnValue({ ...ready, data: undefined, isLoading: true } as any);
    const loading = render(<PASchoolDistrictsMapContainer />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading school district map',
    );
    loading.unmount();

    hook.mockReturnValue({ ...ready, isEmpty: true } as any);
    const empty = render(<PASchoolDistrictsMapContainer />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'No school districts are available',
    );
    empty.unmount();

    const retry = vi.fn();
    hook.mockReturnValue({
      ...ready,
      data: undefined,
      isError: new Error('malformed artifact'),
      retry,
    } as any);
    const unavailable = render(<PASchoolDistrictsMapContainer />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'School district map data is unavailable',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    unavailable.unmount();

    hook.mockReturnValue({ ...ready, isStale: true } as any);
    render(<PASchoolDistrictsMapContainer />);
    expect(screen.getByText(/older than 18 months/)).toBeVisible();
  });
});
