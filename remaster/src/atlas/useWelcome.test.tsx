import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetStore, actions, getState, InitialYear } from './store';
import { useWelcome } from './useWelcome';
import { hasSeenWelcome } from '../lib/welcome';

const go = (url: string) => window.history.replaceState(null, '', url);

function Probe() {
  const open = useWelcome();
  return <p data-testid="probe">{open ? 'open' : 'closed'}</p>;
}

const mount = (url: string) => {
  go(url);
  actions.init(1492);
  return render(
    <InitialYear.Provider value={1492}>
      <Probe />
    </InitialYear.Provider>,
  );
};

describe('useWelcome', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetStore(1492);
  });
  afterEach(() => __resetStore());

  it('opens by itself on a first visit, without taking focus', () => {
    const { getByTestId } = mount('/year/1492');
    expect(getByTestId('probe')).toHaveTextContent('open');
    expect(getState()).toMatchObject({
      overlay: 'welcome',
      welcomeView: 'notes',
      welcomeAuto: true,
    });
  });

  it('remembers the dismissal and stays closed on the next visit', () => {
    const first = mount('/year/1492');
    act(() => actions.closeOverlay());
    expect(hasSeenWelcome(window.localStorage)).toBe(true);
    first.unmount();

    __resetStore(1492);
    const { getByTestId } = mount('/year/1492');
    expect(getByTestId('probe')).toHaveTextContent('closed');
    expect(getState().overlay).toBeNull();
  });

  it('waits on a shared ?place= link until the visitor interacts and the panel closes', () => {
    const { getByTestId } = mount('/year/1492?place=Venice');
    expect(getByTestId('probe')).toHaveTextContent('closed');

    // An interaction alone does not cover the shared place.
    act(() => {
      fireEvent.pointerDown(window);
    });
    expect(getByTestId('probe')).toHaveTextContent('closed');

    act(() => actions.select(null));
    expect(getByTestId('probe')).toHaveTextContent('open');
  });

  it('does not open on a shared link when the place closes without any interaction', () => {
    const { getByTestId } = mount('/year/1492?place=Atlantis');
    // The index drops a place it cannot find; that is not the visitor.
    act(() => actions.select(null));
    expect(getByTestId('probe')).toHaveTextContent('closed');
    act(() => {
      fireEvent.keyDown(window, { key: 'Tab' });
    });
    expect(getByTestId('probe')).toHaveTextContent('open');
  });

  it('closes, and counts as dismissed, when a place is selected or focus mode starts', () => {
    mount('/year/1492');
    act(() => actions.select('Venice'));
    expect(getState().overlay).toBeNull();
    expect(hasSeenWelcome(window.localStorage)).toBe(true);

    window.localStorage.clear();
    __resetStore(1492);
    mount('/year/1492');
    expect(getState().overlay).toBe('welcome');
    act(() => actions.toggleFocusMode());
    expect(getState().overlay).toBeNull();
    expect(hasSeenWelcome(window.localStorage)).toBe(true);
  });

  it('never opens by itself in focus mode', () => {
    go('/year/1492?place=Venice');
    actions.init(1492);
    actions.toggleFocusMode();
    const { getByTestId } = render(
      <InitialYear.Provider value={1492}>
        <Probe />
      </InitialYear.Provider>,
    );
    act(() => {
      fireEvent.pointerDown(window);
    });
    act(() => actions.select(null));
    expect(getByTestId('probe')).toHaveTextContent('closed');
    act(() => actions.toggleFocusMode());
    expect(getByTestId('probe')).toHaveTextContent('open');
  });

  it('does not open when localStorage is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      const { getByTestId } = mount('/year/1492');
      expect(getByTestId('probe')).toHaveTextContent('closed');
      // Opening it by hand still works, and closing it does not throw.
      act(() => actions.openWelcome('tour'));
      expect(getByTestId('probe')).toHaveTextContent('open');
      act(() => actions.closeOverlay());
      expect(getByTestId('probe')).toHaveTextContent('closed');
    } finally {
      Object.defineProperty(window, 'localStorage', descriptor);
    }
  });
});
