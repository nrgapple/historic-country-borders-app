import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Welcome, { RELEASE_NOTES, TOUR_CARDS } from '../Welcome';
import type { WelcomeView } from '../../atlas/store';

// jsdom has no PointerEvent; a MouseEvent with the pointer fields stands in.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  window.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

function Harness({
  initial = 'notes',
  onClose = () => undefined,
  autoFocus = false,
}: {
  initial?: WelcomeView;
  onClose?: () => void;
  autoFocus?: boolean;
}) {
  const [view, setView] = useState<WelcomeView>(initial);
  return (
    <Welcome
      view={view}
      onViewChange={setView}
      onClose={onClose}
      autoFocus={autoFocus}
    />
  );
}

describe('Welcome', () => {
  it('lists the release notes in a labelled, non-modal dialog', () => {
    render(<Harness />);
    const dialog = screen.getByRole('dialog', {
      name: 'Historic Borders is back',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(RELEASE_NOTES.length).toBeGreaterThanOrEqual(4);
    expect(RELEASE_NOTES.length).toBeLessThanOrEqual(6);
    expect(screen.getAllByRole('listitem')).toHaveLength(RELEASE_NOTES.length);
    // An automatic open never moves focus.
    expect(document.activeElement).toBe(document.body);
  });

  it('copy stays plain: no exclamation marks or emoji', () => {
    const copy = [
      ...RELEASE_NOTES.flatMap((n) => [n.title, n.text]),
      ...TOUR_CARDS.flatMap((c) => [c.title, c.text]),
    ].join(' ');
    expect(copy).not.toMatch(/!/);
    expect(copy).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it('opens the tour, announces the position, and moves with the buttons', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Take a quick tour' }));

    expect(screen.getByRole('group', { name: 'Quick tour' })).toHaveAttribute(
      'aria-roledescription',
      'carousel',
    );
    expect(screen.getByText('Card 1 of 5')).toBeVisible();
    expect(screen.getByRole('heading', { name: TOUR_CARDS[0].title }));
    // Focus moves to the heading when the visitor changes page.
    expect(document.activeElement).toHaveTextContent('Things to try in class');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Card 2 of 5')).toBeVisible();
    expect(screen.getByRole('group', { name: 'Card 2 of 5' })).toHaveAttribute(
      'aria-roledescription',
      'slide',
    );
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByText('Card 1 of 5')).toBeVisible();

    // The first card's back button returns to the release notes.
    await user.click(screen.getByRole('button', { name: 'What’s new' }));
    expect(
      screen.getByRole('heading', { name: 'Historic Borders is back' }),
    ).toBeVisible();
  });

  it('moves with the arrow keys, Home and End without reaching the page', () => {
    const pageKeys = vi.fn();
    document.addEventListener('keydown', pageKeys);
    render(<Harness initial="tour" />);
    const next = screen.getByRole('button', { name: 'Next' });
    next.focus();

    fireEvent.keyDown(next, { key: 'ArrowRight' });
    expect(screen.getByText('Card 2 of 5')).toBeVisible();
    fireEvent.keyDown(next, { key: 'End' });
    expect(screen.getByText('Card 5 of 5')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Start exploring' }),
    ).toBeVisible();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByText('Card 5 of 5')).toBeVisible();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByText('Card 4 of 5')).toBeVisible();
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(screen.getByText('Card 1 of 5')).toBeVisible();

    // The timeline's page-wide arrow keys never see these presses.
    expect(pageKeys).not.toHaveBeenCalled();
    document.removeEventListener('keydown', pageKeys);
  });

  it('follows a horizontal swipe on touch and ignores vertical scrolls', () => {
    render(<Harness initial="tour" />);
    const viewport = screen
      .getByRole('group', { name: 'Card 1 of 5' })
      .closest('.tour__viewport')!;
    const swipe = (from: [number, number], to: [number, number]) => {
      fireEvent.pointerDown(viewport, {
        pointerType: 'touch',
        pointerId: 1,
        clientX: from[0],
        clientY: from[1],
      });
      fireEvent.pointerUp(viewport, {
        pointerType: 'touch',
        pointerId: 1,
        clientX: to[0],
        clientY: to[1],
      });
    };
    swipe([300, 100], [180, 110]);
    expect(screen.getByText('Card 2 of 5')).toBeVisible();
    swipe([200, 100], [210, 300]);
    expect(screen.getByText('Card 2 of 5')).toBeVisible();
    swipe([100, 100], [220, 100]);
    expect(screen.getByText('Card 1 of 5')).toBeVisible();
  });

  it('gives every card an illustration and a title', () => {
    render(<Harness initial="tour" />);
    for (let i = 0; i < TOUR_CARDS.length; i += 1) {
      const slide = screen.getByRole('group', {
        name: `Card ${i + 1} of ${TOUR_CARDS.length}`,
      });
      expect(slide.querySelector('svg')).not.toBeNull();
      expect(slide.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      expect(slide).toHaveTextContent(TOUR_CARDS[i].title);
      fireEvent.keyDown(slide, { key: 'ArrowRight' });
    }
  });

  it('closes on Escape, the close button and the last card', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Harness initial="tour" onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), {
      key: 'Escape',
    });
    await user.click(screen.getByRole('button', { name: 'Close welcome' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Next' }), {
      key: 'End',
    });
    await user.click(screen.getByRole('button', { name: 'Start exploring' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('takes focus when the visitor opened it', () => {
    render(<Harness initial="tour" autoFocus />);
    expect(document.activeElement).toHaveTextContent('Things to try in class');
  });
});
