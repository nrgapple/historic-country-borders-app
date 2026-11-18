import { useEffect, type ComponentProps, type ReactNode } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PlacePanel from '../PlacePanel';
import SettingsPanel from '../SettingsPanel';
import FeedbackDialog from '../FeedbackDialog';
import AboutDialog from '../AboutDialog';
import MapStatus from '../MapStatus';
import Toolbar, { Brand } from '../Toolbar';
import { panelFacts, territoryFacts, territorySubtitle } from '../../atlas/facts';
import { useChrome, useSettings, type Overlay } from '../../atlas/hooks';
import { __resetStore } from '../../atlas/store';
import { __resetWikiCache } from '../../hooks/useWiki';
vi.mock('../../hooks/useFingerPrint', () => ({
  useFingerPrint: (enabled: boolean) => (enabled ? 'visitor-1' : null),
}));

function OpenOverlay({ overlay }: { overlay: Exclude<Overlay, null> }) {
  const { openOverlay, closeOverlay } = useChrome();
  // Overlays live in the store, so close on unmount like the old provider did.
  useEffect(() => {
    openOverlay(overlay);
    return () => closeOverlay();
  }, [openOverlay, closeOverlay, overlay]);
  return null;
}

function SettingsProbe() {
  const { settings } = useSettings();
  return <output data-testid="settings">{JSON.stringify(settings)}</output>;
}

// Settings and overlays live in the atlas store (no providers any more).
const withProviders = (children: ReactNode) => <>{children}</>;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  __resetStore();
});

describe('PlacePanel', () => {
  beforeEach(() => {
    __resetWikiCache();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: {
              '1': {
                title: 'Ottoman Empire',
                extract: 'The Ottoman Empire was an imperial realm.',
                fullurl: 'https://en.wikipedia.org/wiki/Ottoman_Empire',
              },
            },
          },
        }),
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('shows facts, an attributed Wikipedia summary, and closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <PlacePanel
        eyebrow="Territory · 1492 AD"
        name="Ottoman Empire"
        facts={[{ label: 'Border precision', value: 'Approximate' }]}
        onClose={onClose}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Ottoman Empire' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Approximate')).toBeInTheDocument();
    expect(await screen.findByText(/imperial realm/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Read more on Wikipedia/ }),
    ).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Ottoman_Empire');
    expect(
      screen.getByRole('link', { name: 'CC BY-SA 4.0' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('offers a retry when Wikipedia is unavailable', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);
    render(<PlacePanel eyebrow="x" name="Nowhere" onClose={vi.fn()} />);
    expect(
      await screen.findByText(/Wikipedia is unavailable/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument();
  });
});

describe('place facts', () => {
  const territory = (fields: object) => ({ id: 0, NAME: 'x', bbox: [0, 0, 1, 1] as [number, number, number, number], ...fields });

  // Direction A: the relation becomes the italic subtitle; the fact box holds
  // the "In <year>" facts with border precision as "Borders".
  it('derives readable territory facts without repeating the name', () => {
    const crimea = territory({
      NAME: 'Crimean Khanate',
      PARTOF: 'Ottoman Empire',
      SUBJECTO: 'Ottoman Empire',
      BORDERPRECISION: 1,
    });
    expect(territorySubtitle(crimea)).toBe('Part of Ottoman Empire');
    expect(territoryFacts(crimea)).toEqual([
      { label: 'Borders', value: 'Approximate', kind: 'borders', source: 'Historical Basemaps' },
    ]);
    const france = territory({ NAME: 'France', PARTOF: 'France' });
    expect(territorySubtitle(france)).toBeUndefined();
    expect(territoryFacts(france)).toEqual([]);
    expect(territorySubtitle(territory({ NAME: 'Wallachia', SUBJECTO: 'Ottoman Empire' }))).toBe(
      'Subject to Ottoman Empire',
    );
  });

  it('orders the fact box as Capital, Ruler, Existed, Borders', () => {
    const context = {
      schemaVersion: 1 as const,
      year: 1492,
      source: { name: 'Wikidata', license: 'CC0-1.0', retrievedAt: '2026-11-17' },
      changes: null,
      places: {
        'Ottoman Empire': {
          qid: 'Q12560',
          existed: { start: 1299, end: 1922 },
          capital: [{ qid: 'Q16869', label: 'Constantinople' }],
          headOfState: [{ qid: 'Q1', label: 'Bayezid II', start: 1481, end: 1512 }],
        },
      },
    };
    const facts = panelFacts(
      territory({ NAME: 'Ottoman Empire', BORDERPRECISION: 1 }),
      context,
      'Ottoman Empire',
    );
    expect(facts.map((f) => f.label)).toEqual(['Capital', 'Ruler', 'Existed', 'Borders']);
    expect(facts[1].value).toBe('Bayezid II (1481–1512 AD)');
  });
});

describe('Toolbar and settings', () => {
  beforeEach(() => localStorage.clear());

  it('opens settings and applies changes immediately', () => {
    render(
      withProviders(
        <>
          <Toolbar />
          <SettingsPanel />
          <SettingsProbe />
        </>,
      ),
    );
    const trigger = screen.getByRole('button', { name: 'Map settings' });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('switch', { name: 'Labels' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }));
    fireEvent.change(screen.getByRole('slider', { name: 'Fill opacity' }), {
      target: { value: '0.4' },
    });
    const settings = JSON.parse(screen.getByTestId('settings').textContent!);
    expect(settings).toEqual(
      expect.objectContaining({
        showLabels: false,
        textSize: 'large',
        countryOpacity: 0.4,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(
      JSON.parse(screen.getByTestId('settings').textContent!).showLabels,
    ).toBe(true);
  });
});

describe('FeedbackDialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  const openFeedback = () =>
    render(
      withProviders(
        <>
          <OpenOverlay overlay="feedback" />
          <FeedbackDialog />
        </>,
      ),
    );

  it('submits a bounded payload and confirms success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'success' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    openFeedback();

    const submit = screen.getByRole('button', { name: 'Send feedback' });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Good' }));
    fireEvent.change(
      screen.getByLabelText('What did you notice on this map?'),
      {
        target: { value: '  Great for class  ' },
      },
    );
    await act(async () => fireEvent.click(submit));

    expect(await screen.findByText(/feedback was sent/)).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/feedback');
    expect(JSON.parse(init.body)).toEqual({
      user: '',
      message: 'Great for class',
      rate: 'nice',
      visitorId: 'visitor-1',
      metadata: { page: '/' },
    });
  });

  it('sends a message without a rating', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'success' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    openFeedback();

    const submit = screen.getByRole('button', { name: 'Send feedback' });
    const message = screen.getByLabelText('What did you notice on this map?');
    fireEvent.change(message, { target: { value: '   ' } });
    expect(submit).toBeDisabled();
    fireEvent.change(message, {
      target: { value: 'Byzantium is missing in 1500' },
    });
    expect(submit).toBeEnabled();
    await act(async () => fireEvent.click(submit));

    expect(await screen.findByText(/feedback was sent/)).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        message: 'Byzantium is missing in 1500',
        rate: '',
      }),
    );
  });

  it('points corrections to the right data steward for each map', () => {
    const { unmount } = openFeedback();
    expect(
      screen.getByRole('link', { name: 'historical-basemaps project' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/aourednik/historical-basemaps/issues',
    );
    unmount();

    render(
      withProviders(
        <>
          <OpenOverlay overlay="feedback" />
          <FeedbackDialog
            corrections={
              <>
                Contact <a href="https://example.com/pasda">PASDA</a>.
              </>
            }
          />
        </>,
      ),
    );
    expect(screen.getByRole('link', { name: 'PASDA' })).toHaveAttribute(
      'href',
      'https://example.com/pasda',
    );
    expect(
      screen.queryByRole('link', { name: 'historical-basemaps project' }),
    ).not.toBeInTheDocument();
  });

  it('shows a server error inline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Feedback is temporarily unavailable' }),
      }),
    );
    openFeedback();
    fireEvent.click(screen.getByRole('radio', { name: 'Okay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Feedback is temporarily unavailable',
      ),
    );
  });
});

describe('AboutDialog', () => {
  const openAbout = (
    props: Partial<ComponentProps<typeof AboutDialog>>,
  ) =>
    render(
      withProviders(
        <>
          <OpenOverlay overlay="about" />
          <AboutDialog sources={<p>Fixture sources</p>} {...props} />
        </>,
      ),
    );

  it('uses the historical intro by default and links to a random year', () => {
    openAbout({});
    expect(
      screen.getByText(/atlas for exploring how political boundaries/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Random year' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('shows a page-specific intro and keyboard guide', () => {
    openAbout({
      intro: <p>Fixture district intro. Contact the school district.</p>,
      shortcuts: [
        { keys: ['←', '→'], action: 'Previous or next year' },
        { keys: ['↑', '↓'], action: 'Pan the map (when the map is focused)' },
      ],
    });
    expect(screen.getByText(/Fixture district intro/)).toBeInTheDocument();
    expect(
      screen.queryByText(/atlas for exploring how political boundaries/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('Pan the map (when the map is focused)'),
    ).toBeInTheDocument();
  });
});

describe('Brand', () => {
  it('is a title, not a link that would replace the lesson', () => {
    render(
      <Brand
        subtitle="Pennsylvania school districts"
        compactTitle="PA school districts"
        compactDetail="Boundaries Oct 2025"
      />,
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('PA school districts')).toBeInTheDocument();
    expect(screen.getByText('Boundaries Oct 2025')).toBeInTheDocument();
  });
});

describe('MapStatus', () => {
  const status = (isLoading: boolean) => (
    <MapStatus
      isLoading={isLoading}
      onRetry={vi.fn()}
      loadingLabel="Loading 500 district boundaries"
      readyLabel="Ready"
    />
  );

  it('shows a visible message for the first load only', () => {
    const { rerender } = render(status(true));
    expect(screen.getByTestId('map-loading')).toHaveTextContent(
      'Loading 500 district boundaries…',
    );
    rerender(status(false));
    expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Ready');
    // A later load (such as a year change) keeps the map and uses the bar.
    rerender(status(true));
    expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument();
  });

  it('replaces the loading message with the error', () => {
    render(
      <MapStatus
        isLoading
        error={new Error('offline')}
        onRetry={vi.fn()}
        loadingLabel="Loading"
        readyLabel="Ready"
        errorLabel="Unavailable"
      />,
    );
    expect(screen.queryByTestId('map-loading')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
  });
});
