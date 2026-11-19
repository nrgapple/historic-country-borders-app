import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const gtag = vi.fn();
const initialize = vi.fn();
vi.mock('react-ga4', () => ({ default: { initialize, gtag } }));

/** The module reads the measurement ID at import: load it per test. */
async function load(id: string | undefined) {
  vi.resetModules();
  vi.stubEnv('PUBLIC_GA_FOUR', id ?? '');
  const analytics = await import('../analytics');
  analytics.__resetAnalytics();
  return analytics;
}

/** Every event carries the page without its query (camera, place). */
const here = () => `${window.location.origin}/year/1914`;

/** Runs the idle callback that loads GA, then lets the import settle. */
async function loadGa() {
  window.dispatchEvent(new Event('load'));
  await vi.runAllTimersAsync();
  await Promise.resolve();
  await vi.runAllTimersAsync();
}

beforeEach(() => {
  gtag.mockClear();
  initialize.mockClear();
  vi.useFakeTimers();
  // jsdom has no requestIdleCallback: the module falls back to a timeout.
  delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  window.history.replaceState(
    null,
    '',
    '/year/1914?lng=10&lat=45&zoom=4&place=France',
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('analytics', () => {
  it('does nothing at all without a measurement ID', async () => {
    const a = await load(undefined);
    a.initAnalytics('year');
    a.track('year_change', {
      year: 1920,
      from_year: 1914,
      method: 'step',
      steps: 1,
    });
    await loadGa();
    expect(initialize).not.toHaveBeenCalled();
    expect(a.__pending()).toEqual([]);
  });

  it('loads GA only when idle, privacy options on, and flushes the queue', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    a.track('year_change', {
      year: 1920,
      from_year: 1914,
      method: 'step',
      steps: 1,
    });
    expect(initialize).not.toHaveBeenCalled();
    expect(a.__pending()).toHaveLength(1);

    await loadGa();
    expect(initialize).toHaveBeenCalledWith(
      'G-TEST123',
      expect.objectContaining({
        gtagOptions: {
          send_page_view: false,
          allow_google_signals: false,
          allow_ad_personalization_signals: false,
        },
      }),
    );
    expect(gtag).toHaveBeenCalledWith('event', 'year_change', {
      page_location: here(),
      year: 1920,
      from_year: 1914,
      method: 'step',
      steps: 1,
    });
    // After loading, events go straight to gtag.
    a.track('link_copy', { outcome: 'copied' });
    expect(gtag).toHaveBeenLastCalledWith('event', 'link_copy', {
      page_location: here(),
      outcome: 'copied',
    });
  });

  it('never sends the query string, on any event', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    a.track('changes_open', { year: 1914 });
    expect(a.__pending()[0][1].page_location).toBe(here());
    expect(JSON.stringify(a.__pending())).not.toContain('France');
  });

  it('sends page views without the camera or place in the query', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    document.title = 'World borders in 1914 AD · Historic Borders';
    a.trackPageview(1914);
    expect(a.__pending()[0]).toEqual([
      'page_view',
      {
        page_location: `${window.location.origin}/year/1914`,
        page_title: 'World borders in 1914 AD · Historic Borders',
        page_type: 'year',
        year: 1914,
      },
    ]);
    expect(
      a.cleanLocation('https://x.test/pa/school-districts?colour=piaa#k'),
    ).toBe('https://x.test/pa/school-districts');
  });

  it('marks events for DebugView with ?ga_debug=1', async () => {
    window.history.replaceState(null, '', '/year/1914?ga_debug=1');
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    a.track('changes_open', { year: 1914 });
    expect(a.__pending()[0][1]).toMatchObject({ debug_mode: true });
  });

  it('reports script errors briefly, deduplicated and capped', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    a.reportError(
      'error',
      new Error('Failed to fetch https://example.test/secret?token=1'),
      'https://historicborders.app/_astro/Atlas.abc123.js?v=2',
      42,
    );
    a.reportError(
      'error',
      'Failed to fetch https://example.test/secret?token=1',
      'https://historicborders.app/_astro/Atlas.abc123.js',
      42,
    );
    expect(a.__pending()).toEqual([
      [
        'js_error',
        {
          page_location: here(),
          message: 'Failed to fetch <url>',
          file: 'Atlas.abc123.js',
          line: 42,
          kind: 'error',
        },
      ],
    ]);
    for (let i = 0; i < 10; i++) a.reportError('error', `boom ${i}`);
    expect(a.__pending().filter(([n]) => n === 'js_error')).toHaveLength(5);
    expect(a.__pending()[1][1].message).toBe('boom 0');
    expect(String(a.__pending()[0][1].message).length).toBeLessThanOrEqual(100);
  });

  it('catches uncaught errors and rejections once started', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('pa');
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'x is not a function',
        filename: 'https://historicborders.app/_astro/paMap.1.js',
        lineno: 7,
      }),
    );
    expect(a.__pending()).toContainEqual([
      'js_error',
      {
        page_location: here(),
        message: 'x is not a function',
        file: 'paMap.1.js',
        line: 7,
        kind: 'error',
      },
    ]);
  });

  it('bounds the queue if GA never loads', async () => {
    const a = await load('G-TEST123');
    a.initAnalytics('year');
    for (let i = 0; i < 200; i++) a.track('changes_open', { year: i });
    expect(a.__pending().length).toBeLessThanOrEqual(60);
  });
});
