# Query Parameter and Routing System

This document describes the improved query parameter and routing system for the Historic Country Borders App.

## Overview

The routing system has been refactored to provide:
- **Path-Based Year Routing**: Years are now handled via URL paths (`/year/1322`) instead of query parameters
- **Type Safety**: Proper TypeScript interfaces for all query parameters
- **Centralized Logic**: All query parameter handling is centralized in dedicated utilities
- **Validation**: Built-in validation and default values
- **Clean API**: Simple, intuitive hooks for components
- **Hydration Safe**: Properly handles Next.js server-side rendering and client-side hydration
- **No Page Refresh**: Year navigation uses shallow routing to prevent map flickering

## Routing Structure

### Year-Based Routes
Years are now handled via dynamic routes:
```
/year/[year]    # Dynamic route for specific years
/               # Root redirects to random year
```

### Query Parameters
The app supports the following query parameters for map state:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `lng` | string | Map longitude coordinate | 0 |
| `lat` | string | Map latitude coordinate | 0 |
| `zoom` | string | Map zoom level | 2 |

## Testing the Routing System

### Test Year Navigation
```
http://localhost:3000/year/1322
```
This should load the timeline at year 1322 with clean URL structure.

### Test Map Position with Year
```
http://localhost:3000/year/1500?lng=2.3522&lat=48.8566&zoom=10
```
This should load year 1500 with the map centered on Paris, France with zoom level 10.

### Test Root Redirect
```
http://localhost:3000/
```
This should redirect to a random year (e.g., `/year/1234`).

## Usage

### Year-Based Routing

```typescript
import { useYearRouting } from '../hooks/useYearRouting';

function MyComponent() {
  const { currentYear, setYear, isReady } = useYearRouting();
  
  // Wait for router to be ready before using year
  if (!isReady) return <div>Loading...</div>;
  
  // Access current year from URL path
  const year = currentYear;
  
  // Navigate to new year (shallow routing, no page refresh)
  const handleYearChange = (newYear: string) => {
    setYear(newYear); // Navigates to /year/newYear
  };
}
```

### Map Query Parameters

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

### Combined Usage

```typescript
import { useYearRouting } from '../hooks/useYearRouting';
import { useMapQuery } from '../hooks/useMapQuery';

function ViewerComponent() {
  const { currentYear, setYear } = useYearRouting();
  const { viewState, updateMapView } = useMapQuery();
  
  // Year changes via path routing (no page refresh)
  // Map state changes via query parameters (smooth updates)
}
```

## Utility Functions

### Query Parameter Parsing (Map State Only)

```typescript
import { parseQueryParams } from '../utils/queryParams';

// Parse Next.js router query into typed object (lng, lat, zoom only)
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

## Architecture

### Files Structure

```
types/
  query.ts              # TypeScript interfaces for map query parameters

utils/
  queryParams.ts        # Utility functions for map state parsing and validation

hooks/
  useQuery.tsx          # Main query parameter hook (map state only)
  useMapQuery.ts        # Map-specific query parameter hook
  useYearRouting.tsx    # Year-based routing hook

pages/
  index.tsx             # Root page that redirects to random year
  year/
    [year].tsx          # Dynamic route for year-specific pages
```

### Key Components

1. **QueryProvider**: Context provider that manages map query state
2. **useQuery**: Hook for accessing and updating map query parameters
3. **useMapQuery**: Specialized hook for map view state
4. **useYearRouting**: Hook for year-based path routing
5. **Utility Functions**: Pure functions for parsing, validation, and formatting

## Benefits

1. **Clean URLs**: Years in path (`/year/1322`) instead of query parameters
2. **No Page Refresh**: Shallow routing prevents map flickering during year changes
3. **Type Safety**: All parameters are properly typed
4. **Validation**: Built-in validation prevents invalid states
5. **Performance**: Debounced updates for smooth map movement
6. **Maintainability**: Centralized logic makes changes easier
7. **Developer Experience**: Clear, intuitive API with good documentation
8. **Hydration Safe**: Properly handles Next.js SSR without hydration mismatches
9. **SEO Friendly**: Clean year-based URLs are better for search engines

## Migration Notes

The new system introduces path-based routing for years while maintaining query parameters for map state:

### What Changed
- Years moved from query parameters to URL paths
- Root page now redirects to random year
- Year navigation uses shallow routing for smooth transitions
- Map state remains in query parameters for smooth updates

### What Stayed the Same
- Map query parameters (lng, lat, zoom) work exactly as before
- All existing map functionality is preserved
- TypeScript support and validation remain strong

This hybrid approach provides the best of both worlds: clean URLs for years and smooth map navigation via query parameters. 