import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import historicalManifest from '../../data/historical-manifest.json';
import Timeline, { chooseLabelledTicks, formatRulerLabel } from '../Timeline';

// jsdom lacks PointerEvent; a MouseEvent subclass carries clientX and pointerId.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

const years = [-500, -1, 100, 1492, 1500, 1914];

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
});
