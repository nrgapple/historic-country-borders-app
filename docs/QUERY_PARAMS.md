# URLs and shareable map state

Every map state a teacher or student finds can be shared by copying the address bar.

## Historical maps

```
/year/<year>?lng=<longitude>&lat=<latitude>&zoom=<zoom>&place=<NAME>
```

- `<year>` is a signed integer from `data/historical-manifest.json`. Negative years are BC, for example `/year/-500` for 500 BC. Unknown years return the static 404 page.
- `lng`, `lat`, and `zoom` are optional. Without them, the map opens on a world view.
- `place` is optional. It is the selected territory's `NAME` in that year's data, for example `place=Ottoman+Empire`.
- `/` redirects immediately to a random published year and keeps any query string.

## Pennsylvania school districts

```
/pa/school-districts?lng=<longitude>&lat=<latitude>&zoom=<zoom>&place=<NAME>
```

Without a position, the map fits Pennsylvania.

## Behavior

- **Reading:** the map reads the position once when it mounts (`parseMapView` in `src/lib/mapView.ts`). Out-of-range values are clamped. Malformed values fall back to the default view.
- **Writing:** when the camera settles (`moveend`), `writeMapView` updates the URL with `history.replaceState`. The URL uses four decimals for coordinates (about 11 m) and two for zoom. The page does not re-render and no history entry is added.
- **Changing years:** a year change pushes a new history entry (`/year/<next>` plus the current query string), so Back steps through the years visited while the map position stays the same.
- **Selected place:** selecting a territory or district, by clicking or with "Find a place", writes `place` with `history.replaceState`. Closing the panel removes it. On load, the value is checked against the loaded features once the data is ready. A match is selected and its details open; if the link has no map position, the map frames the place. An unknown or oversized value is dropped from the URL. A year change keeps `place` only while that territory exists in the new year.
- **Copy link:** the details panel copies the current address. Where the Clipboard API is unavailable, it shows the link selected in a read-only field.
- Unrelated query parameters, for example a teacher's `?ref=` tag, are preserved.

Tests: `src/lib/__tests__/mapView.test.ts` (parsing and writing), `src/components/__tests__/CopyLinkButton.test.tsx` (copy and fallback), and `e2e/critical-journeys.spec.ts` (timeline navigation keeps the position, Back works, and a found place survives a reload).
