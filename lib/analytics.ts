/**
 * Thin, optional Google Analytics wrapper.
 *
 * Analytics must never block or break the map: the library is loaded lazily,
 * only when a measurement ID is configured, and every call is a no-op until
 * initialization finishes. Keep the event vocabulary small and product-focused.
 */

type EventParams = Record<string, string | number | boolean | undefined>;

interface Tracker {
  event: (name: string, params?: EventParams) => void;
  send: (fields: Record<string, unknown>) => void;
}

const measurementId = process.env.NEXT_PUBLIC_GA_FOUR;

let tracker: Tracker | undefined;
let pending: Array<(t: Tracker) => void> = [];
let started = false;

export const initAnalytics = () => {
  if (started || !measurementId || typeof window === 'undefined') return;
  started = true;
  void import('react-ga4')
    .then(({ default: ReactGA }) => {
      ReactGA.initialize(measurementId, {
        testMode: process.env.NODE_ENV !== 'production',
      });
      tracker = ReactGA as unknown as Tracker;
      pending.forEach((call) => call(ReactGA as unknown as Tracker));
      pending = [];
    })
    .catch(() => {
      pending = [];
    });
};

const run = (call: (t: Tracker) => void) => {
  if (!measurementId) return;
  if (tracker) call(tracker);
  else if (pending.length < 50) pending.push(call);
};

export const trackPageview = (page: string, title?: string) =>
  run((t) => t.send({ hitType: 'pageview', page, title }));

export const trackEvent = (name: string, params?: EventParams) =>
  run((t) => t.event(name, params));
