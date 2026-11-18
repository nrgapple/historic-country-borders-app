# Living Atlas: three visual directions

This is a design spike for the Historic Borders remaster. The app code is unchanged. Each direction is a static, high-fidelity mock of the main screen. Each one renders the real 1492 data with MapLibre GL JS, the top timeline, and the selected-territory panel for the Ottoman Empire.

The brief came from the owner's feedback that the UI feels "meh, bland, not alive like a textbook." The owner likes the timeline and the prehistory dates, so every direction keeps the current timeline concept and moves it forward: the large serif year, the previous and next buttons, era bands, a labelled ruler, and all 53 snapshots from 123,000 BC to 2010. The timeline stays at the top in every direction. None of them uses a plain range slider or a bottom bar.

| Direction | Page | Desktop 1440×900 | Phone 390×844 | Phone 393×852 with simulated insets |
|---|---|---|---|---|
| A · Classic atlas | `a-classic-atlas.html` | `shots/a-classic-atlas-desktop.png` | `shots/a-classic-atlas-phone.png` | `shots/a-classic-atlas-phone-safe.png` |
| B · Modern textbook | `b-modern-textbook.html` | `shots/b-modern-textbook-desktop.png` | `shots/b-modern-textbook-phone.png` | `shots/b-modern-textbook-phone-safe.png` |
| C · Museum exhibit | `c-museum-exhibit.html` | `shots/c-museum-exhibit-desktop.png` | `shots/c-museum-exhibit-phone.png` | `shots/c-museum-exhibit-phone-safe.png` |

## Opening and regenerating

- **Open a page directly from disk.** Data, glyphs and relief are embedded as `data/*.js` globals and served to MapLibre through a `local://` protocol (`maplibregl.addProtocol`), so `file://` works. The only network request is MapLibre GL JS **5.24.0**, pinned on unpkg.
- **Simulate safe areas.** Append `?safe=59,34` to any page. This overrides the top and bottom insets and draws a Dynamic Island and a home indicator.
- **Regenerate**, using Node 22 and the Playwright, sharp, pbf, polylabel and martinez packages from the main checkout's `node_modules`. To use another location, set `ROOT_NODE_MODULES`.

  ```bash
  node tools/prepare-data.cjs <dir with Natural Earth 1:50m GeoJSON> <GRAY_50M_SR.tif>
  node tools/make-glyphs.cjs     # glyph PBFs from fonts/*.woff2
  node tools/shoot.cjs [a b c]   # all screenshots
  node tools/contrast.cjs        # every contrast ratio quoted below
  ```

The mocks are static by design. The year is fixed at 1492, and the buttons and search field are visual only. The map itself pans and zooms.

## Data and licenses

| Asset | Source | License | Processing |
|---|---|---|---|
| Borders, label points and places for 1492 | `public/data/historical/1492.*.json` from aourednik/historical-basemaps | GPL-3.0, credited on every page | Coordinates rounded to 3 decimals, polygons rewound to RFC 7946 so line offsets know inside from outside, unused properties dropped |
| Ocean mask, coastline, lakes, rivers and sea names | Natural Earth 1:50m vectors, v5.1.2 | Public domain | The ocean is the world minus land, clipped into 30° cells so no polygon carries hundreds of holes. Sea names are placed at a polylabel point, and the Atlantic is moved into the European view |
| Relief | Natural Earth 1:50m gray shaded relief, `GRAY_50M_SR` | Public domain | Local relief (the pixel minus a 14 px blur) reprojected to Web Mercator at 2048 px. Tinted per direction into a transparent WebP of about 550 kB |
| Locator globe (B) | Natural Earth 1:110m land | Public domain | Outer rings only |
| Fonts | Fontsource 5.3.0 builds of Google Fonts families | SIL OFL 1.1, with license copies in `fonts/LICENSE-*.txt` | Latin and Latin Extended `.woff2` |
| Glyph PBFs | Generated from those fonts | OFL for derived glyphs | Chromium rasterizes each glyph and `@mapbox/tiny-sdf` (BSD-2) converts it to an SDF, using MapLibre's own local-glyph parameters: 24 px, 3 px buffer, radius 8. Ranges 0–255, 256–511 and 8192–8447 |

**Why the ocean is drawn on top.** The historical polygons overrun coastlines; the Black Sea and Adriatic are partly inside territory polygons. Each style therefore paints water *over* the territory fills, using the precomputed ocean mask. The map then shows real coastlines regardless of how roughly a border was digitized. This is the main cartographic fix in the spike, and all three directions depend on it.

**Production notes for MapLibre**, observed from building the mocks:

- Serve each glyph range as an immutable static file, about 70–100 kB per font per range, from `/glyphs/{fontstack}/{range}.pbf`. The base64 bundles exist only so the mocks open from disk. The same pipeline, or `maplibre/font-maker`, can run in the data build.
- Ship the ocean mask, coastline, rivers and lakes as one small vector source, for example PMTiles on Cloudflare. Ship relief as raster tiles or the single 2048 px WebP, loaded after the first map paint.
- MapLibre can't apply OpenType features such as `smcp`, so true small caps need a dedicated SC font (Alegreya SC, Spectral SC). Uppercase plus letter-spacing is the fallback when no SC cut exists, as in B.
- MapLibre allows only one zoom-based `interpolate` per expression, so "selected territory gets a bigger label" is written as a `match` *inside* each zoom stop (`HB.areaSize`).
- Every city marker is the icon of its own symbol, never a separate circle layer, so a dot is never drawn without its name. This prevents the "unlabelled city dots" regression.
- Symbol layers are ordered **state names → selected capital → other cities**. The selected territory's name is never dropped, which fixes the UI review's blocker where "Ottoman Empire" was missing at the teacher's camera.

## Shared rules (all directions)

- **Size hierarchy by area.** State label size interpolates on `log10(area km²)` across four steps (10⁴, 10⁵, 6×10⁵, 4×10⁶ km²) and grows with zoom between z2 and z5. Territories under 18,000 km² aren't labelled at overview zooms. Letter-spacing widens with area, so large empires read as spread-out names. The selected territory always gets a fixed, larger size and the top sort key.
- **Halos.** Every map label has a halo in its ground colour, 1.2–2 px, so text keeps its contrast over any tint, relief or border.
- **Places.** The source has no rank, so the mock shows a curated list (`HB.CITIES`). The selected territory's capital gets a distinct capital marker. Archaeological sites use the ∴ ruins mark and an italic "(ruins)" label instead of the city dot. In the mock this applies to Kaneš. It answers the review finding that prehistoric sites looked like living cities, but it needs a site class in the data.
- **Selection.** Each direction marks the selection with *something other than a new hue alone*: a band and a madder line (A), hatching and an outline (B), or full colour against dimmed neighbours with an ink outline (C). The selected territory's name is also coloured or darkened.
- **Era tint.** The era of the current year sets the UI accent. 1492 is Medieval, so the accent is madder in A, royal blue in B and lapis in C. The era bands, the active ruler label, the panel eyebrow and the primary button all use it.
- **Projector minimums.** No text is under 13 px. Ruler years are 14–15 px, map labels are 12–28 px and the year is 52–58 px. Every text pair is AA, checked with `tools/contrast.cjs`.
- **Panel content order.** Snapshot facts come first ("In 1492: capital, ruler, existed, borders"), then the encyclopedia overview, explicitly labelled "Empire overview · Wikipedia" with CC BY-SA attribution, then Key dates with the map year marked "This map". This answers the review's note that a 14th–20th-century summary sat directly under a 1492 heading. Key dates is sample content and needs a curated, sourced list before production.

## Safe areas (all directions)

Every page uses `viewport-fit=cover`. The insets come from `env(safe-area-inset-*)` through `--safe-top`, `--safe-bottom`, `--safe-left` and `--safe-right`, which the `?safe=` simulation overrides. The shell is `position: fixed; inset: 0; height: 100dvh`, with a `100vh` fallback for old browsers. `100dvh` follows Safari's collapsing toolbars, so the layout never extends under them.

- **Top.** The timeline's own background runs under the status bar and Dynamic Island. Its content starts at `calc(var(--safe-top) + 6–14px)`. Nothing interactive sits in the inset.
- **Bottom.** No direction has a fixed bottom bar. On phones the place panel is a bottom sheet inside the `dvh` shell, capped at 46–47% of the stage. Its button row is padded with `calc(10px + var(--safe-bottom))`, so the buttons clear the home indicator by at least 10 px. With the sheet closed, the map runs to the bottom edge, with only map content under the indicator.
- **Sides.** `.app` pads by the left and right insets for landscape notches.
- **Map camera.** The phone camera is fitted with `padding.bottom = sheet height` and `padding.top` clear of the scale box. The selected territory is therefore centred in the *visible* map, not behind the sheet.
- **Verified.** Captured at 390×844 without insets and at 393×852 with 59 px top and 34 px bottom. In both, the island covers only timeline background and the home indicator covers only sheet padding. A real-device check in Safari, with the toolbar collapsed and expanded, remains an acceptance item.

Per-direction differences are listed under each direction.

---

## A · Classic atlas

> Cream paper and engraved serif: a Times Atlas plate with a hand-coloured political map.

### Tokens

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--paper` | `#F1E9D6` | Timeline ground | – |
| `--sheet` | `#FBF6EA` | Panel and cartouche | – |
| `--paper-2` | `#E8DDC4` | Fact box | – |
| `--ink` | `#2A2017` | Text, borders, rules | 13.2:1 on paper |
| `--ink-2` | `#554536` | Secondary text | 7.6:1 on paper, 6.8:1 on fact box |
| `--accent` = Medieval | `#8B2A2A` madder | Eyebrow, drop cap, active era, button | 7.1:1 on paper, 5.2:1 on its wash, 7.9:1 text on accent |
| Era pigments and washes | Prehistory `#8A5A1E`/`#E7D3AE`, Ancient `#9A4024`/`#EBC9B5`, Medieval `#8B2A2A`/`#E6C2BC`, Early modern `#2F6455`/`#C6DACF`, Modern `#2C4B73`/`#C7D3E2` | Ruler bands, UI accent | Ink on washes 9.4–10.9:1 |
| Water and water ink | `#BFD2D0`, `#2F5960` | Sea, sea names | 4.9:1 |
| Land | `#F1E8D0` | Unclaimed land | – |
| Selected fill and label | `#E4ADA0`, `#6E1F1F` | Selected territory | 5.7:1 |

The map palette is 12 hand-tinted washes (madder, sap green, gamboge, lilac, verditer, rose, umber, olive, orange ochre, smalt, mauve, straw). Each wash is paired with a darker edge of the same pigment.

### Type

- **Fonts.** Alegreya (text, italic water), Alegreya SC (states, labels, buttons) and Alegreya Sans (reserved for dense controls), all by Huerta Tipográfica under OFL 1.1. Self-host from `fonts/` and the generated glyph PBFs. Old-style figures appear in running text, lining figures in the big year.
- **Scale.** Year 52/40 px (desktop/phone) · panel title 38/30 · cartouche year 27 · body 17 · fact values 17 · ruler years 15/14 · small-caps labels 13–15 · notes 13.

### Cartography

- **Labels.** States use Alegreya SC Medium, or Bold above 250,000 km², at 12–21 px scaled with zoom. Spacing is 0.04, 0.10 or 0.18 em by area. The halo is cream at 1.8 px. Seas use Alegreya Medium Italic at 13–18 px with 0.16 em spacing; oceans are uppercase italic at 0.35 em. Rivers use Alegreya Italic at 14 px along the line. Cities use Alegreya Regular at 14 px, the capital 16 px.
- **Territories.** Fills are at 62% so relief shows through. A hand-coloured **edge band** runs inside each border: 3–9 px of the darker pigment, offset inward, at 50% opacity with a 1.5 px blur. That is the classic "Grenzkolorit" of hand-tinted atlases, and the strongest single "alive" cue. A 0.5–1.1 px ink border sits on top.
- **Water.** Flat sea-green ground, with four engraved **waterlines** offset 2.5–14.5 px seaward from the coast and fading out. Coast stroke 0.9 px.
- **Relief.** Sepia shade and cream light at up to 50% and 42% alpha, above the fills and below the borders.
- **Graticule.** 10° lines in ink at 40% opacity, 0.5 px, and a 1 px equator. A **degree ladder neatline** around the map frame alternates ink and paper every 5° and labels every 10°, drawn in SVG from the live map projection. Phones show a single rule.
- **Paper grain.** One static `feTurbulence` tile is multiplied over the page at 22% opacity. It is never animated. Drop it under `prefers-reduced-transparency` or on low-end GPUs if profiling shows a cost.
- **Selection.** An inner madder band 5–12 px wide at 38%, a 1.6–3 px madder line, a madder-wash fill, and a madder small-caps label.

### Components

- **Timeline.** The brand is a compass-rose mark with Alegreya SC. The year is set like a plate title: "1492 AD" with the era name in madder small caps and the range in italic. The ruler has **watercolour era washes** framed in ink, above an **alternating ladder track** that echoes a map's scale bar. The thumb is a madder diamond on a hairline. The selected year is always printed on the ruler.
- **Cartouche**, bottom left over the open Atlantic: a double-ruled frame holding "The World in **1492**", "Political divisions at the end of the Medieval era", an alternating scale bar computed from the live zoom and latitude, and an engraved north arrow. On phones it shrinks to the scale bar and north mark.
- **Panel** (a page in a gazetteer): eyebrow in madder small caps, a 38 px title and an italic subtitle. The **fact box** sits between double rules with hairline-ruled rows on a recessed paper tint: In 1492 → Capital, Ruler, Existed, Borders. The **drop cap** is three lines tall in madder. **Key dates** is a vertical ruled chronology with "This map" marked by a madder diamond. Buttons are madder small caps with square corners.
- **Credit strip.** An italic one-liner in the map frame carries the uncertainty statement and the sources.

### Safe areas

The paper timeline extends under the island. The phone sheet has a cream ground and a double-rule top edge.

---

## B · Modern textbook

> Crisp and bright, with colour-coded chapters, like a current high-school history textbook. An editorial sans with a reading serif.

### Tokens

| Token | Value | Contrast |
|---|---|---|
| `--bg` / `--surface` | `#FFFFFF` / `#F3F5F7` | – |
| `--ink` | `#14202B` | 16.5:1 |
| `--ink-2` | `#47535F` | 7.9:1 on white, 7.2:1 on surface |
| Era chapter colours (white text) | Prehistory `#8C5300` 6.3:1 · Ancient `#B0362A` 6.2:1 · Medieval `#1B5CA6` 6.7:1 · Early modern `#23743A` 5.8:1 · Modern `#94335F` 7.3:1 | All AA |
| Era washes (era-coloured text) | `#F7EBD9`, `#F8E3E0`, `#E2ECF8`, `#E0F1E4`, `#F6E3EC` | 4.9–5.9:1 |
| `--accent` = Medieval | `#1B5CA6` | 5.6:1 on its wash |
| Water and water ink | `#BCDDEB`, `#1A5675` | 5.6:1 |
| Land | `#F4F1EA` | – |
| Focus ring | `#F2A900`, 3 px | – |

The map palette is 12 bright textbook pastels (coral, leaf, sunflower, iris, aqua, pink, sand, lime, apricot, cornflower, orchid, sage) at 92% opacity, each with a same-hue darker border.

### Type

- **Fonts.** Atkinson Hyperlegible Next 400/500/700/800 (Braille Institute, OFL) for UI and map names. It was designed for low-vision readers and distinguishes I/l/1 and 0/O, which suits Chromebooks and projectors. Its zero is slashed. Literata 400/600 and italic (TypeTogether for Google, OFL) for the year, panel title, reading text and water names.
- **Scale.** Year 54/40 px · panel title 36/28 · body 17 · fact values 18 · section headings 15 · ruler and era labels 13–14 · chips 12–13.

### Cartography

- **Labels.** States use Atkinson Next Bold, or ExtraBold above 250,000 km², **uppercase**, at 11–18 px. Letter-spacing is 0.03–0.12 em. The halo is white at 2 px. Water uses Literata Italic at 13–18 px, oceans 16–22 px. Rivers use Literata Italic at 14 px. Cities use Atkinson Medium at 14 px.
- **Borders.** A white casing 1.6–3.4 px wide under a 0.7–1.4 px same-hue line. This is the crisp look of modern school maps.
- **Water.** A light-blue ocean with a blurred **shelf band**, 5–14 px of lighter blue along the coast, like textbook bathymetry tints. White graticule at 75% opacity, 0.9 px, and a 1.6 px equator.
- **Relief.** Slate shade at up to 30% and white light, at 75% layer opacity. Subtle.
- **Selection.** A diagonal **hatch** in the era colour over the territory's own tint (`fill-pattern`), a 2.2–4 px accent outline, and the label in accent blue. A blue selection fill alone was rejected because it read as sea.
- **Capital.** A blue star with a white keyline.

### Components

- **Chapter strip.** The current era's colour runs as a band across the very top of the screen, including under the status bar. It is the textbook chapter tab.
- **Timeline.** Pill-shaped previous and next buttons. The year is in Literata SemiBold with a caret that signals the year chooser. A solid era **chip** ("MEDIEVAL") sits beside the range. Era bands are washes with uppercase era-coloured labels, and the active era is solid with white text. A 3 px accent rule sits under the bands. The track is light grey with graded ticks. The thumb is a white disc with a 5 px accent ring.
- **Map key**, bottom left: a **locator globe** (orthographic, drawn on canvas, with the current view outlined in accent), a plain-language region title, a key (selected territory, capital, city, approximate border), and a two-tone scale bar with a north arrow. The UI review asked for a legend, and textbook maps always have one.
- **Panel**, a textbook sidebar: a solid accent header with the eyebrow and title in white. **At a glance** is a tinted box with a two-by-two fact grid. **Key dates** has a lifespan bar from 1299 to 1922 with a "1492 · this map" marker, then a ruled event table. The overview has a **sans drop cap** in accent. Buttons are pill-shaped.

### Safe areas

The chapter strip's top border is `calc(var(--safe-top) + 4–6px)`, so the era colour fills the status-bar area deliberately. On phones the sheet header is a solid accent block with rounded top corners. The handle sits inside the header.

---

## C · Museum exhibit

> A dark slate gallery wall with the map hung as a framed print and an object label beside it.

### Tokens

| Token | Value | Contrast |
|---|---|---|
| `--wall` / `--wall-2` / `--wall-line` | `#1D2226` / `#272D32` / `#3D454C` | – |
| `--on-wall` | `#F2EEE6` | 13.9:1 |
| `--on-wall-2` | `#BCC3C9` | 9.0:1 |
| Era lights on the wall | Prehistory `#E2A75C` 7.6:1 · Ancient `#EB977F` 7.1:1 · Medieval `#9DBDE6` 8.3:1 · Early modern `#93CBAE` 8.7:1 · Modern `#DDA6C3` 7.9:1 | AA |
| Era deep tones on the card | Medieval `#2C5A8F` 6.3:1, and similar for the others | AA |
| `--card` / `--card-ink` / `--card-ink-2` | `#F4F1EA` / `#1D2226` 14.2:1 / `#4D545B` 6.8:1 | AA |
| Water and water ink | `#D3DCDB`, `#3B5960` | 5.4:1 |
| Minor ruler ticks (graphic) | `#7D868E` | 4.3:1, which passes the 3:1 non-text minimum |

The map palette is 10 museum tones (clay, sage, ochre, slate violet, celadon, rosewood, stone, lichen, sienna, pewter blue) at 50%. The selection is full-strength ochre `#D3B07E` at 95%.

### Type

- **Fonts.** Spectral and Spectral SC (Production Type, OFL) for the year, titles, body, map state names (SC) and water (italic). Libre Franklin (Impallari Type, OFL), a Franklin Gothic revival, for wall-label caps, figures and controls.
- **Scale.** Year 58/42 px · title 36/30 · lede 21 · body 17 · detail values 18 · tracked caps labels 13 (0.16–0.22 em) · ruler years 14/13.

### Cartography

- **Labels.** States use Spectral SC Medium, or SemiBold above 250,000 km², at 12–21 px in graphite `#3A3F44`. The selected name is near-black. Water uses Spectral Medium Italic, rivers Spectral Italic, cities Libre Franklin Medium at 13 px.
- **Territories.** Quiet museum tones at 50%. The **selected territory keeps full colour** while the rest step back. A 1.6–2.6 px ink outline traces it. Borders are a same-hue edge at 0.6–1.2 px.
- **Water.** Cool grey-green, with no decoration other than a fine 0.5 px graticule at 35% opacity.
- **Relief.** Neutral graphite shade with white light, the strongest relief of the three at 95%. It reads like a printed plate.
- **Capital.** A square with a centre dot.

### Components

- **Timeline, the "gallery rail".** An "HB" small-caps monogram with tracked caps. The year is in light Spectral, 58 px, cream on slate. The era name is in tracked caps in the era's light tone. Era bands are **labelled rooms**: each era is a coloured rule with a tracked caps name above it, and the active room's rule is thicker. The ruler has fine light ticks, and the thumb is a cream hairline with a dot.
- **Print.** The map hangs in a warm mat (10 px) with a hairline inner edge and a drop shadow on the wall. Nothing overlays the map on desktop.
- **Caption plate** below the print: "**1492** Europe, North Africa and Southwest Asia…" with the uncertainty note and sources in italic. The scale bar, north mark and zoom controls are on the wall.
- **Object label**, the panel: eyebrow, title and a **tombstone line** ("Empire, 1299–1922 · Southeast Europe and Anatolia"). Details sit under a 2 px ink rule in ruled rows. The overview opens with a **21 px lede** instead of a drop cap. Key dates is a ruled chronology. The **credit line** is set like a museum credit line. Buttons are square, in tracked caps.

### Safe areas

The wall colour fills the status-bar area, and the timeline starts at `calc(var(--safe-top) + 6px)`. On desktop and tablet the caption row's bottom padding and the label card's bottom margin include `--safe-bottom`. On phones the label card becomes a sheet with rounded top corners, rising over the print, with the same inset-padded button row.

---

## Checked against the UI review's 20 tells

| Tell | Status |
|---|---|
| Meaningless gradients and colour-shifting headlines (1, 2) | None. Hard-stop stripes appear only as patterns: the ruler ladder in A and the hatch swatch in B |
| Glass, glows and spotlights (3, 4) | None. C's dimming of non-selected territories encodes the selection and isn't decorative |
| Same type everywhere (5) | Each direction pairs its type to the reading task: map names, body text and controls |
| Display-serif italic word as hierarchy (6) | None. Italic is reserved for water names and notes, following map convention |
| Marketing hero, equal icon cards, nested cards (7, 8, 10) | None. The map opens directly, and the one boxed fact group in each panel is set off with rules or a tint, not a card inside a card |
| Oversized rounded corners everywhere (9) | A and C use square corners. B rounds pills and sheets only |
| Detached labels, false section numbers (11, 12) | Labels sit tight to their values. There are no section numbers |
| Unsourced stats (13) | Every fact carries a source line: Wikidata, Wikipedia or Historical Basemaps |
| Scroll fade-ins, pulsing dots (15, 16) | None. Nothing animates |
| Slogan copy, em-dash cadence, repeated instructions (17–20) | The copy is plain labels. "This map" marks the map year once |

## Recommendation

**Build A, the Classic atlas, and bring in two components from B.**

**Why A** (judgment, based on the screenshots and the brief):

- It answers the owner's words directly: "alive like a textbook," "I like the timeline." The hand-coloured edge bands, engraved waterlines, small-caps names, cartouche and degree ladder make the map itself feel crafted. In B and C the life comes mainly from the surrounding UI.
- It is an *evolution* of what the owner already said looks good: cream paper, serif dates and an oxblood accent. It isn't a rebrand. The current timeline layout maps one-to-one onto A's timeline.
- It stays clean. The decoration lives in cartographic conventions (edge tint, waterlines, neatline, cartouche) that each carry meaning or orientation, and the panel is plain text with rules.
- Contrast passes AA throughout: ink 13.2:1, secondary 7.6:1, sea names 4.9:1.

**Take from B:**

1. **The map key with the locator globe.** It orients students on phones and answers the review's legend findings: archaeological sites, approximate borders, the selected territory. Restyle it as a second cartouche in A's frame language.
2. **Atkinson Hyperlegible Next as an option for the projector or accessibility text setting.** Keep Alegreya as the default.

**Why not B or C as the base:**

- B is the most legible on a washed-out projector and the most "2026 textbook". But its bright pastels and pills are closest to the generic modern look the owner called bland, and most of its life sits in UI chrome.
- C is the most elegant on desktop. But the dark wall and mat shrink the map, a dark frame looks heavy in a lit classroom, and a museum is a step further from "textbook" than an atlas.

**Risks to check before committing.** These are assumptions, not yet measured.

- **GPU cost on low-end Chromebooks** of A's extra line layers (four waterlines and an edge band) and the full-screen multiply grain. Profile them, and drop the grain and two waterlines on low-end devices if needed.
- **Cream legibility on a real classroom projector.** Use the farthest-seat test from the UI review.
- **Wider glyph coverage.** Many non-Latin territory names (Osage, Canadian syllabics, and others) need Noto fallbacks in the glyph build.
