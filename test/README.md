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

## Test Structure

- **Unit Tests**: Test individual functions and utilities
- **Component Tests**: Test React components in isolation
- **Integration Tests**: Test component interactions

## Writing Tests

### Component Tests

Component tests are located in `__tests__` directories next to the components they test. Example:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MyComponent from '../MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
```

### Utility Tests

Utility function tests are located in `util/__tests__/`. Example:

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

### Custom Hooks

Mock custom hooks in individual test files:

```typescript
vi.mock('../../hooks/useMyHook', () => ({
  useMyHook: vi.fn(() => ({ data: 'mocked data' })),
}))
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

## Coverage

Run `yarn test:coverage` to generate a coverage report. Aim for:
- **Statements**: 80%+
- **Branches**: 75%+
- **Functions**: 80%+
- **Lines**: 80%+

## Debugging Tests

1. Use `yarn test:ui` for interactive debugging
2. Add `console.log` statements in tests
3. Use `screen.debug()` to see rendered HTML
4. Use `--reporter=verbose` for detailed output 