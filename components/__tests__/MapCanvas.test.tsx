import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('MapCanvas without WebGL', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('explains the problem instead of leaving a blank map', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'test-token');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { default: MapCanvas, supportsWebGL } =
      await import('../map/MapCanvas');
    expect(supportsWebGL()).toBe(false);
    render(
      <MapCanvas
        mapStyle="mapbox://styles/test"
        interactiveLayerId="borders"
        onFeatureClick={() => {}}
      >
        <div />
      </MapCanvas>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This browser can’t draw the interactive map',
    );
  });
});
