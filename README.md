# Historic Borders

[Historic Borders](https://historicborders.app/) is an interactive map for exploring political borders from 2000 BC through 1994. Select a place to read a source-backed Wikipedia summary, move through the timeline, or explore the Pennsylvania school-district map.

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

| Variable                         | Exposure    | Purpose                                          |
| -------------------------------- | ----------- | ------------------------------------------------ |
| `NEXT_PUBLIC_MAPBOX_TOKEN`       | Browser     | Public, URL-restricted Mapbox map token          |
| `NEXT_PUBLIC_GA_FOUR`            | Browser     | Optional GA4 measurement ID                      |
| `DISCORD_WEBHOOK_URL`            | Server only | Optional feedback destination                    |
| `AIRTABLE_PERSONAL_ACCESS_TOKEN` | Server only | Optional feedback destination credential         |
| `AIRTABLE_BASE_ID`               | Server only | Optional feedback base                           |
| `AIRTABLE_TABLE_NAME`            | Server only | Optional feedback table (defaults to `Feedback`) |

Never place a secret in a variable prefixed with `NEXT_PUBLIC_`. See [docs/FEEDBACK_SETUP.md](docs/FEEDBACK_SETUP.md) for optional feedback setup.

## Validation

```bash
yarn validate                 # complete local quality gate
yarn type-check               # TypeScript
yarn test                     # unit/integration tests
yarn test:e2e                 # production build plus browser journeys
yarn data:validate            # validate committed PA district data offline
yarn data:refresh             # explicitly fetch and review a PASDA refresh
yarn format:check && yarn lint
```

Tests use fixtures and do not require production credentials or live third-party APIs.

## Architecture and data

The current upgrade moves the application to a static-first Cloudflare deployment. Normal pages and map assets will become immutable static output; only bounded operations such as feedback may remain dynamic. Data refreshes are explicit and reviewable rather than silently occurring during ordinary traffic.

- Historical map data: [historicborders-timeline-example](https://github.com/nrgapple/historicborders-timeline-example)
- Country descriptions: [Wikipedia](https://www.wikipedia.org/)
- Pennsylvania districts: PASDA (source, vintage, and limitations are documented in [docs/PA_SCHOOL_DISTRICTS.md](docs/PA_SCHOOL_DISTRICTS.md))
- Maps: [Mapbox](https://www.mapbox.com/)

See [PRODUCT.md](PRODUCT.md), [docs/UPGRADE_HARNESS_PLAN.md](docs/UPGRADE_HARNESS_PLAN.md), and [docs/product/DECISIONS.md](docs/product/DECISIONS.md) for product and architecture constraints.

## Contributing

1. Create a focused branch.
2. Add or update tests with behavior changes.
3. Run `yarn validate`.
4. Submit a pull request with data provenance and uncertainty changes called out explicitly.

## License

See [LICENSE](LICENSE).
