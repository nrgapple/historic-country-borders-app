# Product Backlog

## Scoring

Score each candidate from 1–5 for user impact and confidence, and 1–5 for effort and risk. Use the score as a discussion aid, not an automatic decision:

`priority = (impact × confidence) / (effort × risk)`

Every candidate needs evidence, a user problem, acceptance criteria, and a success signal before implementation.

## Active milestones

| Candidate                            | User problem                                                           | Evidence                                                           | Impact | Confidence | Effort | Risk | Status                |
| ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | -----: | ---------: | -----: | ---: | --------------------- |
| Restore on static Cloudflare hosting | Nobody can use the disabled production site                            | Production HTTP 402                                                |      5 |          5 |      4 |    3 | Approved              |
| Repair PA school districts           | Users cannot rely on the priority district experience                  | Production disabled; architecture proxies/processes a 21 MB source |      5 |          4 |      3 |    3 | Approved              |
| Add CI/local/E2E harness             | Regressions and deployment failures are discovered too late            | No CI or browser suite; current test/build failures                |      5 |          5 |      3 |    1 | In progress           |
| Remove Gemini/AI/Redis               | Unwanted features add cost, secrets, dependencies, and compute surface | Owner decision and repository audit                                |      4 |          5 |      3 |    2 | Approved              |
| Static historical map artifacts      | Ordinary exploration currently invokes runtime compute                 | `/api/borders/...` on every uncached data request                  |      5 |          5 |      4 |    3 | Approved architecture |

## Discovery candidates

| Candidate                        | Hypothesized user problem                               | Evidence needed                    | Status    |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------- | --------- |
| District search                  | Finding one of roughly 500 districts by panning is slow | Search intent, feedback, task test | Discovery |
| Direct-linked district selection | Users cannot reliably share a selected district         | URL/state audit and user feedback  | Discovery |
| School-map navigation entry      | Users may not discover the district feature             | Navigation audit and page traffic  | Discovery |
| Better source/vintage display    | Users may mistake approximate or old data for authority | Content audit and feedback         | Discovery |
| Improved share previews          | Shared year links may not explain the map state well    | Current Open Graph preview audit   | Discovery |

## Rejected or deferred

- New generative-AI features: rejected by product constraint.
- Broad visual redesign: deferred until availability, school districts, and performance are stable.
