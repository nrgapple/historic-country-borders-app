# Classroom revamp audit — November 2026

Scope: the whole client application after the M1–M4 infrastructure milestones. Data pipelines and the Cloudflare deployment boundary were out of scope except where they affect what the browser downloads.

Audience lens (owner direction, 2026-11-17): Historic Borders should feel like a high-school history textbook atlas — simple, informative, and easy for teachers to project and for students to use on Chromebooks and phones.

## Observed before the revamp

**Interface**

- The timeline was a horizontally scrolling row of 53 year buttons. It had page arrows, inline styles, and no grouping by era. The selected year was shown as small, glowing purple text.
- Every visit opened two marketing/attribution toasts and a loading toast.
- Emoji appeared throughout as iconography: 🔭, ⚙️, 👋, 📚, 😔, 🏷️, and others.
- The palette was Times New Roman, beige, and brown, plus a purple accent and a bright cyan selection outline.
- Country colors came from a saturated 30-color flat-UI palette.
- Wikipedia summaries had no link to the article and no license attribution.
- The source and vintage of the historical data was only visible in a hover-expanding footer.
- The basemap was Mapbox Standard, a 3D style that draws today's country borders, roads, and terrain under historical maps. Under the 1914 map, modern borders showed through as pink lines.
- `user-scalable=no` blocked pinch zoom for low-vision users.
- A global "scroll lock" set `position: fixed` on `<body>` through JavaScript.
- Feedback failures surfaced through `alert()`.

**Performance and memory**

- SWR cached every parsed year payload for the life of the tab. Scrubbing through the timeline accumulated all 53 years: about 54 MB of JSON before parsing, and many times that in memory.
- Rapid timeline changes queued a download for every year passed. Nothing was aborted.
- Mapbox GL (1.5 MB raw) was part of the initial route bundle, so nothing was interactive until the whole map library had loaded.
- Map movement wrote the URL through `router.replace` every 200 ms, re-rendering the entire page tree on every pan.
- Settings changes emitted multiple analytics events each, including save duration in milliseconds.

**SEO and metadata**

- Year-page descriptions repeated their first sentence and said borders "existed 1994 years ago".
- Titles read "Historic Borders | Historic Country Borders".
- `og:image` and `logo.png` pointed to files that did not exist.
- The home page rendered "Loading…" and redirected only after React hydrated.

**Code health**

- 15 unused or replaceable runtime dependencies: SWR, immer/use-immer, react-hot-toast, react-tooltip, @szhsin/react-menu, react-use, classnames, hex-rgba, @turf/bbox, prop-types, csstype, @react-hook/window-size, and others.
- Dead modules: NavBar, Help, PopupInfo, useKeyPress, useMounted, useParentSize, stringToColor, amphitheater helpers, and a 5,300-line `Roboto_Regular.json`.
- Two parallel map containers duplicated style-loading workarounds. The year was converted `-500` → `bc500` → `-500` across three modules.
- 1,941 lines of global CSS with heavy `!important` use and inline style objects.

**Data (left to the parallel data work)**

- Historical coordinates are published with about 15 significant decimals, even though the source borders are approximate at the kilometre scale.
- Every place feature carries about 130 null properties. Label features duplicate all border properties, although the client uses only `NAME` and `AREA`.

## What changed

**Timeline:** a purpose-built, accessible timeline replaces the button row. It has:

- one ARIA `slider` with arrow, Page Up/Down, and Home/End keys;
- drag and tap to scrub, with the preview committing on release so scrubbing does not download every year passed;
- previous/next buttons that name the neighboring years;
- era bands (Prehistory, Ancient, Medieval, Early modern, Modern);
- ruler labels chosen so they never collide at any width;
- a large serif year readable from the back of a classroom.

The page-wide ← → and A D shortcuts still work. They are ignored while typing or while the map has keyboard focus.

**Basemap:** a plain physical basemap (`lib/basemap.ts`) replaces Mapbox Standard. It shows land, sea, major rivers, and soft relief, with no modern borders, roads, or names. It loads a single vector source instead of the Standard 3D style. On the school-district map, Mapbox Light keeps modern streets and town names, because there they help people find their district.

**Visual system:**

- Warm paper surfaces with ink text and one oxblood accent.
- Source Serif 4 for display text, self-hosted through `@fontsource` so no Google Fonts request is made.
- System UI text elsewhere.
- Line icons instead of emoji.
- A muted atlas palette, remapped at render time so published data does not change.

**Place details:** a panel (a bottom sheet on phones) shows:

- the territory name;
- "Part of" and "Subject to", when they differ from the name;
- border precision from the source data;
- a Wikipedia summary at sentence boundaries, with an optional Wikimedia-hosted thumbnail, a "Read more on Wikipedia" link, and CC BY-SA attribution.

A selected territory stays selected across years while it still exists.

**About dialog:** sources, snapshot date, license, provenance, an uncertainty statement written for students, keyboard shortcuts, and links to the other maps.

**Settings:** an anchored, non-modal panel with a labels switch, label size, uppercase labels, fill opacity, border width, and reset. The map updates live behind the panel.

**Feedback:** a native modal dialog with a three-option rating, inline errors, and a success state. Fingerprinting still loads only after the dialog opens.

**Focus mode:** hides every control except a restore button, for projecting a clean map.

**Data loading:**

- `lib/resource.ts` is a bounded LRU cache. Concurrent requests for the same key are de-duplicated, and a request is aborted once nothing is waiting for it.
- Historical years keep 2 parsed payloads, the school artifact 1, and Wikipedia summaries 60. The previous map stays on screen while the next year loads.
- Adjacent years are prefetched at idle with `<link rel="prefetch">` and are not parsed. Prefetch is skipped under Save-Data or on 2G/3G connections.

**Startup:**

- The map component is code-split and loads after first paint.
- The home page redirects with an inline script before React loads. Its static markup lists every year for crawlers.
- Analytics loads lazily at idle, only when configured, and tracks 6 product events instead of more than 20.

**URL state:** the map position is written with `history.replaceState` after the camera settles, with no React re-render. Year changes push history entries, so Back steps through the years visited. See `docs/QUERY_PARAMS.md`.

**SEO:**

- Per-year titles, such as "World borders in 1492 AD · Historic Borders", with accurate descriptions and canonical URLs that exclude query strings.
- A single JSON-LD block.
- Pinch zoom is allowed again.

**Code:** about 20 components, hooks, and utilities, plus 15 dependencies, were removed. The global CSS was rewritten around design tokens. Tests now cover the timeline, resource cache, URL state, Wikipedia hook, panels, settings, and feedback. The e2e suite adds journeys for timeline navigation with URL and Back, and for selecting a territory with Wikipedia degrading gracefully.

## Measured results

See `docs/M4_PERFORMANCE_REPORT.md` for the method and the numbers from `yarn size:check`.

- Route-initial JavaScript for `/year/[year]`: 109 kB gzip, as reported by `next build`. Mapbox GL moved to an on-demand chunk.
- Unit and integration tests: 67 passing at the time of writing.

## Assumptions

- Classroom devices are often low-end Chromebooks with integrated GPUs on filtered networks. Fewer WebGL layers and fewer third-party domains therefore matter more than visual effects.
- Prefetching only the two neighboring years is a reasonable trade-off between instant next/previous and bandwidth on metered connections.

## Recommendations (not yet done)

1. **Slim the data payloads.** Strip null place properties and duplicated label properties in the historical pipeline, and round coordinates (in progress in a separate change). Expect a large cut in transfer and parse cost.
2. **Evaluate MapLibre with a self-hosted basemap.** Mapbox bills per map load, and some school networks block `api.mapbox.com`. A MapLibre build that reads PMTiles from Cloudflare would remove the per-load cost and the third-party dependency. A data-source and architecture study is being written to `ideas/historic-borders-data-sources.md` in the workspace.
3. **Add classroom features, with evidence first:**
   - a "Classroom" link-copy button that includes the current year and view;
   - optional "key events of this era" notes from a curated, source-backed list;
   - district search on the school map (already on the backlog).
4. **Add an Open Graph image.** Generate `public/og-image.png` (1200 × 630) from a real map render so shared links preview well. The metadata already points to it.
