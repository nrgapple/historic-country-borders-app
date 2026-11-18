import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LifespanBar from '../LifespanBar';
import {
  lifespanLayout,
  toAstronomical,
  yearsBetween,
} from '../../lib/lifespan';

describe('lifespanLayout', () => {
  it('is hidden when the lifespan is unknown or half known', () => {
    expect(lifespanLayout(undefined, 1492)).toBeNull();
    expect(lifespanLayout({}, 1492)).toBeNull();
    expect(lifespanLayout({ start: 1299 }, 1492)).toBeNull();
    expect(lifespanLayout({ end: 1922 }, 1492)).toBeNull();
    expect(lifespanLayout({ start: 1922, end: 1299 }, 1492)).toBeNull();
  });

  it('places the marker at the map year', () => {
    const layout = lifespanLayout({ start: 1299, end: 1922 }, 1492)!;
    expect(layout.marker.placement).toBe('within');
    expect(layout.marker.position).toBeCloseTo((1492 - 1299) / (1922 - 1299));
    expect(layout.marker.label).toBe('This map');
    expect(layout.start.label).toBe('1299');
    expect(layout.end.label).toBe('1922');
  });

  it('labels approximate bounds with "c."', () => {
    const layout = lifespanLayout(
      { start: -3100, end: -30, startApprox: true },
      -1000,
    )!;
    expect(layout.start).toMatchObject({ approx: true, label: 'c. 3,100 BC' });
    expect(layout.end).toMatchObject({ approx: false, label: '30 BC' });
    expect(layout.description).toBe(
      'Existed c. 3,100 BC to 30 BC. This map, 1,000 BC, falls within it.',
    );
  });

  it('counts across the missing year zero and names both eras', () => {
    expect(toAstronomical(-1)).toBe(0);
    expect(yearsBetween(-1, 1)).toBe(1);
    expect(yearsBetween(-27, 476)).toBe(502);
    const layout = lifespanLayout({ start: -27, end: 476 }, 100)!;
    expect(layout.start.label).toBe('27 BC');
    expect(layout.end.label).toBe('476 AD');
    expect(layout.marker.position).toBeCloseTo(126 / 502);
  });

  it('clamps and labels the marker when the map is outside the lifespan', () => {
    const before = lifespanLayout({ start: 1299, end: 1922 }, 1200)!;
    expect(before.marker).toMatchObject({
      position: 0,
      placement: 'before',
      label: 'This map (1200 AD) is earlier',
    });
    const after = lifespanLayout({ start: 1299, end: 1922 }, 1945)!;
    expect(after.marker).toMatchObject({
      position: 1,
      placement: 'after',
      label: 'This map (1945 AD) is later',
    });
    expect(after.description).toContain('is after it ended');
  });

  it('centres the marker for a single-year span', () => {
    expect(
      lifespanLayout({ start: 1500, end: 1500 }, 1500)!.marker.position,
    ).toBe(0.5);
  });
});

describe('LifespanBar', () => {
  it('renders nothing when the lifespan is unknown', () => {
    const { container } = render(
      <LifespanBar existed={undefined} year={1492} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('draws soft ends for approximate bounds and marks the map year', () => {
    render(
      <LifespanBar
        existed={{ start: 1299, end: 1922, endApprox: true }}
        year={1492}
        href="https://www.wikidata.org/wiki/Q12560"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Key dates' })).toBeVisible();
    const span = document.querySelector('.lifespan__span')!;
    expect(span).not.toHaveAttribute('data-soft-start');
    expect(span).toHaveAttribute('data-soft-end');
    expect(document.querySelector('.lifespan__marker-label')).toHaveTextContent(
      'This map',
    );
    expect(
      (document.querySelector('.lifespan__marker') as HTMLElement).style.left,
    ).toBe('30.98%');
    expect(
      screen.getByText(/Existed 1299 to c\. 1922\. This map, 1492 AD/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wikidata' })).toHaveAttribute(
      'href',
      'https://www.wikidata.org/wiki/Q12560',
    );
  });
});
