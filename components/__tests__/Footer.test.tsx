import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'
import { InfoProviderProvider } from '../../contexts/InfoProviderContext'

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <InfoProviderProvider>
    {children}
  </InfoProviderProvider>
)

describe('Footer', () => {
  it('should render with default props', () => {
    render(<Footer />, { wrapper: TestWrapper })
    
    expect(screen.getByText('🌎')).toBeInTheDocument()
    expect(screen.getByText('HistoricBorders')).toBeInTheDocument()
    expect(screen.getByText('🌎 HistoricBorders.app')).toBeInTheDocument()
  })

  it('should render data source link with default URL', () => {
    render(<Footer />, { wrapper: TestWrapper })
    
    const dataSourceLink = screen.getByText('📊 Data Source')
    expect(dataSourceLink).toBeInTheDocument()
    expect(dataSourceLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/nrgapple/historicborders-timeline-example'
    )
  })

  it('should render GitHub link', () => {
    render(<Footer />, { wrapper: TestWrapper })
    
    const githubLink = screen.getByText('⭐️ Star on GitHub')
    expect(githubLink).toBeInTheDocument()
    expect(githubLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/nrgapple/historic-country-borders-app'
    )
  })

  it('should render custom data URL when provided', () => {
    const customDataUrl = 'https://custom-data-source.com'
    render(<Footer dataUrl={customDataUrl} />, { wrapper: TestWrapper })
    
    const dataSourceLink = screen.getByText('📊 Data Source')
    expect(dataSourceLink.closest('a')).toHaveAttribute('href', customDataUrl)
  })

  it('should render last commit date when provided', () => {
    const lastCommit = new Date('2023-12-01')
    render(<Footer lastCommit={lastCommit} />, { wrapper: TestWrapper })
    
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
    expect(screen.getByText(/Nov 30, 2023|Dec 1, 2023/)).toBeInTheDocument()
  })

  it('should not render last commit date when not provided', () => {
    render(<Footer />, { wrapper: TestWrapper })
    
    expect(screen.queryByText(/Updated:/)).not.toBeInTheDocument()
  })

  it('should render discussion URL when provided', () => {
    const discussionUrl = 'https://discussion.example.com'
    render(<Footer discussionUrl={discussionUrl} />, { wrapper: TestWrapper })
    
    const discussionLink = screen.getByText('💬 Community')
    expect(discussionLink).toBeInTheDocument()
    expect(discussionLink.closest('a')).toHaveAttribute('href', discussionUrl)
  })

  it('should render all props together', () => {
    const props = {
      dataUrl: 'https://custom-data.com',
      lastCommit: new Date('2023-06-15'),
      discussionUrl: 'https://community.example.com',
    }
    
    render(<Footer {...props} />, { wrapper: TestWrapper })
    
    // Check all elements are present
    expect(screen.getByText('🌎 HistoricBorders.app')).toBeInTheDocument()
    expect(screen.getByText(/Updated:/)).toBeInTheDocument()
    expect(screen.getByText(/Jun 14, 2023|Jun 15, 2023/)).toBeInTheDocument()
    
    const dataLink = screen.getByText('📊 Data Source')
    expect(dataLink.closest('a')).toHaveAttribute('href', props.dataUrl)
    
    const discussionLink = screen.getByText('💬 Community')
    expect(discussionLink.closest('a')).toHaveAttribute('href', props.discussionUrl)
  })

  it('should have correct CSS classes', () => {
    const { container } = render(<Footer />, { wrapper: TestWrapper })
    
    expect(container.querySelector('.footer-compact')).toBeInTheDocument()
    expect(container.querySelector('.footer-compact-trigger')).toBeInTheDocument()
    expect(container.querySelector('.footer-compact-expanded')).toBeInTheDocument()
  })
}) 