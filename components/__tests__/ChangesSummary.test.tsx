import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ChangesSummary from '../ChangesSummary';
import PlacePanel from '../PlacePanel';
import type { YearContext } from '../../lib/yearContext';

const context = (changes: YearContext['changes']): YearContext => ({
  schemaVersion: 1,
  year: 1920,
  source: { name: 'Wikidata', license: 'CC0-1.0', retrievedAt: '2026-11-17' },
  places: {},
  changes,
});

const names = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => `${prefix} ${index + 1}`);

describe('ChangesSummary', () => {
  it('opens on demand and caps each list at eight names', async () => {
    const user = userEvent.setup();
    render(
      <ChangesSummary
        year={1920}
        context={context({
          previousYear: 1914,
          appeared: names(11, 'New'),
          disappeared: ['Russian Empire'],
          changed: [
            {
              name: 'Finland',
              field: 'subjectTo',
              from: 'Russian Empire',
              to: null,
            },
          ],
        })}
      />,
    );

    const toggle = screen.getByText('What changed since 1914');
    const details = toggle.closest('details');
    expect(details).not.toHaveAttribute('open');
    // jsdom cannot toggle <details> from the keyboard; the browser journey
    // in e2e/critical-journeys.spec.ts covers Enter on the summary.
    await user.click(toggle);
    expect(details).toHaveAttribute('open');

    const appeared = screen.getByRole('heading', { name: /New on the map/ });
    expect(appeared).toHaveTextContent('11');
    expect(screen.getByText('New 8')).toBeInTheDocument();
    expect(screen.queryByText('New 9')).not.toBeInTheDocument();
    expect(screen.getByText('and 3 more')).toBeInTheDocument();
    expect(screen.getByText('Russian Empire')).toBeInTheDocument();
    expect(
      screen.getByText('Finland: no longer under Russian Empire'),
    ).toBeInTheDocument();
  });

  it('renders nothing for the first year or when nothing changed', () => {
    const { container, rerender } = render(
      <ChangesSummary year={1920} context={context(null)} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <ChangesSummary
        year={1920}
        context={context({
          previousYear: 1914,
          appeared: [],
          disappeared: [],
          changed: [],
        })}
      />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<ChangesSummary year={1920} context={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a previous year as stale while the next one loads', () => {
    render(
      <ChangesSummary
        year={1930}
        context={context({
          previousYear: 1914,
          appeared: ['Estonia'],
          disappeared: [],
          changed: [
            { name: 'Iceland', field: 'partOf', from: null, to: 'Denmark' },
          ],
        })}
      />,
    );
    const details = screen
      .getByText('What changed since 1914')
      .closest('details');
    expect(details).toHaveAttribute('aria-busy', 'true');
  });
});

describe('PlacePanel source links', () => {
  it('links facts to their source and credits it once', () => {
    render(
      <PlacePanel
        eyebrow="Territory · 1492 AD"
        name="Ottoman Empire"
        wikiQuery=""
        facts={[
          { label: 'Border precision', value: 'Approximate' },
          {
            label: 'Capital',
            value: 'Constantinople',
            href: 'https://www.wikidata.org/wiki/Q12560#P36',
            source: 'Wikidata',
          },
          {
            label: 'Existed',
            value: '1299–1922 AD',
            href: 'https://www.wikidata.org/wiki/Q12560',
            source: 'Wikidata',
          },
        ]}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByRole('link', { name: 'Constantinople' }),
    ).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q12560#P36');
    expect(screen.getByText('Approximate').closest('a')).toBeNull();
    expect(screen.getByText('Facts: Wikidata')).toBeInTheDocument();
  });
});
