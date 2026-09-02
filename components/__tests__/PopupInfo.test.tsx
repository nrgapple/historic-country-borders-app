import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PopupInfo, { Info } from '../PopupInfo';
import { useCountryInfo } from '../../hooks/useCountryInfo';

vi.mock('../../hooks/useCountryInfo', () => ({ useCountryInfo: vi.fn() }));
vi.mock('../../hooks/useScrollLock', () => ({ useAllowScroll: vi.fn() }));
vi.mock('react-ga4', () => ({ default: { event: vi.fn() } }));
vi.mock('react-map-gl', () => ({
  Popup: ({ children, latitude, longitude, style, onClose }: any) => (
    <div
      data-testid="popup"
      data-latitude={latitude}
      data-longitude={longitude}
      style={style}
    >
      <button onClick={onClose}>close</button>
      {children}
    </div>
  ),
}));

const selected: Info = { position: [10.5, 20.3], place: 'France' };

describe('PopupInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCountryInfo).mockReturnValue({
      info: 'France is a country in Europe.',
      title: 'France',
      isLoading: false,
      isError: undefined,
    });
  });

  it('shows Wikipedia content and attribution', () => {
    render(<PopupInfo info={selected} />);
    expect(useCountryInfo).toHaveBeenCalledWith('France');
    expect(
      screen.getByText('France is a country in Europe.'),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Wikipedia')).toHaveTextContent('📖');
    expect(screen.getByTestId('popup')).toHaveAttribute(
      'data-latitude',
      '20.3',
    );
  });

  it('shows loading and empty states', () => {
    vi.mocked(useCountryInfo).mockReturnValue({
      info: '',
      title: 'France',
      isLoading: true,
      isError: undefined,
    });
    const { rerender } = render(<PopupInfo info={selected} />);
    expect(screen.getByText('📚 Loading information...')).toHaveClass(
      'popup-description',
      'loading',
    );

    vi.mocked(useCountryInfo).mockReturnValue({
      info: 'Not Found',
      title: 'France',
      isLoading: false,
      isError: undefined,
    });
    rerender(<PopupInfo info={selected} />);
    expect(screen.getByText(/No Wikipedia information available/)).toHaveClass(
      'popup-description',
      'empty',
    );
  });

  it('does not render without a selection and closes safely', () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <PopupInfo info={undefined} onClose={onClose} />,
    );
    expect(screen.queryByTestId('popup')).not.toBeInTheDocument();
    rerender(<PopupInfo info={selected} onClose={onClose} />);
    fireEvent.click(screen.getByText('close'));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
