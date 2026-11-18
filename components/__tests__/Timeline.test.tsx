import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import historicalManifest from '../../data/historical-manifest.json';
import Timeline, {
  chooseLabelledTicks,
  eraBandLabel,
  formatRulerLabel,
} from '../Timeline';
import { eraSpans } from '../../lib/years';

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

  it('selects a year by clicking its printed label', () => {
    const onChange = renderWithWidth(1150);
    const label = screen.getByText('1914');
    expect(label).toHaveClass('timeline__label');
    // Press slightly off the tick: the label's own year still wins.
    fireEvent.pointerDown(label, { button: 0, clientX: 1000, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 1002, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 1002, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(1914, 'track');
  });

  it('scrubs from a printed label when the pointer drags away', () => {
    const onChange = renderWithWidth(1150);
    const label = screen.getByText('1914');
    fireEvent.pointerDown(label, { button: 0, clientX: 960, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 1149, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 1149, pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith(2010, 'track');
  });

  it('treats the era row as part of the track', () => {
    const onChange = renderWithWidth(1150);
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
    expect(eraNames).toEqual([
      'Pre.',
      'Ancient',
      'Medieval',
      'Early',
      'Modern',
    ]);
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
    ).toEqual(['Pre.', 'Ancient', 'Medieval', 'Early', 'Modern']);
    expect(
      spans.map((span) => eraBandLabel(span, allYears.length, 1150)),
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
});
