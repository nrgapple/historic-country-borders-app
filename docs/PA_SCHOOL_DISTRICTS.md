# Pennsylvania School Districts Visualization

## Overview

This document describes the implementation of the Pennsylvania School Districts visualization page at `/pa/school-districts`. This feature provides an interactive map of all 500 Pennsylvania school districts for 2025, similar to the historic borders visualization but simplified for a single-year dataset.

## Implementation Date

December 2024

## Files Created

### Core Components
- `components/DistrictInfo.tsx` - Info popup component for displaying district information (Wikipedia + properties fallback)
- `components/PASchoolDistrictsMapContainer.tsx` - Main map container with PA bounds restriction and district click handling
- `components/PASchoolDistrictsMapSources.tsx` - Map sources component for rendering districts with labels (handles Polygon geometry)

### Hooks
- `hooks/usePASchoolDistricts.tsx` - Custom hook for fetching and processing school districts data client-side

### Pages & API
- `pages/pa/school-districts.tsx` - Main page route for the visualization
- `pages/api/pa-school-districts.ts` - API endpoint (currently unused, processing happens client-side)

### Scripts
- `scripts/preprocess-districts.js` - Optional build-time preprocessing script (uses centroids, not polylabel)

### Data Files
- `public/PaSchoolDistricts2025_10.geojson` - Source GeoJSON file (20MB, 500 districts)
- `public/PaSchoolDistricts2025_10_processed.json` - Preprocessed output (optional, not required)

## Files Modified

- `util/MapboxDefaultMap.tsx` - Added support for `minZoom`, `maxZoom`, and `maxBounds` props (backward compatible)
- `package.json` - Added memory increase flags and preprocessing script

## Key Features

### 1. Map Bounds Restriction
- Map is restricted to Pennsylvania boundaries: `[[-80.5, 39.7], [-74.7, 42.3]]`
- Users cannot pan or zoom outside PA
- Initial view fits PA with 100px padding on all sides
- Min zoom: 6, Max zoom: 15

### 2. District Visualization
- All 500 districts rendered with distinct colors using `generateTextbookColor()` (same algorithm as historic borders)
- District names displayed as labels
- Clicking districts shows information popup
- Selected districts get highlighted with thicker borders

### 3. District Information
- Uses `SCHOOL_NAM` property for district names (not `SCHOOL_DIS`)
- Tries Wikipedia search first using existing `useCountryInfo` hook
- Falls back to displaying GeoJSON properties if Wikipedia lookup fails
- Shows: District Name, Full Name, County, Intermediate Unit, AUN Number, Career/Technical School

### 4. No Timeline
- Single-year dataset (2025), so no timeline component needed
- Simplified layout without year navigation

## Technical Decisions

### Client-Side Processing

**Decision:** Process the 20MB GeoJSON file entirely in the browser instead of server-side.

**Rationale:**
- Server-side processing caused JavaScript heap out-of-memory errors even with 8GB allocated
- GeoJSON file is 20MB with 500 complex polygons containing thousands of coordinates each
- Client-side processing is more scalable (each user processes their own data)
- Browser can handle the processing more efficiently for single-user sessions

**Implementation:**
- GeoJSON file served as static asset from `/public/PaSchoolDistricts2025_10.geojson`
- `usePASchoolDistricts` hook fetches and processes the file
- Processing happens once per page load and is cached by SWR

### Centroid-Based Label Placement

**Decision:** Use centroids instead of `polylabel` for label placement.

**Rationale:**
- `polylabel` caused out-of-memory errors with complex polygons
- Centroids are fast, memory-efficient, and reliable
- Good enough visual result for district labels

**Implementation:**
- `calculateCentroid()` function samples up to 500 points from polygon coordinates
- No dependency on `polylabel` library
- Works reliably for all polygon complexities

### Style Loading Handling

**Decision:** Wait for map style to fully load before adding sources.

**Rationale:**
- Mapbox GL JS throws "Style is not done loading" error if sources are added too early
- Must wait for `style.load` event before manipulating map

**Implementation:**
- `isStyleLoaded` state tracks when style is ready
- `PASchoolDistrictsMapSources` only renders when `isStyleLoaded === true`
- `fitBounds` only called after style is loaded

### Polygon vs MultiPolygon Geometry

**Decision:** Handle Polygon geometry (school districts) vs MultiPolygon (historic borders).

**Rationale:**
- School districts use simple Polygon geometry
- Historic borders use MultiPolygon (nested coordinate arrays)
- Different processing logic needed

**Implementation:**
- `PASchoolDistrictsMapSources` handles Polygon geometry directly
- Coordinates accessed as `geometry.coordinates[0]` (single ring)

## Memory Optimization Solutions

### Problem
Processing a 20MB GeoJSON file with 500 complex polygons caused out-of-memory errors:
- Server-side: Failed even with 8GB Node.js heap
- Client-side: `polylabel` caused browser crashes

### Solutions Applied

1. **Client-Side Processing**
   - Move processing to browser where memory is less constrained per user
   - File served as static asset (can be CDN cached)

2. **Centroid Calculation**
   - Sample only 500 points maximum from polygon coordinates
   - Avoid processing all coordinates for large polygons
   - No complex algorithms like `polylabel`

3. **Efficient Data Structures**
   - Process features in single pass (no multiple iterations)
   - Minimal property copying
   - Direct array access instead of filter/map chains

4. **Optional Preprocessing Script**
   - Build-time script available but not required
   - Uses centroids, completes in <1 second
   - Can preprocess if needed for performance

## Differences from Historic Borders Visualization

| Feature | Historic Borders | PA School Districts |
|---------|-----------------|---------------------|
| **Data Source** | GitHub API (dynamic) | Static GeoJSON file |
| **Geometry Type** | MultiPolygon | Polygon |
| **Timeline** | Yes (multiple years) | No (single year) |
| **Processing** | Server-side API | Client-side hook |
| **Label Placement** | polylabel | Centroid |
| **Compare Mode** | Yes (AI compare) | No |
| **Map Bounds** | Global | Restricted to PA |
| **Route** | `/year/[year]` | `/pa/school-districts` |

## API Endpoint (Currently Unused)

The `pages/api/pa-school-districts.ts` endpoint exists but is not currently used. The implementation processes data client-side. The endpoint could be used for:
- Server-side caching
- Pre-processing optimization
- Future server-side features

## Usage

### Accessing the Visualization
Navigate to: `/pa/school-districts`

### Development
```bash
yarn dev
# Visit http://localhost:3000/pa/school-districts
```

### Optional Preprocessing
If you want to preprocess the data at build time:
```bash
yarn preprocess-districts
```
This creates `public/PaSchoolDistricts2025_10_processed.json` but is not required.

## Data Format

### GeoJSON Properties
- `SCHOOL_NAM` - District name (primary identifier)
- `SCHOOL_DIS` - Full district name with "SD" suffix
- `CTY_NAME` - County name
- `IU_NAME` - Intermediate Unit name
- `IU_NUM` - Intermediate Unit number
- `AUN_NUM` - Administrative Unit Number
- `AVTS` - Career/Technical School name

### Processed Data Structure
```typescript
{
  data: {
    labels: FeatureCollection,  // Point features for district labels
    borders: FeatureCollection  // Polygon features for districts
  },
  places: FeatureCollection     // Empty for school districts
}
```

Each feature has:
- `NAME` - District name (from SCHOOL_NAM)
- `COLOR` - Generated color hash
- `AREA` - Calculated area (optional)
- Original properties preserved

## Troubleshooting

### "Style is not done loading" Error
- Ensure `isStyleLoaded` state is checked before rendering sources
- Wait for `style.load` event, not just `load` event
- Don't call `fitBounds` before style is loaded

### Out of Memory Errors
- If processing fails, check browser console
- Reduce centroid sampling points in `calculateCentroid()`
- Consider preprocessing script as alternative

### Districts Not Showing
- Check browser console for errors
- Verify GeoJSON file exists in `/public`
- Ensure `isStyleLoaded === true` before rendering sources
- Check that data is loading via network tab

## Future Improvements

1. **Performance**
   - Consider Web Workers for processing
   - Implement virtual scrolling for very large datasets
   - Add progressive loading/chunking

2. **Features**
   - Search/filter districts
   - District statistics overlay
   - Comparison between districts
   - Export functionality

3. **Optimization**
   - Simplify polygons at different zoom levels
   - Lazy load district details
   - Cache processed data in IndexedDB

## Related Documentation

- `QUERY_PARAMS.md` - Query parameter handling
- `AI_ANALYTICS_GUIDE.md` - Analytics implementation
- Historic borders implementation in `components/MapContainer.tsx`

## Code References

Key files to review:
- `hooks/usePASchoolDistricts.tsx` - Data fetching and processing
- `components/PASchoolDistrictsMapContainer.tsx` - Map container logic
- `components/PASchoolDistrictsMapSources.tsx` - Map rendering
- `components/DistrictInfo.tsx` - Info popup component

