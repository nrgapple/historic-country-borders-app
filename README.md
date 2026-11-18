# Historic Borders

[Historic Borders](https://historicborders.app/) is an interactive map for exploring selected political-border snapshots from 123,000 BC through 2010. Select a place to read a source-backed Wikipedia summary, move through the timeline, or explore the Pennsylvania school-district map.

It is designed to work like a textbook atlas for classrooms: readable on a projector, simple on a Chromebook or phone, and every view is shareable by URL (see [docs/QUERY_PARAMS.md](docs/QUERY_PARAMS.md)). Keyboard: ← / → change year.

Historical and administrative boundaries are third-party data and may be approximate, disputed, or incomplete. Follow the in-app source links and consult original sources for academic or legal use.

## Requirements

- Node.js 22 (see `.nvmrc`)
- Yarn Classic 1.22.22
- A public Mapbox token for map rendering

## Local setup

```bash
git clone https://github.com/nrgapple/historic-country-borders-app.git
cd historic-country-borders-app
nvm use
yarn install --frozen-lockfile
cp .env.example .env.local
yarn dev
```

Open <http://localhost:3000>.

### Environment variables

| Variable                   | Exposure | Purpose                                 |
| -------------------------- | -------- | --------------------------------------- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Browser  | Public, URL-restricted Mapbox map token |
| `NEXT_PUBLIC_GA_FOUR`      | Browser  | Optional GA4 measurement ID             |

Feedback secrets are configured only on the isolated Cloudflare Worker, not exposed to the Next.js build. Never place a secret in a variable prefixed with `NEXT_PUBLIC_`. See [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md) and [docs/CLOUDFLARE_DEPLOYMENT.md](docs/CLOUDFLARE_DEPLOYMENT.md).

## Validation

```bash
yarn validate                 # complete local quality gate
yarn type-check               # TypeScript
yarn test                     # unit/integration tests
yarn test:e2e                 # production build plus browser journeys
yarn data:validate            # validate all committed map data offline
yarn data:refresh             # explicitly refresh both pinned upstream datasets
yarn data:refresh:historical  # explicitly refresh pinned historical artifacts
yarn data:refresh:schools     # explicitly refresh pinned PASDA artifact
yarn static:validate          # verify static routes/assets and dynamic isolation
yarn preview                  # serve out/ with deep-link and 404 behavior
yarn format:check && yarn lint
```

Tests use fixtures and do not require production credentials or live third-party APIs.

## Architecture and data

The application exports static HTML and committed map assets for Cloudflare Workers Static Assets. Normal pages and map assets invoke no Worker code; only the exactly routed, bounded feedback Worker path is dynamic. Wikipedia uses direct browser CORS access. Data refreshes are explicit and reviewable rather than occurring during builds or ordinary traffic.

- Historical map data: [source, pin, validation, and uncertainty](docs/HISTORICAL_DATA.md)
- Country descriptions: [Wikipedia](https://www.wikipedia.org/)
- Pennsylvania districts: PASDA (source, vintage, and limitations are documented in [docs/PA_SCHOOL_DISTRICTS.md](docs/PA_SCHOOL_DISTRICTS.md))
- Maps: [Mapbox](https://www.mapbox.com/) GL JS; historical maps use a minimal physical basemap without modern borders (`lib/basemap.ts`)
- Product audit and design rationale: [docs/product/REVAMP_AUDIT.md](docs/product/REVAMP_AUDIT.md)

See [PRODUCT.md](PRODUCT.md), [docs/UPGRADE_HARNESS_PLAN.md](docs/UPGRADE_HARNESS_PLAN.md), and [docs/product/DECISIONS.md](docs/product/DECISIONS.md) for product and architecture constraints.

## Contributing

1. Create a focused branch.
2. Add or update tests with behavior changes.
3. Run `yarn validate`.
4. Submit a pull request with data provenance and uncertainty changes called out explicitly.

## License

See [LICENSE](LICENSE).
