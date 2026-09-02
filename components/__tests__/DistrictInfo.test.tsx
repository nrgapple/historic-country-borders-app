import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DistrictInfo from '../DistrictInfo';
import { useCountryInfo } from '../../hooks/useCountryInfo';

vi.mock('../../hooks/useCountryInfo', () => ({ useCountryInfo: vi.fn() }));

describe('DistrictInfo', () => {
  beforeEach(() => {
    vi.mocked(useCountryInfo).mockReturnValue({
      title: 'Example School District',
      info: 'A public school district in Pennsylvania.',
      isLoading: false,
      isError: undefined,
    });
  });

  it('shows source-backed text and known district properties', () => {
    const onClose = vi.fn();
    render(
      <DistrictInfo
        info={{
          districtName: 'Example School District',
          properties: {
            SCHOOL_NAM: 'Example',
            CTY_NAME: 'Example County',
            UNKNOWN: 'not displayed',
          },
        }}
        onClose={onClose}
      />,
    );
    expect(useCountryInfo).toHaveBeenCalledWith('Example School District');
    expect(
      screen.getByText('A public school district in Pennsylvania.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Example County')).toBeInTheDocument();
    expect(screen.queryByText('not displayed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close district information'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps district properties visible when Wikipedia has no result', () => {
    vi.mocked(useCountryInfo).mockReturnValue({
      title: '',
      info: 'Not Found',
      isLoading: false,
      isError: undefined,
    });
    render(
      <DistrictInfo
        info={{
          districtName: 'Example School District',
          properties: { AUN_NUM: 123 },
        }}
      />,
    );
    expect(screen.getByText(/No Wikipedia information available/)).toHaveClass(
      'empty',
    );
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders loading and empty-selection states safely', () => {
    vi.mocked(useCountryInfo).mockReturnValue({
      title: '',
      info: '',
      isLoading: true,
      isError: undefined,
    });
    const { rerender } = render(
      <DistrictInfo info={{ districtName: 'Example School District' }} />,
    );
    expect(screen.getByText('📚 Loading information...')).toHaveClass(
      'loading',
    );
    rerender(<DistrictInfo info={undefined} />);
    expect(
      screen.queryByText('📚 Loading information...'),
    ).not.toBeInTheDocument();
  });
});
