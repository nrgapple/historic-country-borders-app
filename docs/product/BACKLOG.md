# Product Backlog

## Scoring

Score each candidate from 1–5 for user impact and confidence, and 1–5 for effort and risk. Use the score as a discussion aid, not an automatic decision:

`priority = (impact × confidence) / (effort × risk)`

Every candidate needs evidence, a user problem, acceptance criteria, and a success signal before implementation.

## Active milestones

| Candidate                                       | User problem                                                           | Evidence                                                               | Impact | Confidence | Effort | Risk | Status                |
| ----------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | -----: | ---------: | -----: | ---: | --------------------- |
| Restore on static Cloudflare hosting            | Nobody can use the disabled production site                            | Local export is green; Cloudflare preview/account verification pending |      5 |          5 |      4 |    3 | M3 owner step pending |
| Repair PA school districts                      | Users cannot rely on the priority district experience                  | M2 replaced proxy/browser processing with a validated static asset     |      5 |          5 |      3 |    2 | Completed in M2       |
| Add CI/local/E2E harness                        | Regressions and deployment failures are discovered too late            | CI, static-export validation, and cross-browser journeys are enforced  |      5 |          5 |      3 |    1 | In progress           |
| Remove generated-information and cache services | Unwanted features add cost, secrets, dependencies, and compute surface | Owner decision and repository audit                                    |      4 |          5 |      3 |    2 | Completed in M1       |
| Static historical map artifacts                 | Ordinary exploration previously invoked runtime compute                | 53 validated content-hashed assets; border API removed                 |      5 |          5 |      4 |    3 | Completed in M3       |

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
