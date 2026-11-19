/**
 * Google Analytics 4, optional and privacy-light (docs/ANALYTICS.md).
 *
 * - Nothing loads without a measurement ID (`PUBLIC_GA_FOUR`), and the GA
 *   script loads only once the page is idle, so it never competes with the
 *   map. Calls before then are queued (bounded) and flushed.
 * - The audience includes students: no user ids, no free text (search
 *   queries, feedback messages), Google signals and ad personalization off.
 *   Page locations are sent without their query string (camera, place).
 * - Page views are sent by the app itself, one per year page shown, because
 *   the camera is written to the URL with `replaceState` and GA's own
 *   history-based page views would count every pan.
 * - Debugging: script errors (`js_error`), Core Web Vitals (`web_vitals`),
 *   map failures, load times and gesture outcomes. Add `?ga_debug=1` to a
 *   page to see its events in GA's DebugView.
 *
 * Event names and parameters are typed below; keep values low-cardinality.
 */

type Value = string | number | boolean | undefined;
export type EventParams = Record<string, Value>;

/** The event vocabulary (docs/ANALYTICS.md has the meaning of each). */
export interface Events {
  page_view: {
    page_location: string;
    page_title: string;
    page_type: PageType;
    year?: number;
  };
  /** The first map of a page load has drawn. */
  map_ready: {
    page_type: PageType;
    year?: number;
    load_ms: number;
    theme: string;
    low_power: boolean;
  };
  /** A later year has drawn after a year change. */
  year_loaded: { year: number; load_ms: number; animated: boolean };
  map_unavailable: { page_type: PageType; reason: string };
  data_error: { page_type: PageType; what: string; year?: number };
  year_change: {
    year: number;
    from_year: number;
    method: string;
    steps: number;
  };
  border_animation: {
    outcome: 'played' | 'skipped' | 'interrupted' | 'failed';
    reason?: string;
    from_year?: number;
    to_year?: number;
    prepare_ms?: number;
    frames?: number;
    slow_frames?: number;
  };
  country_select: { name: string; year: number; source: string };
  district_select: { name: string; source: string };
  overlay_open: { overlay: string; view?: string; auto?: boolean };
  setting_changed: { setting: string; value: string };
  settings_reset: Record<string, never>;
  focus_mode: { enabled: boolean };
  changes_open: { year: number };
  wiki_summary: { outcome: 'loaded' | 'missing' | 'error' };
  link_copy: { outcome: 'copied' | 'manual' };
  /** Every send attempt: `sent`, or `failed` with why (never the text). */
  feedback_submit: {
    outcome: 'sent' | 'failed';
    reason?: 'rate_limited' | 'rejected' | 'server' | 'network';
    rating: string;
    has_message: boolean;
    has_email: boolean;
  };
  timeline_gesture: {
    outcome: 'committed' | 'tap' | 'cancelled' | 'lost_capture';
    pointer: string;
    years_moved: number;
  };
  /** A press on the timeline was ignored because another was still open. */
  timeline_press_ignored: { pointer: string; stale_ms: number };
  js_error: { message: string; file: string; line: number; kind: string };
  web_vitals: {
    page_type: PageType;
    lcp_ms?: number;
    inp_ms?: number;
    cls_x1000?: number;
  };
}
export type EventName = keyof Events;
export type PageType = 'year' | 'pa' | 'other';

interface Tracker {
  gtag: (...args: unknown[]) => void;
}

const measurementId = import.meta.env.PUBLIC_GA_FOUR as string | undefined;
const MAX_PENDING = 60;
const MAX_ERRORS = 5;

let tracker: Tracker | undefined;
let pending: Array<[string, EventParams]> = [];
let started = false;
let pageType: PageType = 'other';
let debug = false;

/** `origin + pathname`: the camera and place in the query stay out of GA. */
export const cleanLocation = (href: string) => {
  try {
    const url = new URL(href);
    return `${url.origin}${url.pathname}`;
  } catch {
    return href.split(/[?#]/)[0];
  }
};

const send = (name: string, params: EventParams) => {
  if (!measurementId || typeof window === 'undefined') return;
  // gtag would attach the full URL (camera and place) to every event.
  const full: EventParams = {
    page_location: cleanLocation(window.location.href),
    ...params,
  };
  if (debug) full.debug_mode = true;
  if (tracker) tracker.gtag('event', name, full);
  else if (pending.length < MAX_PENDING) pending.push([name, full]);
};

/** Sends one event from the vocabulary. A no-op without a measurement ID. */
export function track<N extends EventName>(name: N, params: Events[N]) {
  send(name, params as EventParams);
}

/** One page view per page shown (the year pages send one per year). */
export const trackPageview = (year?: number) =>
  track('page_view', {
    page_location: cleanLocation(window.location.href),
    page_title: document.title,
    page_type: pageType,
    year,
  });

/* ---- Script errors ------------------------------------------------------ */

const errorKeys = new Set<string>();

/** A short, deduplicated, capped error report: never a stack or a URL query. */
export function reportError(
  kind: string,
  message: unknown,
  file?: string,
  line?: number,
) {
  if (errorKeys.size >= MAX_ERRORS) return;
  const text = String(
    message instanceof Error ? message.message : (message ?? 'unknown'),
  )
    .replace(/https?:\/\/\S+/g, '<url>')
    .slice(0, 100);
  const name = (file ?? '').split(/[?#]/)[0].split('/').pop() || 'unknown';
  const key = `${kind}|${text}|${name}`;
  if (errorKeys.has(key)) return;
  errorKeys.add(key);
  track('js_error', { message: text, file: name, line: line ?? 0, kind });
}

const watchErrors = () => {
  window.addEventListener('error', (event) =>
    reportError('error', event.message, event.filename, event.lineno),
  );
  window.addEventListener('unhandledrejection', (event) =>
    reportError('rejection', event.reason),
  );
};

/* ---- Core Web Vitals (no library) ---------------------------------------- */

type ShiftEntry = PerformanceEntry & { value: number; hadRecentInput: boolean };
type EventTimingEntry = PerformanceEntry & { interactionId?: number };

/**
 * LCP, CLS (largest 5 s session window) and INP (the slowest interaction,
 * a fair estimate below 50 interactions), sent once when the page is hidden.
 */
const watchVitals = () => {
  if (typeof PerformanceObserver === 'undefined') return;
  let lcp: number | undefined;
  let inp: number | undefined;
  let cls = 0;
  let windowValue = 0;
  let windowStart = 0;
  let windowLast = 0;
  const observe = (type: string, onEntry: (e: PerformanceEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) =>
        list.getEntries().forEach(onEntry),
      );
      observer.observe({
        type,
        buffered: true,
        ...(type === 'event' ? { durationThreshold: 40 } : {}),
      } as PerformanceObserverInit);
    } catch {
      // Not supported here (Safari has no layout-shift or event timing).
    }
  };
  observe('largest-contentful-paint', (e) => (lcp = e.startTime));
  observe('layout-shift', (e) => {
    const shift = e as ShiftEntry;
    if (shift.hadRecentInput) return;
    if (
      windowValue &&
      (shift.startTime - windowLast > 1000 ||
        shift.startTime - windowStart > 5000)
    )
      windowValue = 0;
    if (!windowValue) windowStart = shift.startTime;
    windowValue += shift.value;
    windowLast = shift.startTime;
    cls = Math.max(cls, windowValue);
  });
  observe('event', (e) => {
    if (!(e as EventTimingEntry).interactionId) return;
    inp = Math.max(inp ?? 0, e.duration);
  });
  let sent = false;
  const flush = () => {
    if (sent || document.visibilityState !== 'hidden') return;
    sent = true;
    track('web_vitals', {
      page_type: pageType,
      lcp_ms: lcp === undefined ? undefined : Math.round(lcp),
      inp_ms: inp === undefined ? undefined : Math.round(inp),
      cls_x1000: Math.round(cls * 1000),
    });
  };
  document.addEventListener('visibilitychange', flush);
  window.addEventListener('pagehide', flush);
};

/* ---- Start -------------------------------------------------------------- */

/**
 * Starts analytics for this page (idempotent). Error and vitals listeners
 * start at once; the GA script loads when the page is idle.
 */
export const initAnalytics = (type: PageType) => {
  pageType = type;
  if (started || !measurementId || typeof window === 'undefined') return;
  started = true;
  debug = new URLSearchParams(window.location.search).has('ga_debug');
  watchErrors();
  watchVitals();
  const load = () =>
    void import('react-ga4')
      .then(({ default: ReactGA }) => {
        ReactGA.initialize(measurementId, {
          testMode: !import.meta.env.PROD,
          gtagOptions: {
            // The app sends its own page views (see above).
            send_page_view: false,
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
          },
        });
        tracker = ReactGA as unknown as Tracker;
        const queued = pending;
        pending = [];
        queued.forEach(([name, params]) =>
          tracker!.gtag('event', name, params),
        );
      })
      .catch(() => {
        pending = [];
      });
  const idle = () =>
    window.requestIdleCallback
      ? window.requestIdleCallback(load, { timeout: 5000 })
      : window.setTimeout(load, 2000);
  if (document.readyState === 'complete') idle();
  else window.addEventListener('load', idle, { once: true });
};

/** Test helper. */
export const __resetAnalytics = () => {
  tracker = undefined;
  pending = [];
  started = false;
  pageType = 'other';
  debug = false;
  errorKeys.clear();
};

/** Test helper: the queue before GA loads. */
export const __pending = () => pending;
