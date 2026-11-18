import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PlaceFinder from '../PlaceFinder';
import type { PlaceOption } from '../../lib/places';

const OPTIONS: PlaceOption[] = [
  { name: 'Ottoman Empire', label: 'Ottoman Empire', keywords: [] },
  { name: 'Kingdom of Ottomania', label: 'Kingdom of Ottomania', keywords: [] },
  { name: 'Mamluke Sultanate', label: 'Mamluke Sultanate', keywords: [] },
  {
    name: 'Pen Argyl Area',
    label: 'Pen Argyl Area School District',
    detail: 'Northampton County',
    keywords: ['Pen Argyl Area', 'Northampton County'],
  },
];

const setup = (
  props: Partial<React.ComponentProps<typeof PlaceFinder>> = {},
) => {
  const onSelect = vi.fn();
  render(<PlaceFinder options={OPTIONS} onSelect={onSelect} {...props} />);
  const input = screen.getByRole('combobox', { name: 'Find a place' });
  return { onSelect, input, user: userEvent.setup() };
};

describe('PlaceFinder', () => {
  it('is a labelled combobox that lists ranked matches', async () => {
    const { input, user } = setup();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');

    await user.type(input, 'otto');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Ottoman Empire', 'Kingdom of Ottomania']);
    expect(screen.getByRole('status')).toHaveTextContent('2 places found');
  });

  it('moves through results with the arrow keys and chooses with Enter', async () => {
    const { input, onSelect, user } = setup();
    await user.type(input, 'otto');

    await user.keyboard('{ArrowDown}');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    await user.keyboard('{ArrowDown}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}');
    // Wraps to the first result.
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowUp}');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(input).toHaveValue('Kingdom of Ottomania');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveFocus();
  });

  it('chooses the best match on Enter when no result is active', async () => {
    const { input, onSelect, user } = setup();
    await user.type(input, 'ottoman{Enter}');
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[0]);
  });

  it('matches districts by county and shows the county', async () => {
    const { input, onSelect, user } = setup();
    await user.type(input, 'northamp');
    const option = screen.getByRole('option', {
      name: /Pen Argyl Area School District/,
    });
    expect(option).toHaveTextContent('Northampton County');
    await user.click(option);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[3]);
  });

  it('closes on Escape, then clears, without letting Escape bubble', async () => {
    const { input, user } = setup();
    const documentEscape = vi.fn();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') documentEscape();
    };
    document.addEventListener('keydown', onKeyDown);

    await user.type(input, 'mam');
    expect(screen.getByRole('listbox')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveValue('mam');
    await user.keyboard('{Escape}');
    expect(input).toHaveValue('');
    expect(documentEscape).not.toHaveBeenCalled();
    document.removeEventListener('keydown', onKeyDown);
  });

  it('reports when nothing matches', async () => {
    const { input, user } = setup();
    await user.type(input, 'atlantis');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No places match “atlantis”.')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('No places match');
  });

  it('opens from a search button when collapsible', async () => {
    const onSelect = vi.fn();
    render(<PlaceFinder options={OPTIONS} onSelect={onSelect} collapsible />);
    fireEvent.click(screen.getByRole('button', { name: 'Find a place' }));
    const input = screen.getByRole('combobox', { name: 'Find a place' });
    expect(input).toHaveFocus();
    expect(
      screen.getByRole('button', { name: 'Close search' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Find a place' }),
    ).not.toBeInTheDocument();

    // Choosing folds the field away again so the toolbar is reachable.
    fireEvent.change(input, { target: { value: 'mam' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[2]);
    expect(
      screen.getByRole('button', { name: 'Find a place' }),
    ).toBeInTheDocument();
  });
});
