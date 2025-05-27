import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Make React available globally for JSX
global.React = React

// Mock Mapbox GL JS
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock URL.createObjectURL
Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: vi.fn(() => 'mocked-url'),
})

// Mock mapbox-gl
vi.mock('mapbox-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getStyle: vi.fn(() => ({
        imports: [{ data: { layers: [] } }]
      })),
      setStyle: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
      resize: vi.fn(),
    })),
    accessToken: 'mock-token',
  },
}))

// Mock react-map-gl
vi.mock('react-map-gl', () => ({
  Map: vi.fn(({ children }) => children),
  Source: vi.fn(({ children }) => children),
  Layer: vi.fn(() => null),
  Popup: vi.fn(({ children }) => children),
  NavigationControl: vi.fn(() => null),
})) 