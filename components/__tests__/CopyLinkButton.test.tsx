import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CopyLinkButton, { copyText } from '../CopyLinkButton';
import ProjectorCaption from '../ProjectorCaption';

const URL_TO_SHARE = 'https://example.com/year/1492?place=Ottoman+Empire';

const setClipboard = (clipboard: Partial<Clipboard> | undefined) =>
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });

describe('CopyLinkButton', () => {
  afterEach(() => {
    setClipboard(undefined);
    vi.useRealTimers();
  });

  it('copies the link and briefly confirms it', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CopyLinkButton getUrl={() => URL_TO_SHARE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(writeText).toHaveBeenCalledWith(URL_TO_SHARE);
    expect(screen.getByRole('status')).toHaveTextContent('Link copied');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('falls back to a selected read-only field without a clipboard', async () => {
    setClipboard(undefined);
    render(<CopyLinkButton getUrl={() => URL_TO_SHARE} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    const field = screen.getByRole('textbox', { name: /Copy this link/ });
    expect(field).toHaveValue(URL_TO_SHARE);
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveFocus();
    const input = field as HTMLInputElement;
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(URL_TO_SHARE.length);
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('falls back when the browser refuses clipboard access', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(copyText('x')).resolves.toBe(false);
    render(<CopyLinkButton />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(screen.getByRole('textbox')).toHaveValue(window.location.href);
  });
});

describe('ProjectorCaption', () => {
  it('shows the year and the selected place', () => {
    const { rerender, container } = render(
      <ProjectorCaption title="1492 AD" place="Ottoman Empire" />,
    );
    expect(screen.getByText('1492 AD')).toBeVisible();
    expect(screen.getByText('Ottoman Empire')).toBeVisible();
    rerender(<ProjectorCaption />);
    expect(container).toBeEmptyDOMElement();
  });
});
