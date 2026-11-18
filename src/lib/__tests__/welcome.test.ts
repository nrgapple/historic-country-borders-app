import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  canRemember,
  hasSeenWelcome,
  rememberWelcomeSeen,
  WELCOME_KEY_PREFIX,
  WELCOME_VERSION,
  welcomeDecision,
  welcomeKey,
} from '../welcome';

/** A Storage whose every call throws, like a blocked or private-mode store. */
const throwingStorage = (): Storage =>
  ({
    getItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    setItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    removeItem: () => {
      throw new DOMException('denied', 'SecurityError');
    },
    clear: () => undefined,
    key: () => null,
    length: 0,
  }) as Storage;

/** Readable but full: old Safari private mode (setItem throws QuotaExceeded). */
const readOnlyStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError');
    },
    removeItem: (k: string) => void values.delete(k),
    clear: () => values.clear(),
    key: () => null,
    get length() {
      return values.size;
    },
  } as Storage;
};

describe('welcome storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows on a first visit', () => {
    expect(welcomeDecision({ storage: window.localStorage, search: '' })).toBe(
      'show',
    );
    expect(
      welcomeDecision({ storage: window.localStorage, search: '?zoom=4' }),
    ).toBe('show');
  });

  it('is not shown again once dismissed', () => {
    expect(hasSeenWelcome(window.localStorage)).toBe(false);
    expect(rememberWelcomeSeen(window.localStorage)).toBe(true);
    expect(hasSeenWelcome(window.localStorage)).toBe(true);
    expect(welcomeDecision({ storage: window.localStorage, search: '' })).toBe(
      'skip',
    );
  });

  it('remembers under a versioned key, so new notes show again', () => {
    expect(welcomeKey()).toBe(`${WELCOME_KEY_PREFIX}:${WELCOME_VERSION}`);
    rememberWelcomeSeen(window.localStorage, 'v1', new Date('2026-11-18'));
    expect(window.localStorage.getItem(`${WELCOME_KEY_PREFIX}:v1`)).toBe(
      '2026-11-18T00:00:00.000Z',
    );
    expect(
      welcomeDecision({
        storage: window.localStorage,
        search: '',
        version: 'v1',
      }),
    ).toBe('skip');
    expect(
      welcomeDecision({
        storage: window.localStorage,
        search: '',
        version: 'v2',
      }),
    ).toBe('show');
  });

  it('never shows automatically when storage is unavailable', () => {
    expect(welcomeDecision({ storage: null, search: '' })).toBe('skip');
    expect(welcomeDecision({ storage: throwingStorage(), search: '' })).toBe(
      'skip',
    );
    expect(hasSeenWelcome(throwingStorage())).toBeNull();
    expect(canRemember(throwingStorage())).toBe(false);
    expect(rememberWelcomeSeen(throwingStorage())).toBe(false);
    expect(rememberWelcomeSeen(null)).toBe(false);
  });

  it('never shows automatically when a dismissal cannot be saved', () => {
    const storage = readOnlyStorage();
    expect(hasSeenWelcome(storage)).toBe(false);
    expect(canRemember(storage)).toBe(false);
    expect(welcomeDecision({ storage, search: '' })).toBe('skip');
  });

  it('leaves no probe value behind', () => {
    expect(canRemember(window.localStorage)).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });

  it('defers on a shared ?place= link', () => {
    expect(
      welcomeDecision({
        storage: window.localStorage,
        search: '?lng=30&lat=40&zoom=4&place=Ottoman%20Empire',
      }),
    ).toBe('defer');
    // An empty place is not a shared place.
    expect(
      welcomeDecision({ storage: window.localStorage, search: '?place=' }),
    ).toBe('show');
    // Dismissal still wins over a shared link.
    rememberWelcomeSeen(window.localStorage);
    expect(
      welcomeDecision({
        storage: window.localStorage,
        search: '?place=Venice',
      }),
    ).toBe('skip');
  });

  it('matches the key the review screenshots mark as seen', () => {
    // Vitest runs from the repository root (jsdom gives import.meta.url an http scheme).
    const script = readFileSync('scripts/shoot.mjs', 'utf8');
    expect(script).toContain(`'${welcomeKey()}'`);
  });
});
