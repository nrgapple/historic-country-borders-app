# Scroll Lock Improvements

## Problem
The previous implementation used `body-scroll-lock` package which was too aggressive and prevented scrolling on elements that should remain scrollable, such as:
- Timeline years container (horizontal scrolling)
- Wiki popup descriptions (vertical scrolling)
- Country info descriptions (vertical scrolling)
- Mapbox popup content (vertical scrolling)

This caused poor user experience on mobile devices where users couldn't scroll through timeline years or read long descriptions in popups.

## Solution
Replaced `body-scroll-lock` with a custom CSS-based scroll lock implementation that:

1. **Uses modern CSS properties** instead of JavaScript manipulation
2. **Allows specific elements to scroll** while locking the main body
3. **Preserves scroll position** when locking/unlocking
4. **Works better on mobile devices** with proper touch handling

## Implementation Details

### New Hook: `useScrollLock`
- Uses `position: fixed` on body to prevent scrolling
- Stores and restores scroll position
- Applies `touch-action: pan-y` to allowed elements
- Uses `overscroll-behavior: contain` for better mobile experience

### New Hook: `useAllowScroll`
- Allows specific elements to scroll even when body is locked
- Stores and restores original CSS properties
- Works with CSS selectors for flexible targeting

### CSS Improvements
Added proper touch scrolling properties to scrollable elements:
```css
.timeline-years-container,
.popup-description,
.country-info-description,
.mapboxgl-popup-content {
  touch-action: pan-y;
  overscroll-behavior: contain;
  isolation: isolate;
}
```

## Benefits
1. **Better mobile experience** - Timeline and popups now scroll properly
2. **Reduced bundle size** - Removed external dependency
3. **More control** - Custom implementation allows fine-tuning
4. **Modern approach** - Uses CSS instead of aggressive JavaScript manipulation
5. **Better performance** - Less DOM manipulation and event handling

## Files Changed
- `hooks/useScrollLock.ts` - New custom scroll lock implementation
- `pages/_app.tsx` - Updated to use new hook with allowed selectors
- `components/Viewer.tsx` - Removed old scroll lock code
- `components/PopupInfo.tsx` - Updated to use new `useAllowScroll` hook
- `styles/index.css` - Added proper touch scrolling CSS properties
- `package.json` - Removed `body-scroll-lock` dependency

## Testing
- PopupInfo component tests updated and passing
- Manual testing on mobile devices shows improved scrolling behavior
- Timeline horizontal scrolling works properly
- Popup vertical scrolling works properly 