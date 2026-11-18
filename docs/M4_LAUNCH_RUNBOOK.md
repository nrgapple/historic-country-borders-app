# M4 production launch and rollback runbook

This runbook is for `historicborders.app`. Account, registrar, DNS, billing, secret, and production changes are owner-only. Never paste credentials into chat. Stop if any step offers a paid plan, automatic overage, destructive record replacement, or an unclear DNSSEC action.

## Known state before cutover

Observed on 2026-09-03 UTC:

- Cloudflare candidate: `https://historic-borders.champtoday.workers.dev`;
- last verified M3 rollback version: `c3144834-a22a-4b6c-8269-22147af6f9aa`;
- optimized candidate version: `6e87c859-f70d-458f-aec4-6f51c41bc4de`;
- production apex: Vercel `76.76.21.21`, TTL 3600, returning HTTP 402 `DEPLOYMENT_DISABLED`;
- `www.historicborders.app`: not resolving;
- delegation: Google-hosted nameservers, NS TTL 21600;
- DNSSEC: enabled with a parent DS record; and
- registrar: Squarespace Domains II LLC; authenticated registrar/DNS access is still required.

The owner explicitly declined Vercel as a fallback on 2026-09-03. Vercel remains disabled and outside the rollback plan. Cloudflare version rollback is the working application rollback; restoring the previous Google-hosted delegation would restore DNS records but no working web deployment. This provider-level limitation is accepted, and Vercel may be retired after the seven-day review.

## Roles and variables

Record these in the launch ticket, not in source:

- launch owner and rollback decision owner;
- registrar and current DNS console;
- Cloudflare account ID and confirmation that Workers is Free;
- assigned Cloudflare nameservers (`CF_NS_1`, `CF_NS_2`);
- candidate Worker version (`CANDIDATE_VERSION`);
- previous working Worker version (`PREVIOUS_VERSION`); and
- launch start, one-hour rollback deadline, 24-hour review, and seven-day review.

## Phase 1 — safe preparation

1. Export every current DNS record from the authoritative DNS provider. Capture names, types, values, priorities, TTLs, proxy state (if any), mail records, verification records, CAA, and redirects. Screenshot/export registrar nameserver and DNSSEC/DS settings.
2. Capture public evidence from at least two resolvers:

   ```bash
   dig +short NS historicborders.app @1.1.1.1
   dig +short NS historicborders.app @8.8.8.8
   dig +dnssec DS historicborders.app @1.1.1.1
   dig +noall +answer historicborders.app A
   dig +noall +answer www.historicborders.app A
   ```

3. Keep the disabled Vercel project unchanged through the seven-day review for record comparison only; do not route traffic to it or call it a fallback.
4. Add `historicborders.app` to the Cloudflare Free account. Import **all** existing records and compare them line-by-line with the export before changing delegation. Do not activate paid Workers, paid add-ons, automatic overage, or unrelated proxy features.
5. Follow the registrar and current DNS provider's documented DNSSEC migration sequence. Because a DS record exists, do not simply replace nameservers. Disable DNSSEC at the current provider/remove the parent DS at the registrar, then verify both resolvers return no DS:

   ```bash
   dig +short DS historicborders.app @1.1.1.1
   dig +short DS historicborders.app @8.8.8.8
   ```

   Both outputs must be empty before delegation changes. If the provider does not expose an exact supported sequence, stop.

6. Lower editable record TTLs to 300 at least one old-TTL period before the launch window. NS/DS caching may still follow registry TTLs; do not claim five-minute delegation rollback.
7. Build from the reviewed commit with Node 22 and Yarn Classic, without any data refresh:

   ```bash
   yarn install --frozen-lockfile
   yarn validate
   yarn cloudflare:deploy
   ```

   Record `CANDIDATE_VERSION`; do not alter or print secrets. Verify the candidate at its Worker preview URL with `BASE_URL=<https-url> yarn smoke:production` and `RUNS=3 BASE_URL=<https-url> yarn performance:measure`.

8. Restrict the public Mapbox token to required scopes and allowed URLs for `https://historicborders.app/*`, `https://www.historicborders.app/*`, and the retained candidate hostname. Configure Mapbox usage alerts without enabling paid automatic overage.

## Phase 2 — delegation and custom domain

1. At the registrar, replace only the existing nameservers with exactly `CF_NS_1` and `CF_NS_2`. Do not delete the old zone or Vercel project during the rollback window.
2. Verify Cloudflare reports the zone active and both public resolvers return only the assigned Cloudflare nameservers. Confirm mail and verification records still match the saved inventory.
3. In Workers & Pages → `historic-borders` → Settings → Domains & Routes, add the Worker Custom Domain `historicborders.app`. Use the Cloudflare-generated proxied DNS record; do not create a broad Worker route.
4. Add a proxied `www` DNS record and a Cloudflare Redirect Rule whose condition is exactly host `www.historicborders.app`, destination `https://historicborders.app${uri.path}` with query preserved, status 301. Do not redirect all hosts or paths through Worker code.
5. Wait for Universal SSL to become active. Verify hostname and certificate before traffic approval:

   ```bash
   dig +short historicborders.app @1.1.1.1
   dig +short historicborders.app @8.8.8.8
   curl -fsSIL https://historicborders.app/
   curl -fsSIL 'https://www.historicborders.app/year/1994?lng=0&lat=0&zoom=2'
   echo | openssl s_client -connect historicborders.app:443 -servername historicborders.app 2>/dev/null \
     | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
   ```

   `www` must redirect once to the apex while preserving path and query.

6. Run:

   ```bash
   BASE_URL=https://historicborders.app yarn smoke:production
   RUNS=3 BASE_URL=https://historicborders.app yarn performance:measure
   ```

   Also verify real country/district selection, timeline movement, keyboard/touch controls, direct Wikipedia, and safe feedback failure/success in Chromium. Run `wrangler tail` while requesting ordinary pages/data/404 and one feedback request: only `/api/feedback` and its internal Durable Object may appear.

7. Go only if TLS, AD/BC historical maps, school districts, crawler files, useful 404, static cache policy, feedback degradation, and zero ordinary Worker events all pass. Record response/error counts and version IDs.

## Rollback

Rollback immediately within the one-hour window for TLS/certificate failure, any failed critical journey, static traffic reaching Worker code, unexpected dynamic routes, broken Mapbox authorization, sustained 5xx, or lost non-web DNS records.

### Application/configuration rollback (preferred)

1. In Workers & Pages → `historic-borders` → Deployments, route traffic back to `PREVIOUS_VERSION` (initially the verified M3 version above).
2. Restore changed secrets separately; code-version rollback does not restore secrets.
3. Repeat static smoke, real-map, feedback degradation, and live-tail checks. Keep the custom domain and Cloudflare delegation in place.
4. Do not delete content-hashed assets referenced by either version.

### DNS/delegation rollback

Use only for broken Cloudflare delegation/zone/TLS, not an ordinary code regression.

1. Restore the saved previous nameservers at the registrar exactly.
2. Restore the saved parent DS/DNSSEC configuration only after the previous provider again serves the matching signed zone and according to that provider's supported sequence. A mismatched DS causes `SERVFAIL`.
3. Verify NS, DS, A/CNAME, mail records, TLS, and both resolvers. Run static smoke against the restored target.
4. Remember that old NS TTL was 21600 seconds; escalation/communication may be required for up to the cached delegation period.

Because Vercel is explicitly excluded, delegation rollback restores DNS records but no working web target. Prefer Cloudflare version rollback and never delete the Cloudflare Worker/version while DNS rollback is propagating.

## Free-tier, bot, and route acceptance

Before declaring launch complete, record non-secret screenshots/notes proving:

- Workers and Durable Objects are on Free with no paid subscription, add-on, or automatic overage;
- public dynamic routes = 1 (`POST /api/feedback`), internal Durable Object bindings = 1, Next API routes = 0, Pages Functions = 0;
- static requests produce no Worker tail events and only feedback carries `X-HistoricBorders-Compute`/`no-store`;
- usage notifications are assigned to an owner at available Free-plan thresholds;
- AI crawler controls match static `robots.txt` policy; and
- Bot Fight Mode remains off unless AD/BC maps, school data, Mapbox, direct Wikipedia, feedback, uptime checks, and legitimate crawlers all pass with it enabled.

After the custom domain is stable, set `workers_dev = false` and `preview_urls = false` in `wrangler.toml`, deploy and smoke-test again, unless the owner records a specific operational need for the alternate public hostname. Keep a separate non-production Worker if ongoing previews are needed; it must not have production feedback destinations.

## Monitoring and post-launch review

Enable `.github/workflows/uptime.yml`. It runs four times daily and makes seven small static GETs plus two static HEADs; it sends no feedback and consumes zero intended Worker requests. GitHub workflow notifications are the initial alert channel. A free external monitor may check only `/year/1994` and `/pa/school-districts`; record its owner and interval before enabling it.

At launch, 24 hours, and seven days, record in `docs/product/SCORECARD.md` and `docs/product/REVIEW.md`:

- uptime/smoke results and user-visible errors;
- Worker requests/CPU and Durable Object requests/storage/errors;
- static cache HIT/MISS behavior by route class;
- Mapbox errors/usage;
- feedback attempts, 429s, destination failures, and actionable themes; and
- rollback/retirement decision.

Keep Vercel disabled but undeleted through the seven-day review unless it is the verified rollback target. After a green seven-day review, document whether it is retained disabled or deleted; deletion requires owner approval. Re-enable Cloudflare DNSSEC only after stable delegation, using Cloudflare's generated DS details and registrar instructions, then verify `dig +dnssec` from both resolvers.
