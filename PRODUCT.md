# Historic Borders Product

## Product promise

Make changes in political geography understandable through an interactive map that is fast, approachable, shareable, and honest about its sources and uncertainty.

## Primary audiences

1. Curious learners exploring a time or place.
2. Educators and students using a visual aid.
3. Researchers and map enthusiasts looking for source-linked historical context.
4. Pennsylvania residents exploring school-district boundaries.

## Jobs to be done

- “Show me what political borders looked like around a particular year.”
- “Help me move through time and notice meaningful changes.”
- “Tell me what a selected place is and where the information came from.”
- “Help me locate and understand a Pennsylvania school district.”
- “Let me share the exact map state I found.”

## Product principles

- **The map comes first:** interaction should become useful quickly.
- **Evidence over novelty:** prioritize observed user problems over speculative features.
- **Static and resilient:** useful browsing should not depend on paid request-time compute.
- **Source-visible:** identify the source, vintage, license, and limitations of map data.
- **Progressive enhancement:** core exploration should survive optional service failures.
- **Accessible by default:** keyboard, touch, readable labels, and clear error states matter.
- **No generative AI:** use source-backed Wikipedia information rather than generated prose.

## Current product priorities

1. Restore production availability without uncapped usage costs.
2. Make the Pennsylvania school-district map work reliably.
3. Establish trustworthy CI and critical-journey browser tests.
4. Reduce time, bandwidth, and compute required to display a map.
5. Improve school-district discovery and search based on evidence.

## Initial success signals

Technical and product baselines must be measured before targets are finalized:

- Availability and critical-journey success.
- Historical map load success and time to interactive map.
- School map load success and time to selectable districts.
- District selections per school-map visit.
- Historical years explored per visit.
- External-service and data-refresh failures.
- Actionable feedback themes.

## Scope boundaries

The app visualizes third-party historical and administrative data. It should not imply that disputed borders, approximate dates, or historical claims are definitive. Academic or legal use requires consulting the cited original sources.
