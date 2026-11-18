import { parsePlace } from './mapView';

/**
 * When to show the one-time "Historic Borders is back" welcome.
 *
 * Dismissal is remembered in localStorage under a versioned key, so a later
 * release can show new notes by bumping `WELCOME_VERSION`. Every storage call
 * is guarded: when the browser cannot remember a dismissal (storage blocked,
 * private mode, full quota) the welcome is not shown automatically at all,
 * so it can never reappear on every page load. About → "Take the tour" still
 * opens it.
 */

/** Bump to show the welcome again with new release notes. */
export const WELCOME_VERSION = '2026-remaster';
export const WELCOME_KEY_PREFIX = 'historic-borders-welcome';
export const welcomeKey = (version: string = WELCOME_VERSION) =>
  `${WELCOME_KEY_PREFIX}:${version}`;

const PROBE_KEY = `${WELCOME_KEY_PREFIX}:probe`;

/**
 * - `show`: first visit, show now.
 * - `defer`: first visit, but the page opened on a shared `?place=` link;
 *   wait until the visitor has interacted and left that first view.
 * - `skip`: already dismissed, or the browser cannot remember a dismissal.
 */
export type WelcomeDecision = 'show' | 'defer' | 'skip';

/** The page's localStorage, or null where even reading the property throws. */
export const getWelcomeStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** True when a value can be written and read back (not blocked or full). */
export const canRemember = (storage: Storage | null): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(PROBE_KEY, '1');
    const ok = storage.getItem(PROBE_KEY) === '1';
    storage.removeItem(PROBE_KEY);
    return ok;
  } catch {
    return false;
  }
};

/** True when this version's welcome was dismissed; null when unknown. */
export const hasSeenWelcome = (
  storage: Storage | null,
  version: string = WELCOME_VERSION,
): boolean | null => {
  if (!storage) return null;
  try {
    return storage.getItem(welcomeKey(version)) !== null;
  } catch {
    return null;
  }
};

export const welcomeDecision = ({
  storage,
  search,
  version = WELCOME_VERSION,
}: {
  storage: Storage | null;
  search: string;
  version?: string;
}): WelcomeDecision => {
  const seen = hasSeenWelcome(storage, version);
  if (seen !== false) return 'skip';
  if (!canRemember(storage)) return 'skip';
  return parsePlace(search) ? 'defer' : 'show';
};

/** Records the dismissal. Returns false when storage refused it. */
export const rememberWelcomeSeen = (
  storage: Storage | null,
  version: string = WELCOME_VERSION,
  now: Date = new Date(),
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(welcomeKey(version), now.toISOString());
    return true;
  } catch {
    return false;
  }
};
