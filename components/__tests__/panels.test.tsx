import React, { useEffect } from 'react';
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
import { countryFacts } from '../HistoryAtlas';
import {
  districtFacts,
  districtFullName,
  titleCase,
} from '../SchoolDistrictsAtlas';
import {
  ChromeProvider,
  Overlay,
  useChrome,
} from '../../contexts/ChromeContext';
import { SettingsProvider, useSettings } from '../../contexts/SettingsContext';
import { __resetWikiCache } from '../../hooks/useWiki';

vi.mock('next/router', () => ({
  useRouter: () => ({ query: {}, push: vi.fn(), isReady: true }),
}));
vi.mock('../../hooks/useFingerPrint', () => ({
  useFingerPrint: (enabled: boolean) => (enabled ? 'visitor-1' : null),
}));

function OpenOverlay({ overlay }: { overlay: Exclude<Overlay, null> }) {
  const { openOverlay } = useChrome();
  useEffect(() => openOverlay(overlay), [openOverlay, overlay]);
  return null;
}

function SettingsProbe() {
  const { settings } = useSettings();
  return <output data-testid="settings">{JSON.stringify(settings)}</output>;
}

const withProviders = (children: React.ReactNode) => (
  <SettingsProvider>
    <ChromeProvider>{children}</ChromeProvider>
  </SettingsProvider>
);

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
  it('derives readable country facts without repeating the name', () => {
    expect(
      countryFacts({
        NAME: 'Crimean Khanate',
        PARTOF: 'Ottoman Empire',
        SUBJECTO: 'Ottoman Empire',
        BORDERPRECISION: 1,
      }),
    ).toEqual([
      { label: 'Part of', value: 'Ottoman Empire' },
      { label: 'Border precision', value: 'Approximate' },
    ]);
    expect(countryFacts({ NAME: 'France', PARTOF: 'France' })).toEqual([]);
  });

  it('formats school district details', () => {
    const properties = {
      NAME: 'Pen Argyl Area',
      SCHOOL_DIS: 'Pen Argyl Area SD',
      CTY_NAME: 'NORTHAMPTON',
      IU_NAME: 'COLONIAL IU 20',
      AVTS: 'CAREER INSTITUTE OF TECHNOLOGY',
      AUN_NUM: '120483007',
    };
    expect(districtFullName(properties)).toBe('Pen Argyl Area School District');
    expect(districtFacts(properties)).toEqual([
      { label: 'County', value: 'Northampton' },
      { label: 'Intermediate unit', value: 'Colonial IU 20' },
      {
        label: 'Career & technical school',
        value: 'Career Institute of Technology',
      },
      { label: 'Administrative unit number (AUN)', value: '120483007' },
    ]);
  });

  it('keeps official acronyms in district details', () => {
    expect(titleCase('PHILADELPHIA IU 26')).toBe('Philadelphia IU 26');
    expect(titleCase('PHILADELPHIA AVTS')).toBe('Philadelphia AVTS');
    expect(titleCase('KEYSTONE CENTRAL CTC')).toBe('Keystone Central CTC');
    expect(titleCase('CTC OF LACKAWANNA COUNTY')).toBe(
      'CTC of Lackawanna County',
    );
    expect(titleCase('CENTRAL PA INSTITUTE OF SCIENCE & TECHNOLOGY')).toBe(
      'Central PA Institute of Science & Technology',
    );
    expect(titleCase('PITTSBURGH-MT OLIVER IU 2')).toBe(
      'Pittsburgh-Mt Oliver IU 2',
    );
    expect(titleCase('MCKEAN')).toBe('McKean');
    expect(titleCase('BLAST IU 17')).toBe('BLaST IU 17');
    expect(districtFacts({ AVTS: 'NULL', CTY_NAME: 'ADAMS' })).toEqual([
      { label: 'County', value: 'Adams' },
    ]);
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
    props: Partial<React.ComponentProps<typeof AboutDialog>>,
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
