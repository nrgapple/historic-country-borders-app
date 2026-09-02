# Feedback Worker setup

Feedback is the only dynamic application route. Cloudflare Pages serves the static app and invokes `functions/api/feedback.ts` only for exact path `/api/feedback`, as enforced by `public/_routes.json`.

## Security and failure behavior

The Function accepts JSON `POST` requests from the same origin, limits actual and declared bodies to 8 KiB, validates field types/lengths, applies the `FEEDBACK_RATE_LIMITER` platform binding, and bounds destination requests at five seconds. It returns `429` when limited and a non-secret `503` when configuration or destinations are unavailable. Responses use `Cache-Control: no-store`.

The accepted fields are rating (`nice`, `meh`, or `bad`), visitor ID, optional email/message, and bounded metadata. The browser remains usable if submission fails.

## Secrets

Configure at least one destination in Cloudflare Pages **Secrets**:

| Variable                         | Purpose                                               |
| -------------------------------- | ----------------------------------------------------- |
| `DISCORD_WEBHOOK_URL`            | Discord webhook destination                           |
| `AIRTABLE_PERSONAL_ACCESS_TOKEN` | Airtable token with `data.records:write` for one base |
| `AIRTABLE_BASE_ID`               | Airtable destination base                             |
| `AIRTABLE_TABLE_NAME`            | Optional table name; defaults to `Feedback`           |

Never prefix these with `NEXT_PUBLIC_`, put them in `.env.example`, commit them, or share them in chat. The public Mapbox and GA variables are unrelated build-time browser configuration.

## Discord

Create a webhook for the intended channel and store its URL as `DISCORD_WEBHOOK_URL`. See `DISCORD_SETUP.md` for provider-specific creation steps. The Function sends a compact embed containing rating, generated feedback ID, visitor ID, timestamp, and optional email/message.

## Airtable

Create a table (default `Feedback`) with these fields:

| Field         | Type                                       |
| ------------- | ------------------------------------------ |
| `Feedback ID` | Single line text                           |
| `Timestamp`   | Date/time                                  |
| `Email`       | Email                                      |
| `Message`     | Long text                                  |
| `Rating`      | Single select: `bad`, `meh`, `nice`        |
| `Visitor ID`  | Single line text                           |
| `Environment` | Single select: `Development`, `Production` |
| `Metadata`    | Long text                                  |

Create a Personal Access Token restricted to this base with `data.records:write`; store the token and base ID as Cloudflare secrets. Airtable's retired legacy API keys are not supported.

## Validation

```bash
yarn test tests/feedback-function.test.ts
yarn cloudflare:check
```

Local `yarn preview` intentionally returns a safe 503 because static preview has no Worker secrets. Account setup, preview submission, rate-limit/quota verification, and rollback steps are in `docs/CLOUDFLARE_DEPLOYMENT.md`.
