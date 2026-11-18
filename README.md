# Historic Borders

[Historic Borders](https://historicborders.app/) is an interactive map for exploring selected political-border snapshots from 123,000 BC through 2010. Select a place to read a source-backed Wikipedia summary, move through the timeline, or explore the Pennsylvania school-district map.

It is designed to work like a textbook atlas for classrooms: readable on a projector, simple on a Chromebook or phone, and every view is shareable by URL (see [docs/QUERY_PARAMS.md](docs/QUERY_PARAMS.md)). Keyboard: ← / → change year.

Historical and administrative boundaries are third-party data and may be approximate, disputed, or incomplete. Follow the in-app source links and consult original sources for academic or legal use.

## Requirements

- Node.js 22 (see `.nvmrc`)
- Yarn Classic 1.22.22 (one root `yarn.lock`; never npm or pnpm)

No map token is needed: maps are MapLibre GL JS over self-hosted vector tiles, fonts and glyphs.

## Local setup

```bash
git clone https://github.com/nrgapple/historic-country-borders-app.git
cd historic-country-borders-app
nvm use
yarn install --frozen-lockfile
yarn remaster:dev
```

Open <http://localhost:4321>. The app lives in `remaster/` (Astro 7, one React 19 island); see [remaster/README.md](remaster/README.md).

### Environment variables

| Variable         | Exposure | Purpose                     |
| ---------------- | -------- | --------------------------- |
| `PUBLIC_GA_FOUR` | Browser  | Optional GA4 measurement ID |

Feedback secrets are configured only on the isolated Cloudflare Worker, never in the static build. A variable prefixed with `PUBLIC_` is baked into the browser bundle and must never contain a secret. See [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md) and [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md).

## Validation

```bash
yarn validate                 # complete local quality gate (quality + browser journeys)
yarn quality                  # everything except the browser journeys
yarn checks                   # format, root type-check, script/Worker tests, data validation
yarn remaster:build           # production build -> remaster/dist
yarn remaster:test            # app unit tests
yarn remaster:test:e2e        # browser journeys against remaster/dist
yarn test:layout              # safe-area, width and forced-dark suites (e2e/layout)
yarn cloudflare:check         # Wrangler dry-run of the production Worker and assets
yarn size:check               # file-count and payload budgets for remaster/dist
yarn data:validate            # validate all committed map data offline
yarn data:refresh             # explicitly refresh pinned upstream datasets
yarn data:reconcile:context   # explicitly map territory names to Wikidata items
yarn data:refresh:context     # explicitly refresh per-year Wikidata facts
```

Tests use fixtures and do not require production credentials or live third-party APIs.

## Architecture and data

The app prerenders static HTML and ships committed, content-hashed map assets on Cloudflare Workers Static Assets. Normal pages and map assets invoke no Worker code; only the exactly routed, bounded `/api/feedback` Worker path is dynamic. Wikipedia uses direct browser CORS access. Data refreshes are explicit and reviewable rather than occurring during builds or ordinary traffic.

- Historical map data: [source, pin, validation, and uncertainty](docs/HISTORICAL_DATA.md)
- Year facts and "What changed": [Wikidata reconciliation and publication](docs/HISTORICAL_CONTEXT.md)
- Country descriptions: [Wikipedia](https://www.wikipedia.org/)
- Pennsylvania districts: PASDA (source, vintage, and limitations are documented in [docs/PA_SCHOOL_DISTRICTS.md](docs/PA_SCHOOL_DISTRICTS.md))
- Maps: [MapLibre GL JS](https://maplibre.org/) over a self-hosted Natural Earth basemap without modern borders ([docs/BASEMAP.md](docs/BASEMAP.md)) and a self-hosted Pennsylvania street basemap ([docs/PA_BASEMAP.md](docs/PA_BASEMAP.md)); fonts and glyphs in [docs/FONTS.md](docs/FONTS.md)
- Product audit and design rationale: [docs/product/REVAMP_AUDIT.md](docs/product/REVAMP_AUDIT.md), [docs/product/REMASTER_PLAN.md](docs/product/REMASTER_PLAN.md)

See [PRODUCT.md](PRODUCT.md), [docs/UPGRADE_HARNESS_PLAN.md](docs/UPGRADE_HARNESS_PLAN.md), and [docs/product/DECISIONS.md](docs/product/DECISIONS.md) for product and architecture constraints. The original Next.js app was removed on 2026-11-18; it remains in the git history.

## Contributing

1. Create a focused branch.
2. Add or update tests with behavior changes.
3. Run `yarn validate`.
4. Submit a pull request with data provenance and uncertainty changes called out explicitly.

## License

See [LICENSE](LICENSE).
