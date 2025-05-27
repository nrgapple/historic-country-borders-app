# Testing Setup

This project uses [Vitest](https://vitest.dev/) for testing, along with React Testing Library for component testing.

## Running Tests

```bash
# Run tests in watch mode (default)
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

## Current Test Coverage

- **93 tests** across 9 test files
- **Overall Coverage**: 20.26% statements, 75.16% branches, 54.05% functions
- **Well-tested modules**:
  - `Footer.tsx`: 100% coverage
  - `Help.tsx`: 100% coverage  
  - `PopupInfo.tsx`: 100% coverage
  - `useKeyPress.tsx`: 100% coverage
  - `useMounted.tsx`: 100% coverage
  - `stringToColor.ts`: 99.09% coverage
  - `queryParams.ts`: 87.23% coverage
  - `constants.ts`: 68.8% coverage

## Test Structure

- **Unit Tests**: Test individual functions and utilities
- **Component Tests**: Test React components in isolation
- **Hook Tests**: Test custom React hooks
- **Integration Tests**: Test component interactions

## Test Files

### Component Tests
- `components/__tests__/MapContainer.test.tsx` - Map container component
- `components/__tests__/Footer.test.tsx` - Footer component with props
- `components/__tests__/PopupInfo.test.tsx` - Popup info component with hooks
- `components/__tests__/Help.test.tsx` - Simple help component

### Hook Tests
- `hooks/__tests__/useKeyPress.test.tsx` - Keyboard event handling
- `hooks/__tests__/useMounted.test.tsx` - Component mount state

### Utility Tests
- `util/__tests__/stringToColor.test.ts` - Color generation functions
- `util/__tests__/constants.test.ts` - Utility functions and constants
- `utils/__tests__/queryParams.test.ts` - URL parameter handling

## Writing Tests

### Component Tests

Component tests are located in `__tests__` directories next to the components they test. Example:

```typescript
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
```

### Hook Tests

Custom hook tests use `renderHook` from React Testing Library:

```typescript
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMyHook } from '../useMyHook'

describe('useMyHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useMyHook())
    expect(result.current).toBe('expected value')
  })
})
```

### Utility Tests

Utility function tests are located in `util/__tests__/` and `utils/__tests__/`. Example:

```typescript
import { describe, it, expect } from 'vitest'
import { myUtilFunction } from '../myUtil'

describe('myUtilFunction', () => {
  it('should return expected result', () => {
    expect(myUtilFunction('input')).toBe('expected output')
  })
})
```

## Mocking

### External Libraries

Common mocks are set up in `test/setup.ts`:
- Mapbox GL JS
- React Map GL
- ResizeObserver
- matchMedia
- body-scroll-lock

### Custom Hooks

Mock custom hooks in individual test files:

```typescript
vi.mock('../../hooks/useMyHook', () => ({
  useMyHook: vi.fn(() => ({ data: 'mocked data' })),
}))
```

### Event Testing

Test keyboard and mouse events:

```typescript
import { act } from '@testing-library/react'

act(() => {
  const keydownEvent = new KeyboardEvent('keydown', { key: 'Enter' })
  window.dispatchEvent(keydownEvent)
})
```

## Configuration

- **Vitest Config**: `vitest.config.ts`
- **Test Setup**: `test/setup.ts`
- **TypeScript**: Types are configured in `tsconfig.json`

## Best Practices

1. **Test Behavior, Not Implementation**: Focus on what the component does, not how it does it
2. **Use Descriptive Test Names**: Make it clear what each test is verifying
3. **Mock External Dependencies**: Keep tests isolated and fast
4. **Test Edge Cases**: Include tests for error states and boundary conditions
5. **Keep Tests Simple**: One assertion per test when possible
6. **Group Related Tests**: Use `describe` blocks to organize tests logically
7. **Test Props and State**: Verify components handle different props correctly
8. **Test User Interactions**: Use `@testing-library/user-event` for realistic interactions

## Coverage Goals

Current targets (can be adjusted in `vitest.config.ts`):
- **Statements**: 70%+
- **Branches**: 60%+
- **Functions**: 70%+
- **Lines**: 70%+

## Debugging Tests

1. Use `yarn test:ui` for interactive debugging
2. Add `console.log` statements in tests
3. Use `screen.debug()` to see rendered HTML
4. Use `--reporter=verbose` for detailed output
5. Use `screen.logTestingPlaygroundURL()` for element selection help

## Common Patterns

### Testing Conditional Rendering
```typescript
it('should render when condition is true', () => {
  render(<Component showContent={true} />)
  expect(screen.getByText('Content')).toBeInTheDocument()
})

it('should not render when condition is false', () => {
  render(<Component showContent={false} />)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})
```

### Testing Async Operations
```typescript
it('should handle async operations', async () => {
  render(<AsyncComponent />)
  
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
```

### Testing Error States
```typescript
it('should handle errors gracefully', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  
  expect(() => {
    render(<ComponentThatThrows />)
  }).toThrow('Expected error message')
  
  consoleSpy.mockRestore()
}) 