# URLs and shareable map state

Every map state a teacher or student finds can be shared by copying the address bar.

## Historical maps

```
/year/<year>?lng=<longitude>&lat=<latitude>&zoom=<zoom>
```

- `<year>` is a signed integer from `data/historical-manifest.json`. Negative years are BC, for example `/year/-500` for 500 BC. Unknown years return the static 404 page.
- `lng`, `lat`, and `zoom` are optional. Without them, the map opens on a world view.
- `/` redirects immediately to a random published year and keeps any query string.

## Pennsylvania school districts

```
/pa/school-districts?lng=<longitude>&lat=<latitude>&zoom=<zoom>
```

Without a position, the map fits Pennsylvania.

## Behavior

- **Reading:** the map reads the position once when it mounts (`parseMapView` in `lib/mapView.ts`). Out-of-range values are clamped. Malformed values fall back to the default view.
- **Writing:** when the camera settles (`moveend`), `writeMapView` updates the URL with `history.replaceState`. The URL uses four decimals for coordinates (about 11 m) and two for zoom. The page does not re-render, Next.js history state is preserved, and no history entry is added.
- **Changing years:** a year change pushes a new history entry (`/year/<next>` plus the current query string), so Back steps through the years visited while the map position stays the same.
- Unrelated query parameters, for example a teacher's `?ref=` tag, are preserved.

Tests: `lib/__tests__/mapView.test.ts` (parsing and writing) and `e2e/critical-journeys.spec.ts` (timeline navigation keeps the position, and Back works).
