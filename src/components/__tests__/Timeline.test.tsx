import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import historicalManifest from '@repo/data/historical-manifest.json';
import Timeline, {
  chooseLabelledTicks,
  eraBandLabel,
  formatRulerLabel,
} from '../Timeline';
import { eraSpans } from '../../lib/years';
import { track } from '../../lib/analytics';

vi.mock('../../lib/analytics', () => ({ track: vi.fn() }));
const trackMock = vi.mocked(track);

// jsdom lacks PointerEvent; a MouseEvent subclass carries clientX and pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    isPrimary: boolean;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
      this.isPrimary = init.isPrimary ?? true;
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const years = [-500, -1, 100, 1492, 1500, 1914];

/**
 * A Touch Events event (jsdom's TouchEvent wants real Touch objects): the
 * ruler reads only touches, changedTouches, identifier, clientX and target.
 */
const touchEvent = (
  target: Element,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  clientX: number,
  { id = 3, others = 0 }: { id?: number; others?: number } = {},
) => {
  const touch = { identifier: id, clientX, clientY: 8, target };
  const event = new Event(type, { bubbles: true, cancelable: true });
  const ended = type === 'touchend' || type === 'touchcancel';
  const rest = Array.from({ length: others }, (_, i) => ({
    identifier: 90 + i,
    clientX: 0,
    clientY: 0,
    target,
  }));
  Object.defineProperties(event, {
    touches: { value: ended ? rest : [touch, ...rest] },
    changedTouches: { value: [touch] },
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
};

const nextTask = () =>
  act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const renderTimeline = (value = 1492) => {
  const onChange = vi.fn();
  render(<Timeline years={years} value={value} onChange={onChange} />);
  return onChange;
};

describe('Timeline', () => {
  it('shows the selected year and its neighbours', () => {
    renderTimeline();
    const slider = screen.getByRole('slider', { name: 'Map year' });
    expect(slider).toHaveAttribute('aria-valuetext', '1492 AD');
    expect(slider).toHaveAttribute('aria-valuenow', '3');
    expect(
      screen.getByRole('button', { name: 'Previous year: 100 AD' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Next year: 1500 AD' }),
    ).toBeEnabled();
    expect(screen.getAllByText('Medieval').length).toBeGreaterThan(0);
  });

  it('steps with the previous and next buttons', () => {
    const onChange = renderTimeline();
    fireEvent.click(screen.getByRole('button', { name: /Previous year/ }));
    expect(onChange).toHaveBeenLastCalledWith(100, 'step');
    fireEvent.click(screen.getByRole('button', { name: /Next year/ }));
    expect(onChange).toHaveBeenLastCalledWith(1500, 'step');
  });

  it('disables stepping past either end', () => {
    renderTimeline(-500);
    expect(
      screen.getByRole('button', { name: 'Earliest year' }),
    ).toBeDisabled();
  });

  it('supports slider keyboard interaction', () => {
    const onChange = renderTimeline();
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(1500, 'keyboard');
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(-500, 'keyboard');
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(1914, 'keyboard');
  });

  it('moves through time with page-level arrow keys but not while typing', () => {
    const onChange = renderTimeline();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith(100, 'keyboard');
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(onChange).toHaveBeenLastCalledWith(1500, 'keyboard');

    onChange.mockClear();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', metaKey: true });
    expect(onChange).not.toHaveBeenCalled();
    input.remove();
  });

  it('selects the year under the pointer on release', () => {
    const onChange = renderTimeline();
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 36 }) as DOMRect;
    fireEvent.pointerDown(slider, { button: 0, clientX: 10, pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 590, pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider, { clientX: 590, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(1914, 'track');
  });

  describe('touch drags', () => {
    // Six years over 600 px: 100 px per year.
    const setup = (value = 1492) => {
      const onChange = renderTimeline(value);
      const slider = screen.getByRole('slider');
      slider.getBoundingClientRect = () =>
        ({ left: 0, width: 600, top: 0, height: 16 }) as DOMRect;
      const ruler = slider.closest('.timeline__ruler') as HTMLElement;
      const heading = () =>
        document.querySelector('[data-year-heading]')?.textContent;
      const touch = { pointerId: 7, pointerType: 'touch' };
      return { onChange, slider, ruler, heading, touch };
    };

    it('previews the year under the finger and commits once on release', () => {
      const { onChange, slider, heading, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
      fireEvent.pointerMove(slider, { ...touch, clientX: 450 });
      fireEvent.pointerMove(slider, { ...touch, clientX: 150 });
      expect(heading()).toBe('1');
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(slider, { ...touch, clientX: 150 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(-1, 'track');
    });

    it('jumps to the year tapped', () => {
      const { onChange, slider, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 550 });
      fireEvent.pointerUp(slider, { ...touch, clientX: 550 });
      expect(onChange).toHaveBeenCalledWith(1914, 'track');
    });

    it('keeps the previewed year when the browser cancels a real drag', () => {
      const { onChange, slider, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
      fireEvent.pointerMove(slider, { ...touch, clientX: 50 });
      fireEvent.pointerCancel(slider, { ...touch, clientX: 0 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(-500, 'track');
    });

    it('discards a cancelled press that never moved', () => {
      const { onChange, slider, heading, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 50 });
      fireEvent.pointerMove(slider, { ...touch, clientX: 52 });
      fireEvent.pointerCancel(slider, { ...touch, clientX: 52 });
      expect(onChange).not.toHaveBeenCalled();
      expect(heading()).toBe('1492');
    });

    it('ignores capture lost by a child and lost just before pointerup', () => {
      const { onChange, slider, ruler, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
      // Bubbled from the implicitly captured track: not the ruler's capture.
      fireEvent.lostPointerCapture(slider, touch);
      fireEvent.pointerMove(slider, { ...touch, clientX: 550 });
      // WebKit may release the ruler's capture just before the pointerup.
      fireEvent.lostPointerCapture(ruler, touch);
      fireEvent.pointerUp(slider, { ...touch, clientX: 550 });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(1914, 'track');
    });

    it('ends a drag whose capture is lost with no pointerup', async () => {
      const { onChange, slider, ruler, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
      fireEvent.pointerMove(slider, { ...touch, clientX: 150 });
      fireEvent.lostPointerCapture(ruler, touch);
      expect(onChange).not.toHaveBeenCalled();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onChange).toHaveBeenCalledWith(-1, 'track');
    });

    it('ignores a second finger', () => {
      const { onChange, slider, touch } = setup();
      fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
      fireEvent.pointerDown(slider, {
        pointerId: 8,
        pointerType: 'touch',
        isPrimary: false,
        clientX: 50,
      });
      fireEvent.pointerUp(slider, { pointerId: 8, clientX: 50 });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(slider, { ...touch, clientX: 450 });
      expect(onChange).toHaveBeenCalledWith(1500, 'track');
    });

    describe('a gesture whose end never arrives', () => {
      it('lets the next press replace it without committing it', () => {
        const { onChange, slider, heading, touch } = setup();
        // A drag whose pointerup and pointercancel are both lost.
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        fireEvent.pointerMove(slider, { ...touch, clientX: 50 });
        expect(heading()).toBe('500');
        // The next drag, with a new pointer id, works at once.
        fireEvent.pointerDown(slider, {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 250,
        });
        fireEvent.pointerMove(slider, {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 450,
        });
        fireEvent.pointerUp(slider, {
          pointerId: 9,
          pointerType: 'touch',
          clientX: 450,
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(1500, 'track');
        // The stale pointer's late events change nothing.
        fireEvent.pointerUp(slider, { ...touch, clientX: 50 });
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      it('lets a press with the same pointer id replace it', () => {
        const { onChange, slider, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 50 });
        fireEvent.pointerMove(slider, { ...touch, clientX: 150 });
        fireEvent.pointerDown(slider, { ...touch, clientX: 550 });
        fireEvent.pointerUp(slider, { ...touch, clientX: 550 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
      });

      it('commits when the pointerup lands outside the ruler', () => {
        const { onChange, slider, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        fireEvent.pointerMove(slider, { ...touch, clientX: 150 });
        // Capture failed: the finger lifts over the map.
        fireEvent.pointerUp(document.body, { ...touch, clientX: 150 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-1, 'track');
        expect(document.querySelector('.timeline')).not.toHaveAttribute(
          'data-dragging',
        );
      });

      it('keeps a real drag when the pointercancel lands outside the ruler', () => {
        const { onChange, slider, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        fireEvent.pointerMove(slider, { ...touch, clientX: 50 });
        fireEvent.pointerCancel(document.body, { ...touch, clientX: 50 });
        expect(onChange).toHaveBeenCalledWith(-500, 'track');
      });

      it('ignores the end of other pointers outside the ruler', () => {
        const { onChange, slider, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        fireEvent.pointerUp(document.body, { pointerId: 40, clientX: 50 });
        expect(document.querySelector('.timeline')).toHaveAttribute(
          'data-dragging',
          'true',
        );
        fireEvent.pointerUp(slider, { ...touch, clientX: 550 });
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
      });

      it.each([
        ['the window loses focus', () => fireEvent.blur(window)],
        [
          'the page is hidden',
          () => {
            Object.defineProperty(document, 'visibilityState', {
              configurable: true,
              get: () => 'hidden',
            });
            fireEvent(document, new Event('visibilitychange'));
            delete (document as { visibilityState?: string }).visibilityState;
          },
        ],
      ])('forgets a drag when %s', (_, lose) => {
        const { onChange, slider, heading, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        fireEvent.pointerMove(slider, { ...touch, clientX: 50 });
        act(lose);
        expect(onChange).not.toHaveBeenCalled();
        expect(heading()).toBe('1492');
        expect(document.querySelector('.timeline')).not.toHaveAttribute(
          'data-dragging',
        );
        // Its late pointerup is ignored; the next press works.
        fireEvent.pointerUp(slider, { ...touch, clientX: 50 });
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.pointerDown(slider, { ...touch, clientX: 550 });
        fireEvent.pointerUp(slider, { ...touch, clientX: 550 });
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
      });
    });

    describe('Touch Events fallback', () => {
      it('drives a drag and commits once when no pointer events arrive', () => {
        const { onChange, ruler, slider, heading } = setup();
        const start = touchEvent(slider, 'touchstart', 350);
        expect(start.defaultPrevented).toBe(true);
        const move = touchEvent(slider, 'touchmove', 450);
        expect(move.defaultPrevented).toBe(true);
        touchEvent(slider, 'touchmove', 150);
        expect(heading()).toBe('1');
        expect(ruler.closest('.timeline')).toHaveAttribute(
          'data-dragging',
          'true',
        );
        expect(onChange).not.toHaveBeenCalled();
        const end = touchEvent(slider, 'touchend', 150);
        expect(end.defaultPrevented).toBe(true);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-1, 'track');
      });

      it('jumps to a tapped printed year and discards a cancelled tap', () => {
        const { onChange, slider } = setup();
        touchEvent(slider, 'touchstart', 550);
        touchEvent(slider, 'touchend', 550);
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
        onChange.mockClear();
        touchEvent(slider, 'touchstart', 50);
        touchEvent(slider, 'touchcancel', 51);
        expect(onChange).not.toHaveBeenCalled();
      });

      it('ignores a second finger and a lost touch never blocks the next', () => {
        const { onChange, slider } = setup();
        touchEvent(slider, 'touchstart', 350, { id: 1 });
        // A second finger joins: ignored.
        touchEvent(slider, 'touchstart', 50, { id: 2, others: 1 });
        touchEvent(slider, 'touchmove', 450, { id: 1 });
        // The first gesture's touchend is lost; a new touch replaces it.
        touchEvent(slider, 'touchstart', 50, { id: 4 });
        touchEvent(slider, 'touchmove', 150, { id: 4 });
        touchEvent(slider, 'touchend', 150, { id: 4 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-1, 'track');
      });

      it('commits once when pointer and touch events both arrive', async () => {
        const { onChange, slider, ruler, touch } = setup();
        // Pointer events first (Safari and Chrome order): they drive it.
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        const start = touchEvent(slider, 'touchstart', 350);
        expect(start.defaultPrevented).toBe(false);
        fireEvent.pointerMove(ruler, { ...touch, clientX: 150 });
        // A touchmove for the same finger at another x is not applied.
        touchEvent(slider, 'touchmove', 550);
        expect(document.querySelector('[data-year-heading]')?.textContent).toBe(
          '1',
        );
        fireEvent.pointerUp(ruler, { ...touch, clientX: 150 });
        touchEvent(slider, 'touchend', 150);
        await nextTask();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-1, 'track');
      });

      it('commits once when touch events arrive before pointer events', async () => {
        const { onChange, slider, ruler, touch } = setup();
        touchEvent(slider, 'touchstart', 350);
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        touchEvent(slider, 'touchmove', 550);
        fireEvent.pointerMove(ruler, { ...touch, clientX: 150 });
        touchEvent(slider, 'touchend', 550);
        fireEvent.pointerUp(ruler, { ...touch, clientX: 150 });
        await nextTask();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
      });

      it('ends a pointer drag from its touchend when the pointerup is lost', async () => {
        const { onChange, slider, ruler, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        touchEvent(slider, 'touchstart', 350);
        fireEvent.pointerMove(ruler, { ...touch, clientX: 50 });
        touchEvent(slider, 'touchend', 50);
        expect(onChange).not.toHaveBeenCalled();
        await nextTask();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-500, 'track');
      });

      it('does not take a later touch for the twin of a stale pointer press', () => {
        const { onChange, slider, ruler, touch } = setup();
        const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
        // A touch's pointerdown whose touchstart never came, and no end.
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        now.mockReturnValue(5000);
        // Seconds later, a touch-only drag: it replaces the stale press.
        touchEvent(slider, 'touchstart', 350, { id: 6 });
        touchEvent(slider, 'touchmove', 50, { id: 6 });
        expect(document.querySelector('[data-year-heading]')?.textContent).toBe(
          '500',
        );
        touchEvent(slider, 'touchend', 50, { id: 6 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(-500, 'track');
        // The stale pointer's late events change nothing.
        fireEvent.pointerUp(ruler, { ...touch, clientX: 550 });
        expect(onChange).toHaveBeenCalledTimes(1);
        now.mockRestore();
      });

      it('hands a drag to touch events when pointers cancel before it moves', () => {
        const { onChange, slider, ruler, touch } = setup();
        fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
        touchEvent(slider, 'touchstart', 350);
        fireEvent.pointerCancel(ruler, { ...touch, clientX: 350 });
        touchEvent(slider, 'touchmove', 450);
        touchEvent(slider, 'touchmove', 550);
        expect(onChange).not.toHaveBeenCalled();
        touchEvent(slider, 'touchend', 550);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(1914, 'track');
      });
    });
  });
});

describe('Timeline gesture analytics', () => {
  const touch = { pointerId: 7, pointerType: 'touch' };
  const gestures = () =>
    trackMock.mock.calls.filter(([name]) => name === 'timeline_gesture');

  // Fresh module per test: the replaced-press report is once per page.
  const setup = async () => {
    trackMock.mockClear();
    vi.resetModules();
    const { default: FreshTimeline } = await import('../Timeline');
    const onChange = vi.fn();
    render(<FreshTimeline years={years} value={1492} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () =>
      ({ left: 0, width: 600, top: 0, height: 16 }) as DOMRect;
    const ruler = slider.closest('.timeline__ruler') as HTMLElement;
    const { track: freshTrack } = await import('../../lib/analytics');
    return { onChange, slider, ruler, track: vi.mocked(freshTrack) };
  };

  it('reports a pointer touch drag once, even when touch events also fire', async () => {
    const { slider, ruler, track } = await setup();
    fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
    touchEvent(slider, 'touchstart', 350);
    fireEvent.pointerMove(ruler, { ...touch, clientX: 150 });
    touchEvent(slider, 'touchmove', 150);
    fireEvent.pointerUp(ruler, { ...touch, clientX: 150 });
    touchEvent(slider, 'touchend', 150);
    await nextTask();
    const calls = track.mock.calls.filter(([n]) => n === 'timeline_gesture');
    expect(calls).toEqual([
      [
        'timeline_gesture',
        { outcome: 'committed', pointer: 'touch', years_moved: 2 },
      ],
    ]);
  });

  it("reports a drag driven by the Touch Events fallback as 'touch-events'", async () => {
    const { slider, track } = await setup();
    touchEvent(slider, 'touchstart', 350);
    touchEvent(slider, 'touchmove', 50);
    touchEvent(slider, 'touchend', 50);
    expect(track).toHaveBeenCalledWith('timeline_gesture', {
      outcome: 'committed',
      pointer: 'touch-events',
      years_moved: 3,
    });
  });

  it("reports a drag handed over to touch events as 'touch-events'", async () => {
    const { slider, ruler, track } = await setup();
    fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
    touchEvent(slider, 'touchstart', 350);
    fireEvent.pointerCancel(ruler, { ...touch, clientX: 350 });
    touchEvent(slider, 'touchmove', 550);
    touchEvent(slider, 'touchend', 550);
    expect(track.mock.calls.filter(([n]) => n === 'timeline_gesture')).toEqual([
      [
        'timeline_gesture',
        { outcome: 'committed', pointer: 'touch-events', years_moved: 2 },
      ],
    ]);
  });

  it('still reports a lost capture', async () => {
    const { slider, ruler, track } = await setup();
    fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
    fireEvent.pointerMove(slider, { ...touch, clientX: 150 });
    fireEvent.lostPointerCapture(ruler, touch);
    await nextTask();
    expect(track).toHaveBeenCalledWith('timeline_gesture', {
      outcome: 'lost_capture',
      pointer: 'touch',
      years_moved: 2,
    });
  });

  it('reports a replaced stale press once per page', async () => {
    const { onChange, slider, ruler, track } = await setup();
    // A finger's pointer and touch events, then both ends are lost.
    fireEvent.pointerDown(slider, { ...touch, clientX: 350 });
    touchEvent(slider, 'touchstart', 350, { id: 4 });
    fireEvent.pointerMove(ruler, { ...touch, clientX: 50 });
    // The stale press is replaced, not reported as a gesture.
    touchEvent(slider, 'touchstart', 550, { id: 5 });
    touchEvent(slider, 'touchend', 550, { id: 5 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const replaced = track.mock.calls.filter(
      ([n]) => n === 'timeline_press_replaced',
    );
    expect(replaced).toEqual([
      [
        'timeline_press_replaced',
        { pointer: 'touch-events', stale_ms: expect.any(Number) },
      ],
    ]);
    expect(track.mock.calls.filter(([n]) => n === 'timeline_gesture')).toEqual([
      [
        'timeline_gesture',
        { outcome: 'tap', pointer: 'touch-events', years_moved: 2 },
      ],
    ]);

    // A second stale press on the same page is replaced silently.
    fireEvent.pointerDown(slider, {
      pointerId: 9,
      pointerType: 'pen',
      clientX: 50,
    });
    fireEvent.pointerDown(slider, {
      pointerId: 10,
      pointerType: 'pen',
      clientX: 150,
    });
    expect(
      track.mock.calls.filter(([n]) => n === 'timeline_press_replaced'),
    ).toHaveLength(1);
  });

  it('does not report mouse clicks that change the year', async () => {
    const { slider, track } = await setup();
    fireEvent.pointerDown(slider, { button: 0, clientX: 550, pointerId: 1 });
    fireEvent.pointerUp(slider, { clientX: 550, pointerId: 1 });
    expect(gestures()).toHaveLength(0);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('Timeline year chooser and ruler labels', () => {
  const allYears = historicalManifest.years;

  // jsdom has no layout; give the track a width so labels are chosen.
  const renderWithWidth = (width: number, value = 1492, list = allYears) => {
    widthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(width);
    const onChange = vi.fn();
    render(<Timeline years={list} value={value} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    slider.getBoundingClientRect = () =>
      ({ left: 0, width, top: 0, height: 36 }) as DOMRect;
    return onChange;
  };

  let widthSpy: { mockRestore: () => void } | undefined;
  afterEach(() => widthSpy?.mockRestore());

  // 1392 px is the ruler of the 1440 px Direction A desktop mock.
  it('selects a year by clicking its printed label', () => {
    const onChange = renderWithWidth(1392);
    const label = screen.getByText('1914');
    expect(label).toHaveClass('timeline__label');
    // Press slightly off the tick: the label's own year still wins.
    fireEvent.pointerDown(label, { button: 0, clientX: 1160, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 1162, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 1162, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(1914, 'track');
  });

  it('scrubs from a printed label when the pointer drags away', () => {
    const onChange = renderWithWidth(1392);
    const label = screen.getByText('1914');
    fireEvent.pointerDown(label, { button: 0, clientX: 1160, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 1391, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 1391, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(2010, 'track');
  });

  it('treats the era row as part of the track', () => {
    const onChange = renderWithWidth(1392);
    const era = screen.getByText('Prehistory');
    fireEvent.pointerDown(era, { button: 0, clientX: 2, pointerId: 1 });
    fireEvent.pointerUp(era, { clientX: 2, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(-123000, 'track');
  });

  it('lists every year by era in a native select', () => {
    const onChange = renderWithWidth(1150);
    const select = screen.getByRole('combobox', { name: 'Choose a year' });
    expect(select).toHaveValue('1492');
    expect(screen.getAllByRole('option')).toHaveLength(allYears.length);
    const groups = Array.from(select.querySelectorAll('optgroup')).map(
      (group) => group.label,
    );
    expect(groups).toEqual([
      'Prehistory',
      'Ancient',
      'Medieval',
      'Early modern',
      'Modern',
    ]);
    expect(
      screen.getByRole('option', { name: '123,000 BC' }),
    ).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '1815' } });
    expect(onChange).toHaveBeenCalledWith(1815, 'select');
  });

  it('uses short era names when the bands are narrow', () => {
    renderWithWidth(362);
    const eraNames = Array.from(
      document.querySelectorAll('.timeline__era-label'),
    ).map((element) => element.textContent);
    // Direction A's larger small caps: narrow washes go unlabelled rather than clip.
    expect(eraNames).toEqual(['', 'Ancient', 'Medieval', '', 'Modern']);
    // The current era is still named in full under the large year.
    expect(document.querySelector('.timeline__current-era')).toHaveTextContent(
      'Medieval',
    );
  });

  it('chooses era names that fit at phone and desktop widths', () => {
    const spans = eraSpans(allYears);
    // A 390 px phone leaves a 362 px track after gutters and padding.
    expect(
      spans.map((span) => eraBandLabel(span, allYears.length, 362)),
    ).toEqual(['', 'Ancient', 'Medieval', '', 'Modern']);
    // A 1024 px tablet: the prehistory wash takes the short name.
    expect(
      spans.map((span) => eraBandLabel(span, allYears.length, 976)),
    ).toEqual(['Pre.', 'Ancient', 'Medieval', 'Early', 'Modern']);
    // The 1440 px desktop of the design mock.
    expect(
      spans.map((span) => eraBandLabel(span, allYears.length, 1392)),
    ).toEqual(spans.map((span) => span.era.label));
    expect(eraBandLabel(spans[0], allYears.length, 0)).toBe('Prehistory');
  });
});

describe('ruler labels', () => {
  it('abbreviates deep-time years', () => {
    expect(formatRulerLabel(-123000)).toBe('123k BC');
    expect(formatRulerLabel(-3000)).toBe('3,000 BC');
    expect(formatRulerLabel(1492)).toBe('1492');
  });

  it('never lets chosen labels overlap and always labels both ends', () => {
    const all = historicalManifest.years;
    [320, 768, 1200].forEach((width) => {
      const chosen = Array.from(chooseLabelledTicks(all, width)).sort(
        (a, b) => a - b,
      );
      const step = width / all.length;
      const extent = (index: number) => {
        const w = formatRulerLabel(all[index]).length * 6.6 + 14;
        const c = (index + 0.5) * step;
        if (index === 0) return [c - 4, c - 4 + w];
        if (index === all.length - 1) return [c + 4 - w, c + 4];
        return [c - w / 2, c + w / 2];
      };
      chosen.slice(1).forEach((index, i) => {
        expect(extent(index)[0]).toBeGreaterThanOrEqual(extent(chosen[i])[1]);
      });
      expect(chosen[0]).toBe(0);
      expect(chosen[chosen.length - 1]).toBe(all.length - 1);
    });
    expect(chooseLabelledTicks(all, 0).size).toBe(0);
  });

  it('always prints the selected year (Direction A)', () => {
    const all = historicalManifest.years;
    const selected = all.indexOf(1492);
    [320, 768, 1200].forEach((width) => {
      expect(chooseLabelledTicks(all, width, selected).has(selected)).toBe(
        true,
      );
    });
    // Without a selection the choice is unchanged.
    expect(chooseLabelledTicks(all, 1200, -1)).toEqual(
      chooseLabelledTicks(all, 1200),
    );
  });
});
