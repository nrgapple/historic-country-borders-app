# Product and Architecture Decisions

## Accepted

### Static-first Cloudflare deployment

Normal pages and map assets will not invoke request-time compute. Cloudflare is the target because its static asset delivery fits the free-only constraint and its bot controls address crawler amplification. Dynamic compute is restricted to justified, bounded endpoints.

### Wikipedia-only country information

Generated country descriptions, country comparisons, their UI, analytics, history, caching service, and provider-specific dependencies were removed in M1. Wikipedia is the sole information source.

### Exactly one dynamic feedback route

The static app has no Next API routes. Workers Static Assets uses `run_worker_first = ["/api/feedback"]`, so only that exact path executes Worker code. A per-client SQLite Durable Object strictly limits 20 attempts/minute; schema/body/origin/method checks, destination timeouts, and safe failures provide the remaining bounds. Historical maps and school maps are direct static assets. Wikipedia uses direct browser CORS access. See `docs/RUNTIME_SURFACE.md`.

### Pennsylvania school districts as a committed static artifact

The browser consumes a committed, validated artifact generated only by `yarn data:refresh:schools`. Normal builds and page traffic do not contact PASDA. Committing the measured 19.4 MiB artifact keeps deployment deterministic, portable, and free-tier compatible while preserving a reviewable upstream diff.

### Historical maps as committed immutable artifacts

M3 measured 53 processed historical payloads at 55,615,413 bytes total (53 MiB), with the largest individual asset below Cloudflare's 25 MiB static-asset limit. Committing content-hashed payloads plus source/output hashes keeps builds offline, portable, reviewable, and independent of an object-storage service or request-time GitHub access. Old hashes remain available for deployment rollback until no active deployment references them.

### Workers Static Assets instead of Pages Functions

Cloudflare Pages rejected the required native rate-limit binding during the first preview attempt. Workers Static Assets provides the same free/unlimited direct asset path while allowing exact `run_worker_first` routing. Production checks then showed the native Rate Limiting binding was permissive enough not to enforce the required test threshold, so feedback now uses a strict SQLite Durable Object available within Workers Free allocations. This keeps all compute behind only `/api/feedback`; a live tail proved ordinary assets do not invoke Worker code.

### Sub-meter school coordinate publication

M4 measurements identified the PA school artifact as the dominant transfer bottleneck. Publishing coordinates to six decimal places retains sub-meter precision, source provenance, every coordinate pair/district/property, and geometry validation while reducing the artifact 41% raw and approximately 64% Brotli. Geometry simplification remains rejected until topology and visual acceptance tests justify changing source shapes.

### Five-decimal historical coordinate publication

Observed: the 53 historical payloads carried ~15-significant-digit coordinates (55,615,413 bytes raw, ~14.2 MB Brotli), while the upstream borders are hand-drawn approximations with roughly kilometre-level accuracy. Decision: the historical pipeline publishes border, label, and place coordinates at five decimal places (~1.1 m), drops consecutive duplicate positions created by rounding, and keeps a ring's original coordinates only when rounding would collapse it below four positions (208 rings at the pinned commit). This reduced total payloads 33% raw and 49% Brotli, without removing features, names, colors, or source properties, and without changing the pinned source. Area and label placement still use source geometry, so zero-area anomaly reporting is unchanged. Five rather than six decimals (the school standard) is justified by the much coarser source accuracy. Geometry simplification remains rejected for the same reason as for school districts.

### Optional fingerprinting only after feedback intent

FingerprintJS is an abuse-control input for the optional feedback endpoint, not a prerequisite for map browsing. It is dynamically loaded only after a visitor opens feedback, reducing ordinary startup code/CPU and privacy surface without weakening the feedback rate limit.

## Deferred

### Domain cutover

The registrar is Squarespace Domains and authenticated DNS/Cloudflare-zone UI work is required before launch. The owner explicitly declined Vercel as a fallback; Cloudflare retains the verified M3 Worker version for application rollback, while Vercel remains disabled pending retirement after the seven-day review.
