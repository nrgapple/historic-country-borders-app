import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import historicalManifest from '@repo/data/historical-manifest.json';
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
      fireEvent.pointerDown(slider, { pointerId: 8, clientX: 50 });
      fireEvent.pointerUp(slider, { pointerId: 8, clientX: 50 });
      expect(onChange).not.toHaveBeenCalled();
      fireEvent.pointerUp(slider, { ...touch, clientX: 450 });
      expect(onChange).toHaveBeenCalledWith(1500, 'track');
    });
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
