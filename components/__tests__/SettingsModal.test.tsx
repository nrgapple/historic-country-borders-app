import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsModal from '../SettingsModal';

const updateSettings = vi.fn();
const resetToDefaults = vi.fn();
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      textSize: 'medium',
      textCase: 'regular',
      countryOpacity: 0.7,
      borderThickness: 2,
      showLabels: true,
    },
    updateSettings,
    resetToDefaults,
  }),
}));

describe('SettingsModal', () => {
  const onClose = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it('renders only when open and contains visual map settings', () => {
    const { rerender } = render(
      <SettingsModal isOpen={false} onClose={onClose} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<SettingsModal isOpen onClose={onClose} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('🏷️ Map Labels')).toBeInTheDocument();
    expect(screen.getByText('📝 Text Size')).toBeInTheDocument();
  });

  it('updates settings and resets defaults', () => {
    render(<SettingsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByText('Large').closest('button')!);
    expect(updateSettings).toHaveBeenCalledWith({ textSize: 'large' });
    fireEvent.click(screen.getByText('🔄 Reset to Defaults'));
    expect(resetToDefaults).toHaveBeenCalled();
  });

  it('closes from the close control and overlay', () => {
    render(<SettingsModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
