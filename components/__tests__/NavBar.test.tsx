import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NavBar from '../NavBar';

vi.mock('../Help', () => ({ default: () => <div>Help content</div> }));

describe('NavBar', () => {
  it('renders its title, opens help, and conditionally shows help content', () => {
    const onHelp = vi.fn();
    const { rerender } = render(
      <NavBar title="Historic Borders" onHelp={onHelp} showHelp={false} />,
    );
    expect(screen.getByText(/Historic Borders/)).toBeInTheDocument();
    expect(screen.queryByText('Help content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('❔'));
    expect(onHelp).toHaveBeenCalledOnce();

    rerender(
      <NavBar title="Historic Borders" onHelp={onHelp} showHelp={true} />,
    );
    expect(screen.getByText('Help content')).toBeInTheDocument();
  });
});
