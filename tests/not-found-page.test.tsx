import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import NotFoundPage from '../pages/404';

describe('404 page', () => {
  it('names where each recovery link leads', () => {
    render(<NotFoundPage />);
    expect(
      screen.getByRole('heading', { name: 'That map is not available' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open a random year' }),
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'See the world in 1914' }),
    ).toHaveAttribute('href', '/year/1914');
    expect(
      screen.getByRole('link', { name: 'Open Pennsylvania school districts' }),
    ).toHaveAttribute('href', '/pa/school-districts');
  });
});
