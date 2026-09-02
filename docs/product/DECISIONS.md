# Product and Architecture Decisions

## Accepted

### Static-first Cloudflare deployment

Normal pages and map assets will not invoke request-time compute. Cloudflare is the target because its static asset delivery fits the free-only constraint and its bot controls address crawler amplification. Dynamic compute is restricted to justified, bounded endpoints.

### Wikipedia-only country information

Generated country descriptions, country comparisons, their UI, analytics, history, caching service, and provider-specific dependencies were removed in M1. Wikipedia is the sole information source.

### Bound temporary dynamic routes

Until static artifacts replace the map proxies, each current route has explicit method, input or source-size, timeout, validation, and safe-failure bounds. Feedback platform rate limiting and crawler dashboard controls are deferred to the M3 Cloudflare boundary, where they can work consistently across instances. See `docs/RUNTIME_SURFACE.md`.

### Pennsylvania school districts as a committed static artifact

The browser consumes a committed, validated artifact generated only by `yarn data:refresh`. Normal builds and page traffic do not contact PASDA. Committing the measured 19.4 MiB artifact keeps deployment deterministic, portable, and free-tier compatible while preserving a reviewable upstream diff.

## Deferred

### Historical generated-data storage location

The M2 school artifact is committed. Choose committed artifacts, CI/release artifacts, or object storage for the larger historical dataset after measuring its output and Cloudflare constraints in M3.

### Domain cutover

The owner can access GitHub and Vercel and can create a Cloudflare account. The current DNS registrar/account must be identified before launch.
