import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Help from '../Help'

describe('Help', () => {
  it('should render help content', () => {
    render(<Help />)
    
    expect(screen.getByText('a / d')).toBeInTheDocument()
    expect(screen.getByText('Move timeline')).toBeInTheDocument()
  })

  it('should have correct CSS class', () => {
    const { container } = render(<Help />)
    
    expect(container.firstChild).toHaveClass('help')
  })

  it('should render keyboard shortcut in code element', () => {
    render(<Help />)
    
    const codeElement = screen.getByText('a / d')
    expect(codeElement.tagName).toBe('CODE')
  })

  it('should render all expected elements', () => {
    const { container } = render(<Help />)
    
    const helpDiv = container.querySelector('.help')
    expect(helpDiv).toBeInTheDocument()
    expect(helpDiv?.children).toHaveLength(2)
  })
}) 