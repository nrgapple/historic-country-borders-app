import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Map as MapLibreMap } from 'maplibre-gl';
import MapKeySlot, { KEY_STORAGE } from '../MapKeySlot';
import { __resetLand } from '../../lib/land';
import { LAYER } from '../../adapters/mapStyle';
import { watchMapKey } from '../../atlas/mapKey';

const drawGlobe = vi.hoisted(() => vi.fn());
vi.mock('../../lib/globe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/globe')>()),
  drawGlobe,
}));

type Feature = { properties: Record<string, unknown>; state?: object };

/** Just enough of MapLibre's Map: events, camera and rendered features. */
class FakeMap {
  listeners = new Map<string, Set<() => void>>();
  zoom = 3.2;
  center = { lng: 15, lat: 47 };
  rendered: Record<string, Feature[]> = {};
  on(type: string, fn: () => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return this;
  }
  off(type: string, fn: () => void) {
    this.listeners.get(type)?.delete(fn);
    return this;
  }
  fire(type: string) {
    this.listeners.get(type)?.forEach((fn) => fn());
  }
  getCenter() {
    return this.center;
  }
  getZoom() {
    return this.zoom;
  }
  getBounds() {
    return {
      getWest: () => -10,
      getSouth: () => 30,
      getEast: () => 50,
      getNorth: () => 62,
    };
  }
  getLayer(id: string) {
    return id in this.rendered ? { id } : undefined;
  }
  queryRenderedFeatures(opts: { layers: string[] }) {
    return opts.layers.flatMap((l) => this.rendered[l] ?? []);
  }
}

const asMap = (m: FakeMap) => m as unknown as MapLibreMap;

const LAND = {
  features: [
    {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 40],
            [20, 40],
            [20, 55],
            [0, 40],
          ],
        ],
      },
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  drawGlobe.mockClear();
  __resetLand();
  // The globe's land stays pending unless a test needs it.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('MapKey', () => {
  it('prints the plate title and era, and a north arrow', () => {
    render(<MapKeySlot year={1492} />);
    const key = screen.getByRole('region', { name: 'Map key' });
    expect(key).toHaveTextContent('The World in');
    expect(key).toHaveTextContent('1492');
    expect(key).toHaveTextContent('Medieval era');
    expect(
      screen.getByRole('img', { name: 'North is up' }),
    ).toBeInTheDocument();
  });

  it('lists only the symbol classes the map is drawing', async () => {
    const map = new FakeMap();
    map.rendered = {
      [LAYER.territoryFill]: [{ properties: { c: 2 } }],
      [LAYER.places]: [{ properties: { p: 'Prague', k: 'city' } }],
      [LAYER.capitals]: [],
      [LAYER.selectedCapital]: [],
    };
    render(<MapKeySlot year={1914} map={asMap(map)} />);
    const legend = await screen.findByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('City');
    expect(legend).not.toHaveTextContent('Capital');
    expect(legend).not.toHaveTextContent('Selected territory');
    expect(legend).not.toHaveTextContent('ruins');

    // A selection and a capital appear: the legend follows on the next idle.
    map.rendered[LAYER.territoryFill] = [
      { properties: { c: 2 }, state: { selected: true } },
      { properties: { c: 3, dep: 1 } },
    ];
    map.rendered[LAYER.capitals] = [{ properties: { name: 'Paris' } }];
    map.rendered[LAYER.places] = [{ properties: { p: 'Kaneš', k: 'site' } }];
    act(() => map.fire('idle'));
    expect(legend).toHaveTextContent('Selected territory');
    expect(legend).toHaveTextContent('Capital');
    expect(legend).toHaveTextContent('Colony, protectorate or vassal');
    expect(legend).toHaveTextContent('Archaeological site (ruins)');
    expect(legend).not.toHaveTextContent(/^City|City$/);
  });

  it('hides the legend when nothing in it is drawn', () => {
    const map = new FakeMap();
    map.rendered = { [LAYER.territoryFill]: [{ properties: { c: 1 } }] };
    render(<MapKeySlot year={1914} map={asMap(map)} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).toBeNull();
  });

  it('draws a scale bar for the live camera and updates it on moveend only', () => {
    const map = new FakeMap();
    render(<MapKeySlot year={1914} map={asMap(map)} />);
    const bar = screen.getByRole('img', { name: /Scale bar/ });
    expect(bar).toHaveAccessibleName(/at 47° N/);
    const before = bar.getAttribute('aria-label');
    map.zoom = 6;
    act(() => map.fire('move'));
    act(() => map.fire('zoom'));
    expect(bar.getAttribute('aria-label')).toBe(before);
    act(() => map.fire('moveend'));
    expect(bar.getAttribute('aria-label')).not.toBe(before);
  });

  it('redraws the globe on moveend, never on per-frame events', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => LAND })),
    );
    const map = new FakeMap();
    render(<MapKeySlot year={1914} map={asMap(map)} />);
    await waitFor(() => expect(drawGlobe).toHaveBeenCalledTimes(1));
    act(() => {
      for (let i = 0; i < 30; i++) {
        map.center = { lng: 15 + i, lat: 47 };
        map.fire('move');
        map.fire('render');
      }
    });
    expect(drawGlobe).toHaveBeenCalledTimes(1);
    act(() => map.fire('moveend'));
    expect(drawGlobe).toHaveBeenCalledTimes(2);
    expect(drawGlobe.mock.lastCall?.[2].center).toEqual([44, 47]);
  });

  it('collapses to the scale bar and a Key toggle, and remembers the choice', () => {
    const onLayout = vi.fn();
    const map = new FakeMap();
    const { unmount } = render(
      <MapKeySlot year={1914} map={asMap(map)} onLayout={onLayout} />,
    );
    const toggle = screen.getByRole('button', { name: 'Key' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('The World in')).not.toBeVisible();
    expect(screen.getByRole('img', { name: /Scale bar/ })).toBeVisible();
    expect(window.localStorage.getItem(KEY_STORAGE)).toBe('0');
    unmount();
    render(<MapKeySlot year={1914} map={asMap(map)} />);
    expect(screen.getByRole('button', { name: 'Key' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('starts collapsed on phones', () => {
    const matchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      ...matchMedia(query),
      matches: true,
    })) as typeof window.matchMedia;
    try {
      render(<MapKeySlot year={1914} map={asMap(new FakeMap())} />);
      expect(screen.getByRole('button', { name: 'Key' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    } finally {
      window.matchMedia = matchMedia;
    }
  });

  it('marks itself as an obstacle so map labels move clear of it', () => {
    render(<MapKeySlot year={1914} />);
    expect(screen.getByRole('region', { name: 'Map key' })).toHaveAttribute(
      'data-map-obstacle',
    );
  });
});

describe('watchMapKey', () => {
  it('subscribes to moveend and idle only, and unsubscribes', () => {
    const map = new FakeMap();
    const onView = vi.fn();
    const stop = watchMapKey(map, onView, vi.fn());
    expect([...map.listeners.keys()].sort()).toEqual(['idle', 'moveend']);
    expect(onView).toHaveBeenCalledTimes(1);
    stop();
    expect([...map.listeners.values()].every((s) => s.size === 0)).toBe(true);
  });
});
