import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CountryInfo from '../CountryInfo';
import { useCountryInfo } from '../../hooks/useCountryInfo';

vi.mock('../../hooks/useCountryInfo', () => ({ useCountryInfo: vi.fn() }));

describe('CountryInfo', () => {
  beforeEach(() => {
    vi.mocked(useCountryInfo).mockReturnValue({
      title: 'French Republic',
      info: 'France is a country in Europe.',
      isLoading: false,
      isError: undefined,
    });
  });

  it('renders Wikipedia information and closes', () => {
    const onClose = vi.fn();
    render(<CountryInfo info={{ place: 'France' }} onClose={onClose} />);
    expect(useCountryInfo).toHaveBeenCalledWith('France');
    expect(screen.getByText('French Republic')).toBeInTheDocument();
    expect(
      screen.getByText('France is a country in Europe.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close country information'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('renders loading and unavailable states', () => {
    vi.mocked(useCountryInfo).mockReturnValue({
      title: 'France',
      info: '',
      isLoading: true,
      isError: undefined,
    });
    const { rerender } = render(<CountryInfo info={{ place: 'France' }} />);
    expect(screen.getByText('📚 Loading information...')).toHaveClass(
      'loading',
    );

    vi.mocked(useCountryInfo).mockReturnValue({
      title: 'France',
      info: 'Not Found',
      isLoading: false,
      isError: undefined,
    });
    rerender(<CountryInfo info={{ place: 'France' }} />);
    expect(screen.getByText(/No Wikipedia information available/)).toHaveClass(
      'empty',
    );
  });

  it('does not render without a selected place', () => {
    const { container } = render(<CountryInfo info={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
