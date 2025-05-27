# Query Parameter System

This document describes the improved query parameter system for the Historic Country Borders App.

## Overview

The query parameter system has been refactored to provide:
- **Type Safety**: Proper TypeScript interfaces for all query parameters
- **Centralized Logic**: All query parameter handling is centralized in dedicated utilities
- **Validation**: Built-in validation and default values
- **Clean API**: Simple, intuitive hooks for components
- **Hydration Safe**: Properly handles Next.js server-side rendering and client-side hydration

## Query Parameters

The app supports the following query parameters:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `year` | string | The selected historical year | First available year |
| `lng` | string | Map longitude coordinate | 0 |
| `lat` | string | Map latitude coordinate | 0 |
| `zoom` | string | Map zoom level | 2 |

## Testing Query Parameters

To test that query parameters work correctly on initial page load, try these URLs:

### Test Map Position
```
http://localhost:3000/?lng=2.3522&lat=48.8566&zoom=10
```
This should load the map centered on Paris, France with zoom level 10.

### Test Year Selection
```
http://localhost:3000/?year=1000
```
This should load the timeline at year 1000 (if available in the dataset).

### Test Combined Parameters
```
http://localhost:3000/?year=1500&lng=2.3522&lat=48.8566&zoom=8
```
This should load year 1500 with the map centered on Paris at zoom level 8.

## Usage

### Basic Query Parameter Access

```typescript
import { useQuery } from '../hooks/useQuery';

function MyComponent() {
  const { query, setQuery, isReady } = useQuery();
  
  // Wait for router to be ready before using query params
  if (!isReady) return <div>Loading...</div>;
  
  // Access current year
  const currentYear = query.year;
  
  // Update year (immediate)
  const handleYearChange = (newYear: string) => {
    setQuery({ year: newYear });
  };
}
```

### Map-Specific Query Parameters

For map-related components, use the specialized `useMapQuery` hook:

```typescript
import { useMapQuery } from '../hooks/useMapQuery';

function MapComponent() {
  const { viewState, updateMapView, isReady } = useMapQuery();
  
  // Don't render until ready to avoid hydration issues
  if (!isReady) return <div>Loading map...</div>;
  
  // viewState contains: { longitude, latitude, zoom }
  
  // Update map position (debounced for smooth movement)
  const handleMapMove = (lng: number, lat: number, zoom: number) => {
    updateMapView(lng, lat, zoom);
  };
}
```

## Utility Functions

### Query Parameter Parsing

```typescript
import { parseQueryParams } from '../utils/queryParams';

// Parse Next.js router query into typed object
const typedQuery = parseQueryParams(router.query);
```

### Map View State

```typescript
import { getMapViewFromQuery, formatMapCoordinates } from '../utils/queryParams';

// Get map view state with defaults
const viewState = getMapViewFromQuery(query);

// Format coordinates for URL
const coords = formatMapCoordinates(lng, lat, zoom);
```

### Year Validation

```typescript
import { isValidYear, getDefaultYear } from '../utils/queryParams';

// Check if year is valid
const isValid = isValidYear(query.year, availableYears);

// Get default year
const defaultYear = getDefaultYear(availableYears);
```

## Architecture

### Files Structure

```
types/
  query.ts              # TypeScript interfaces and constants

utils/
  queryParams.ts        # Utility functions for parsing and validation

hooks/
  useQuery.tsx          # Main query parameter hook
  useMapQuery.ts        # Map-specific query parameter hook
```

### Key Components

1. **QueryProvider**: Context provider that manages query state
2. **useQuery**: Main hook for accessing and updating query parameters
3. **useMapQuery**: Specialized hook for map view state
4. **Utility Functions**: Pure functions for parsing, validation, and formatting

## Benefits

1. **Type Safety**: All query parameters are properly typed
2. **Validation**: Built-in validation prevents invalid states
3. **Performance**: Debounced updates for smooth map movement
4. **Maintainability**: Centralized logic makes changes easier
5. **Developer Experience**: Clear, intuitive API with good documentation
6. **Hydration Safe**: Properly handles Next.js SSR without hydration mismatches

## Migration Notes

The new system replaces the previous Map-based approach with a simpler, more direct implementation:

- No more complex Map state management
- Simplified debouncing logic
- Better TypeScript support
- Cleaner component code
- Proper Next.js hydration handling

All existing functionality is preserved while providing a much cleaner developer experience. 