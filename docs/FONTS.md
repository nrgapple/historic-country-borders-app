# Fonts and map glyphs

Status: built and validated for the remaster (track T3, 2026-11-18). The app's Astro shell (T5) and the Classic-atlas style (T6) consume them.

All type is self-hosted under the SIL Open Font License 1.1. The map makes no font or glyph request to a third party.

## What is published

| Path                                              | Contents                                                                                              | Cache                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `/fonts/atlas.css`                                | `@font-face` rules for the default UI: Alegreya, Alegreya SC, Alegreya Sans, Historic Borders Scripts | revalidate                          |
| `/fonts/map-aliases.css`                          | Alias faces named after the five default map fontstacks (see "Grapheme clusters")                     | revalidate                          |
| `/fonts/projector.css`                            | Atkinson Hyperlegible Next UI faces and the two Atkinson map aliases                                  | revalidate                          |
| `/fonts/textbook.css`                             | Literata UI faces and the Literata Italic map alias (Modern textbook map style)                       | revalidate                          |
| `/fonts/files/<subset>.<sha256:10>.woff2`         | Content-hashed WOFF2 files                                                                            | immutable                           |
| `/fonts/licenses/LICENSE-<font>.txt`              | One OFL 1.1 copy per font family                                                                      | revalidate                          |
| `/glyphs/<buildId>/<fontstack>/<start>-<end>.pbf` | SDF glyph ranges; `<buildId>` is a hash of every PBF, so a rebuild changes every URL                  | immutable, `application/x-protobuf` |
| `data/map-fonts.json` (not published)             | Manifest: glyph URL template, fontstacks, ranges, hashes, `font-faces` input, files, licenses         | build input                         |

`public/_headers` sets `Content-Type: application/x-protobuf` on `/glyphs/*`, because Wrangler 4.164 sends `.pbf` without a type (plan §3.2), and that type is on Cloudflare's compression list. `/glyphs/*` and `/fonts/files/*` are cached as `public, max-age=31536000, immutable`. The `/glyphs/` tree holds only PBFs, so the type rule cannot mislabel another file.

## Map fontstacks (for the style)

Use **exactly** these strings, each as a **single-element** `text-font` array. A multi-name array makes MapLibre request a combined directory, such as `/glyphs/…/Alegreya SC Bold,Noto Sans Regular/0-255.pbf`, which does not exist. Fallback scripts are already merged into each stack.

| Fontstack (exact string)            | Use in the Classic atlas                                      | Weight, style | Group     |
| ----------------------------------- | ------------------------------------------------------------- | ------------- | --------- |
| `Alegreya SC Medium`                | State and territory names                                     | 500 normal    | default   |
| `Alegreya SC Bold`                  | State names above 250,000 km²                                 | 700 normal    | default   |
| `Alegreya Medium Italic`            | Sea and ocean names                                           | 500 italic    | default   |
| `Alegreya Italic`                   | River and lake names                                          | 400 italic    | default   |
| `Alegreya Regular`                  | City, capital and site names                                  | 400 normal    | default   |
| `Atkinson Hyperlegible Next Medium` | Projector text: water, cities and small labels                | 500 normal    | projector |
| `Atkinson Hyperlegible Next Bold`   | Projector text: state names, in uppercase plus letter-spacing | 700 normal    | projector |
| `Literata Italic`                   | Modern textbook: sea, river and ruins names                   | 400 italic    | textbook  |

The Modern textbook map style (`remaster/src/adapters/textbookStyle.ts`) uses the two Atkinson stacks for state, district and city names and `Literata Italic` for water; it never requests an Alegreya stack. One Literata stack keeps the glyph budget: the mock's Literata Medium Italic seas and Atkinson ExtraBold large states are drawn with Literata Italic and Atkinson Bold.

Each stack is its primary font, then a Noto Sans subset (same weight and style), then Noto Sans Cherokee, Noto Sans Canadian Aboriginal and Noto Sans Osage. Atkinson has no italic stack, following plan §2.1 ("Atkinson (Medium/Bold)"). Projector water names are therefore upright. If T6 wants italic water in projector mode, add `Atkinson Hyperlegible Next Medium Italic` to `FONTSTACKS` in `scripts/lib/map-fonts.js` and rebuild; that adds 13 files.

How the style uses them:

```ts
import fonts from '../../data/map-fonts.json'; // build-time import

const style = {
  glyphs: `${origin}${fonts.glyphs.url}`, // /glyphs/<buildId>/{fontstack}/{range}.pbf
  layers: [
    {
      id: 'states',
      type: 'symbol',
      layout: {
        'text-font': [
          'case',
          ['>', ['get', 'a'], 250000],
          ['literal', ['Alegreya SC Bold']],
          ['literal', ['Alegreya SC Medium']],
        ],
      },
    },
  ],
};
```

- Load `/fonts/map-aliases.css` on map pages, and `/fonts/projector.css` only when Projector text is on. No file in either downloads until a face is used.
- `fonts.glyphs.fontstacks[name].faces` is a ready-made `font-faces` value, if a later measurement favours it.
- `yarn data:validate:fonts --style <style.json>` fails for a `text-font` that is not published, a combined stack, a font read from data, or a `glyphs` URL that is not the manifest's. A unit test can call `checkStyleFontstacks(style, manifest)` from `scripts/lib/map-fonts.js` on the style module directly.

### Grapheme clusters are drawn locally

MapLibre 6.19 requests glyph PBFs only for single codepoints. A grapheme cluster (a letter plus combining marks, such as `x̣`, `w̓` or a decomposed `ī`) is always drawn in the browser with TinySDF, using the fontstack name as the CSS family (`glyph_manager.ts`, `_getAndCacheGlyphsPromise`). It also infers the weight and style from words such as "Medium" and "Italic" in the name.

Without a CSS face named after the stack, the browser draws those clusters in a system font. `map-aliases.css` declares faces under exactly the fontstack names, with the sniffed weight and style, from the same WOFF2 files as the UI. Published names contain 25 such clusters, all in 1492 First Nations names. In the measured PBF runs, the aliases cost 6 WOFF2 requests (103 KB) when the North American view first drew clusters.

## Web fonts (for the page)

| CSS family                   | Faces                                                                        | File            |
| ---------------------------- | ---------------------------------------------------------------------------- | --------------- |
| `Alegreya`                   | 400, 400 italic, 500 italic, 700                                             | `atlas.css`     |
| `Alegreya SC`                | 500, 700                                                                     | `atlas.css`     |
| `Alegreya Sans`              | 500, 700                                                                     | `atlas.css`     |
| `Historic Borders Scripts`   | Noto Sans subset 400/700; Noto Sans Cherokee, Canadian Aboriginal, Osage 400 | `atlas.css`     |
| `Atkinson Hyperlegible Next` | 400, 400 italic, 500, 700                                                    | `projector.css` |
| `Literata`                   | 400, 400 italic, 600                                                         | `textbook.css`  |

`projector.css` and `textbook.css` load only while Projector text or the Modern textbook map style is on; an inline head script adds them before first paint (`remaster/src/atlas/theme.ts`, `settings.ts`).

Suggested tokens: `--font-text: 'Alegreya', 'Historic Borders Scripts', Georgia, serif;` and `--font-sc: 'Alegreya SC', 'Historic Borders Scripts', Georgia, serif;`. Projector text swaps in `'Atkinson Hyperlegible Next', 'Historic Borders Scripts', system-ui, sans-serif`. Every face uses `font-display: swap`.

**Subsetting.** Each family ships fontsource's Latin subset, plus only the subsets that published names actually use: Latin Extended, Vietnamese for "Đại Việt", and Greek for "kòréβahώ". Cyrillic and Greek Extended are not shipped. Each `unicode-range` is fontsource's range minus any published character that the file lacks, so the browser never downloads a file for a character it cannot draw. Fontsource's Noto Sans subsets drop combining marks, such as U+0313 and U+0328, and punctuation, such as U+2027 and U+207F. The build therefore downloads the full Noto Sans from `google/fonts` once, pinned by commit and SHA-256. It then cuts the font down with HarfBuzz to the 63 characters that some primary font lacks (plus the letters of clusters it must draw whole), at about 8 KB per weight and style.

### Bytes

Measured on build `4085cf4e0756`. The 2026-11-18 rebuild `b785b3de646d` adds `Literata Italic` and Literata's UI faces for the Modern textbook map style: 8 stacks × 12 ranges (96 PBFs, 2,628,010 bytes raw) and 64 WOFF2 files (974,752 bytes). Every PBF of the seven earlier stacks is byte-identical to `cdf13ca70db8`; only the build directory moved. The earlier rebuild `cdf13ca70db8`, after the historical names were normalized to NFC and U+FFFD removed, publishes 7 stacks × 12 ranges (84 PBFs, 2,227,586 bytes raw; the `65280-65535` range is gone) and 52 WOFF2 files (817,640 bytes).

| What                                                                     | Files | Bytes                                                     |
| ------------------------------------------------------------------------ | ----: | --------------------------------------------------------- |
| All published WOFF2                                                      |    52 | 818,808                                                   |
| Default UI faces (`atlas.css`), all subsets                              |    37 | 611,904                                                   |
| Default UI, Latin subset of all 8 faces (most an English page can fetch) |     8 | 204,228                                                   |
| Typical atlas page: Alegreya 400, 400 italic, 700, SC 500, SC 700, Latin |     5 | 131,932                                                   |
| Projector UI, Latin subset of 4 faces                                    |     4 | 51,600                                                    |
| Noto Sans subsets (5 weight/style cuts)                                  |     5 | 7,864–8,236 each                                          |
| CSS (`atlas.css` / `map-aliases.css` / `projector.css`)                  |     3 | 15,392 / 16,368 / 10,493 (1,389 / 1,477 / 1,106 Brotli-5) |
| Glyph PBFs, 7 stacks × 13 ranges                                         |    91 | 2,233,301 raw; 689,632 Brotli-5                           |
| One stack's `0-255.pbf` (Alegreya SC Medium)                             |     1 | 79,323 raw; 25,464 Brotli-5                               |

Per stack, the 13 ranges total 363–382 KB raw for the five Alegreya stacks and 186–194 KB for Atkinson. Brotli-5 shrinks them to 108–117 KB and 62–65 KB. A page fetches only the ranges of the characters it draws.

`yarn size:check` enforces these budgets: at most 160 glyph files, 3 MiB of glyphs, 128 KiB per PBF, 80 WOFF2 files, 1,100 KiB of WOFF2, 240 KiB of default Latin UI fonts, 64 KiB of projector Latin UI fonts and 72 KiB of textbook (Literata) Latin UI fonts (62 KiB on `b785b3de646d`).

## Coverage

The build and the validator scan every `.json`/`.geojson` under `public/data/historical`, `public/data/years` and `public/basemap/labels`. In GeoJSON features they read the label properties `NAME`, `ABBREVN`, `SUBJECTO`, `PARTOF`, `name`, `n` and `p`. The slim remaster formats (T1's `n`/`p`, T2's basemap labels) are therefore covered as soon as they are published. C0 and C1 controls are never drawn and are ignored.

**Observed on 2026-11-18:** 3,294 distinct names in 53 files use 218 codepoints in 13 glyph ranges: `0-255`, `256-511`, `512-767`, `768-1023`, `4864-5119`, `5120-5375`, `5376-5631`, `5632-5887`, `7680-7935`, `8192-8447`, `42752-43007`, `65280-65535`, `66560-66815`. After the name corrections and NFC normalization (rebuild `cdf13ca70db8`), 3,279 distinct names in 212 files (combined and split) use 216 codepoints in 12 ranges, without `65280-65535`, and 20 multi-codepoint clusters instead of 25. Latin has 129 codepoints, Common 28 and Inherited 6.

| Script (Unicode `Script`)       | Codepoints | Example                                     | Drawn from                                       |
| ------------------------------- | ---------: | ------------------------------------------- | ------------------------------------------------ |
| Latin                           |        127 | Kanienʼkehá꞉ka, Đại Việt                    | Primary; Noto Sans for IPA letters such as ɬ ʔ ʉ |
| Canadian Aboriginal (syllabics) |         33 | Anishinabewaki ᐊᓂᔑᓈᐯᐗᑭ                      | Noto Sans Canadian Aboriginal                    |
| Common (punctuation, modifiers) |         30 | Sweden–Norway, Umoⁿhoⁿ, oθaakiiwaki‧hina‧ki | Primary; Noto Sans for U+2027, U+207F, U+A789    |
| Osage                           |         11 | 𐓏𐒰𐓓𐒰𐓓𐒷 … (Osage)                            | Noto Sans Osage                                  |
| Inherited (combining marks)     |          8 | Dënësųłinë́, x̣àʼisla w̓áwís                   | Primary or Noto Sans; clusters drawn locally     |
| Cherokee                        |          6 | ᏣᎳᎫᏪᏘᏱ Tsalaguwetiyi                        | Noto Sans Cherokee                               |
| Greek                           |          3 | kòréβahώ                                    | Alegreya; Noto Sans under Atkinson               |

The plan expected Ethiopic, Canadian syllabics and Deseret. The data has **no Ethiopic and no Deseret**. The `66560-66815` range is **Osage** (U+104B0–U+104FF), and Cherokee is present.

**Data observations for the historical-data track:**

- Fixed on 2026-11-18: `Arag�n` and other U+FFFD, mojibake and lost-character names are corrected by reviewed overrides, and every published name is NFC, so `ī`, `ō`, `à` and `ŝ` are single codepoints served from PBFs (`docs/HISTORICAL_DATA.md` "Reviewed name overrides"). Atkinson Hyperlegible Next has no `ŝ` (U+015D), so the projector stacks draw it from Noto Sans. Clusters with no precomposed form, such as `x̣`, `w̓` and `ë́`, stay local.
- Some names begin with spaces, and one is only spaces.

**Range policy.** A range carries every glyph its primary font has, so a data refresh that keeps the same ranges reproduces the same files. From fallback fonts it carries only the published characters, so the syllabics ranges are about 4–10 KB instead of about 145 KB. Only ranges that names use are emitted, which bounds the file count at stacks × ranges.

## Glyph rendering: PBF vs local

The measurement is in `remaster-spike/scripts/measure-glyphs.mjs`, with results in `remaster-spike/results/glyphs.json` and screenshots in `remaster-spike/shots/glyphs-*.png`. It runs MapLibre 6.19.0 with the Classic-atlas label layers on 1492 and 1914 data, under 4× CPU and with and without Fast 3G. It compares three modes:

- **pbf:** the glyphs URL, with `map-aliases.css` for clusters.
- **faces:** the style's `font-faces`, with the PBFs as fallback.
- **local:** no glyphs URL, so MapLibre draws every glyph from the alias CSS.

`localIdeographFontFamily` applies only to CJK, Hangul and Kana, and none occurs in published names, so it does not apply here.

**Observed, 2026-11-18, Chromium 151 headless, MapLibre 6.19.0, glyph build `4085cf4e0756`:**

| Measure                                                               | pbf                          | faces                        | local        |
| --------------------------------------------------------------------- | ---------------------------- | ---------------------------- | ------------ |
| Glyph or font requests, whole scenario                                | 21 PBFs + 6 WOFF2 (clusters) | 15 WOFF2                     | 15 WOFF2     |
| Bytes on the wire (PBF Brotli-5)                                      | 249,363 + 103,338            | 306,781                      | 306,781      |
| Main-thread cost per label glyph, 4× CPU (`measure-glyph-raster.mjs`) | **0.09 ms** (decode)         | **3.29 ms** (TinySDF raster) | 3.29 ms      |
| Same, for the 462 glyphs of the 1492 and 1914 labels                  | 41 ms                        | 1,518 ms                     | 1,518 ms     |
| Labels placed (Europe 1492 / North America 1492 / world 1914)         | 47 / 54 / 63                 | 47 / 55 / 63                 | 47 / 55 / 63 |

- **The whole-map timings were not usable.** The machine's load average was 110–150 from other sessions. Identical runs of one mode ranged from 11 s to 69 s, so `results/glyphs.json` keeps them only as raw samples. The per-glyph comparison runs both methods in one page, interleaved for 9 rounds, so load affects them equally.
- **Main thread.** Local rasterization (`font-faces` or no glyphs URL) costs about 37× more main-thread time per glyph than reading a prebuilt PBF. On a 4×-throttled machine, that is about 1.5 s of main-thread work spread over the first views. It matches the spike's 150–300 ms long tasks after "ready" (plan §8).
- **Bytes.** Here `font-faces` wins: it adds 0–307 KB of WOFF2 that is largely the same files the UI already loads (Alegreya SC 500/700 and Alegreya 400 Latin are UI faces). PBFs add about 250 KB Brotli across a session, about 25 KB for each Latin range.
- **Rendering.** All three modes rendered syllabics, Osage, Cherokee and combining-mark clusters correctly in the screenshots.

**Recommendation: PBF glyphs** (the plan's default). Load `map-aliases.css` on the map page for clusters, and leave `font-faces` and `localIdeographFontFamily` unset. The deciding constraint is main-thread time on school Chromebooks and the time until a territory can be selected, not bandwidth. The extra bytes are immutable, cached for a year, and fetched per visible range. Revisit only if a profile on a real Chromebook (P0/P1) shows glyph PBF downloads, rather than rasterization, on the critical path.

## Licenses and attribution

Every font is under the SIL Open Font License 1.1. The OFL allows bundling, subsetting and redistribution with the license; no font here has a Reserved Font Name. The glyph PBFs are derived from these fonts and are covered by the same licenses. License copies ship at `/fonts/licenses/`:

| Font                                           | Copyright                                                                              | Source                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Alegreya, Alegreya SC                          | Copyright 2011 The Alegreya Project Authors (Huerta Tipográfica)                       | `@fontsource/alegreya`, `@fontsource/alegreya-sc` 5.3.0 |
| Alegreya Sans                                  | Copyright 2013 The Alegreya Sans Project Authors (Huerta Tipográfica)                  | `@fontsource/alegreya-sans` 5.3.0                       |
| Atkinson Hyperlegible Next                     | Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (Braille Institute) | `@fontsource/atkinson-hyperlegible-next` 5.3.0          |
| Literata                                       | Copyright 2017 The Literata Project Authors (TypeTogether for Google)                  | `@fontsource/literata` 5.3.0                            |
| Noto Sans                                      | Copyright 2022 The Noto Project Authors                                                | `google/fonts` @ `7af0d90`, subset by the build         |
| Noto Sans Cherokee, Canadian Aboriginal, Osage | Copyright 2022 The Noto Project Authors                                                | `@fontsource/noto-sans-*` 5.3.0                         |

**About dialog text** (AboutDialog, plan P2):

> Map labels and text use Alegreya, Alegreya SC and Alegreya Sans by Huerta Tipográfica, and Atkinson Hyperlegible Next by the Braille Institute (for projector text). Names in Cherokee, Canadian Aboriginal syllabics, Osage and some phonetic letters use Noto Sans fonts by the Noto Project Authors. All fonts are used under the SIL Open Font License 1.1 ([licenses](/fonts/licenses/)).

Link each family to its file in `/fonts/licenses/` if the dialog lists them separately.

## Regenerating

```bash
source ~/.nvm/nvm.sh && nvm use 22
yarn install --frozen-lockfile
yarn playwright install chromium   # once; the build rasterizes with Playwright's headless Chromium
yarn data:refresh:fonts            # scripts/build-map-fonts.js, about 30 s
yarn data:validate:fonts           # scripts/validate-map-fonts.js; also part of yarn data:validate
```

`yarn data:refresh` runs the font build after `data:refresh:historical`, because names decide the ranges. Run it after any change to published names, `scripts/lib/map-fonts.js` or the font packages. Commit the changes to `public/fonts`, `public/glyphs` and `data/map-fonts.json` together. A new `buildId` replaces the whole glyph directory. The build is never run at deploy time.

- **Network:** only the first run downloads the pinned Noto Sans (two variable TTFs and `OFL.txt`, about 4 MB) from `raw.githubusercontent.com/google/fonts/<commit>`. It verifies each file's SHA-256 and caches it under `~/LargeFiles/historic-borders/fonts`, which is on the SSD. Set `HB_FONT_CACHE` to use another directory. To update Noto, change `NOTO_SANS_SOURCE` (commit and hashes).
- **Renderer:** Chromium's canvas text and `@mapbox/tiny-sdf` 2.3.0, MapLibre's own SDF code, with MapLibre's PBF parameters: 24 px, buffer 3, radius 8, cutoff 0.25, and `top` offset −27. Each font file is registered as its own family, and a codepoint is drawn only by the file whose `cmap` and declared range hold it. Nothing falls back to a system font, and no bold or italic is synthesized. Repeated builds on the same Chromium produced identical files. Another Chromium version can change pixels, and with them the `buildId`.
- **Validator:** it checks that every configured stack has, for every published codepoint, a glyph in the right range file. It also checks that PBFs decode with the right stack name and range, and that hashes match the manifest. No stale files may sit in `public/glyphs` or `public/fonts/files`. Every CSS `url()` must exist, every font must have an OFL 1.1 copy with a copyright line, and the `_headers` rules must be present.

## Open checks (P0, preview Worker)

- Whether a `_headers` `Content-Type` overrides Wrangler's missing type on `.pbf`, and whether Workers Static Assets then compresses the response.
- Whether fontstack paths with spaces (`/glyphs/…/Alegreya%20SC%20Medium/0-255.pbf`) resolve on Workers Static Assets. MapLibre does not encode `{fontstack}`, and the browser sends `%20`.
