# Historical context (Wikidata facts and "What changed")

When a student selects a territory, the place panel adds a few source-linked facts valid in the map's year: **capital**, **head of state**, **head of government**, and when the polity **existed**. When nothing is selected, a collapsed "What changed since <previous year>" summary lists territories that appear, disappear, or change overlord compared with the previous published map.

Everything is static. Facts come from an explicit, reviewed refresh; ordinary builds, page views, and crawlers never contact Wikidata.

## Files

| File                                    | Committed | Bundled | Purpose                                                                                                                 |
| --------------------------------------- | --------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `data/historical-entities.json`         | yes       | no      | Reviewable NAME → QID mapping with status, evidence, and candidates.                                                    |
| `data/historical-entity-overrides.json` | yes       | no      | Manually reviewed decisions that replace the automatic match for a name.                                                |
| `data/historical-context-facts.json`    | yes       | no      | Pinned facts snapshot: per entity revision ID (`lastrevid`), retrieval time, and the trimmed claims publication reads.  |
| `data/historical-context.json`          | yes       | yes     | Year → `/data/context/<year>.<hash>.json` manifest (about 3 KB).                                                        |
| `public/data/context/*.json`            | yes       | no      | One immutable file per published year: facts valid in that year keyed by NAME, plus `changes` versus the previous year. |
| `public/data/context/*.capitals.*.json` | yes       | no      | One immutable file per year of capital points `{ name, t, qid }` for the remaster map (see Capital points).             |
| `data/historical-capitals.json`         | yes       | no      | Capitals manifest: URL, hash, bytes and counts per year, and every rejected capital with its reason.                    |
| `.cache/wikidata/`                      | no        | no      | Gitignored raw-response cache (trimmed entities, searches, Wikipedia title lookups) so reruns are cheap.                |

## Commands

```bash
yarn data:reconcile:context            # network: NAME → QID mapping (slow, cached)
yarn data:refresh:context              # network: facts snapshot + per-year files (cached)
yarn data:refresh:context --refresh    # same, ignoring the cache (a real update)
yarn data:refresh:context --offline    # rebuild published files from the committed snapshot
yarn data:refresh:context --coordinates # network: add capital coordinates (P625) to the committed snapshot only
yarn data:validate:context             # offline; part of yarn data:validate
```

Both network steps send `User-Agent: HistoricBordersContextRefresh/1.0 (https://historicborders.app; …)`, make one request at a time with a minimum interval of 500 ms, use `maxlag=5`, retry on 429/5xx/`maxlag`/search-busy responses with backoff and `Retry-After`, bound response size, and batch `wbgetentities` and Wikipedia title lookups at 50 IDs per request.

## Reconciliation method

Observed: the 53 published years contain 3,013 distinct territory NAMEs (3,025 before the 2026-11-18 name corrections in `docs/HISTORICAL_DATA.md` "Reviewed name overrides"). Many are peoples or ways of life ("Khoiasan", "Plain bison hunters"), not states.

For each NAME, ordered by total area so review effort lands on the largest territories first:

1. **Candidates.** The English Wikipedia article with exactly that title (redirects resolved, so "Great Khanate" → Yuan dynasty) and the top seven `wbsearchentities` results.
2. **Name check.** A candidate needs an exact English label or alias (case, accents, punctuation, and a leading "the" ignored), or the Wikipedia title/redirect. Prefix-only search hits ("Egypt Eyalet" for "Egypt") are rejected.
3. **Type check.** Some P31 class must reach, through P279\*, one of: state, historical country, country, empire, kingdom, polity, khanate, chiefdom, colony, protectorate, dependent territory. An instance of ethnic group, tribe, archaeological culture, disambiguation page, or list is rejected even if another class qualifies.
4. **Time check.** The candidate's lifespan, from inception (P571, else P580) to dissolution (P576, else P582), must contain at least one published year in which the NAME appears. It need not cover them all: a name can stand for successive polities ("Egypt" from 4000 BC to 2010). Publication shows facts only for years inside the lifespan, so an earlier year never borrows a successor state's facts.
5. **Decision.**
   - `matched`: exactly one candidate passes; an undated candidate also needs an exact Wikipedia title and label. When several pass, a match needs exactly one with an exact Wikipedia title and label.
   - `ambiguous`: candidates pass but none is decisive; all are listed for review.
   - `none`: nothing passes; up to two rejected exact-name candidates are recorded with reasons.
6. **Overrides.** `data/historical-entity-overrides.json` holds reviewed decisions (`qid` or `null`, with a reason). They are applied last, recorded as `reviewed: …` evidence, and checked by validation.

A NAME maps to one item across all its years. When the item is a successor state, earlier years of that NAME simply have no facts. An unmatched name is better than a wrong match.

Cliopatria v0.2.1 (CC BY 4.0, with Wikidata QIDs) was considered as a matching aid but is not used yet. Its 46 MB release would add a third-party license to review for a modest gain over title + type + date checks.

### Coverage at the committed mapping

Observed at the 2026-11-17 refresh, updated for the 2026-11-18 name corrections (reconciled from the cache; only the Kingdom of Italy, Q172579, was added to the pinned snapshot):

| Measure                                                        | Value                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Names matched / ambiguous / none                               | 505 / 31 / 2,477 of 3,013 (16.8% matched)                                              |
| Matched, weighted by occurrences (name × year)                 | 28.0% of 9,916                                                                         |
| Matched, weighted by border area                               | 37.4%                                                                                  |
| Name-years with at least one published fact                    | 1,924 (19.4%)                                                                          |
| Published name-years with capital / head of state / government | 1,600 / 932 / 237                                                                      |
| Context files                                                  | 53 files, 494 KiB total, 46 KiB largest, 5 KiB median                                  |
| Reviewed overrides                                             | 7 (Venice, England corrected; Eora, Arabia, Pergamon, Persia, Bulgar Khanate rejected) |

Most unmatched names are peoples, cultures, and ways of life ("Khoiasan", "Plain bison hunters"), which have no state facts. Name-year coverage is lower than match coverage because facts are published only inside each entity's lifespan. For example, "Egypt" maps to the modern state and gets facts only from 1922.

## Facts and validity

Publication reads only P36 (capital), P35 (head of state), P6 (head of government), P1906 (office held by head of state) with its holders' P39 (position held) statements, P571/P576 (inception/dissolution, falling back to P580/P582), their P580/P582 qualifiers, English labels of referenced items, P570 (date of death) of referenced people, P571 and P1376 (capital of) of referenced capitals, and the English Wikipedia sitelink.

- **Rank.** Deprecated statements are dropped. Among statements valid in the year, preferred beats normal. Rank is applied after the time filter, because preferred often marks only the current value.
- **Validity window.** A statement is used only when it is definitely valid throughout the year: on or after the latest reading of its start and on or before the earliest reading of its end. A repeated, malformed, "unknown value", or coarser-than-millennium bound makes the statement unusable. "No value" for an end means the term is ongoing.
- **Capitals.** If no time-qualified capital covers the year, a single best-rank capital without time qualifiers may be used, for example a capital that never moved. An undated capital usually records the present-day one, so Hungary → Budapest must not appear in 1200. It is therefore used only:
  - from 1800 for an entity with no dissolution date;
  - never before the capital itself was founded (its P571); and
  - when the capital's own "capital of" (P1376) statements for that entity carry dates, only within one of them (Rabat is Morocco's capital from 1912).
- **Ruler by office.** Many historical items, the Ottoman Empire among them, have no P35 statement but name the office of their head of state (P1906, "Sultan of the Ottoman Empire"). When no P35 statement covers the year, the holders of that office are found with a bounded `haswbstatement:P39=<office>` search (at most 1,000 per office), their entity JSON is fetched like any other, and their dated P39 statements for that office go through the same rank and validity rules. The fact then links to the office item. The snapshot stores these holder statements under `offices`.
- **People.** Head-of-state and head-of-government statements need a start. An open-ended term ends at the holder's death, or after 60 years if no death date is known. At most three values are published per fact. When more than three are valid, for example the seven-member Swiss Federal Council, the fact is omitted rather than shown incomplete.
- **Lifespan.** No facts are published for a year outside the entity's known inception–dissolution range. This protects names matched to a successor state from showing that state's facts in an earlier year.

### Dates and BC years

The Wikibase JSON API writes signed years with historical numbering: `-0044` is 44 BC and `-0001` is 1 BC, with no year 0. That is the app's encoding, so JSON years pass through unchanged, and a JSON year 0 at year precision is rejected as malformed. Wikidata's RDF/SPARQL output uses XSD 1.1 astronomical numbering instead (0 = 1 BC); `astronomicalToAppYear` handles that conversion if a SPARQL source is added. Both are covered by unit tests.

Precision is respected: decade, century, and millennium values become ranges covering every reasonable reading. For example, "1300 at century precision" covers both the 13th century and the 1300s (1201–1399). Such values are shown with "c.". Julian and Gregorian calendar models are treated alike at year resolution. This can misdate only day-precision values within about two weeks of 1 January.

## Published file format

```json
{
  "schemaVersion": 1,
  "year": 1492,
  "source": { "name": "Wikidata", "license": "CC0-1.0", "retrievedAt": "…" },
  "places": {
    "Ottoman Empire": {
      "qid": "Q12560",
      "existed": { "start": 1299, "end": 1922 },
      "capital": [
        {
          "qid": "Q16869",
          "label": "Constantinople",
          "start": 1453,
          "end": 1922
        }
      ],
      "wikipedia": "Ottoman Empire"
    }
  },
  "changes": {
    "previousYear": 1400,
    "appeared": ["…"],
    "disappeared": ["…"],
    "changed": [{ "name": "…", "field": "subjectTo", "from": "…", "to": null }]
  }
}
```

`changes` is `null` for the earliest year. It is computed only from our border payloads:

- names are compared by reconciled QID when matched, otherwise after light normalization. A source rename ("United States of America" → "United States") or a respelling ("Saharan Pastoral Nomads" → "Saharan pastoral nomads") is therefore not reported as a change;
- lists are sorted by area, largest first;
- `changed` records a different `SUBJECTO` (or, failing that, `PARTOF`) on the largest feature of a name present in both years.

The UI states that differences can come from the source maps as well as from history.

Validation (`yarn data:validate:context`) checks the mapping against the published territory names, the snapshot's pinned revisions and retrieval times, and that every override is applied. It then rebuilds every year file and every capitals file from the committed snapshot, payloads and split year files and requires byte-for-byte equality with the published files and manifests. `yarn size:check` budgets the context files at 96 KiB for the largest and 2 MiB in total.

## Capital points

The remaster map marks each territory's capital. Positions come from Wikidata **coordinate location (P625)** of the capital items the facts already name.

**Fetching.** The snapshot's `referenced` entry for every capital item (any P36 value of a snapshot entity) carries either `coordinates: [lon, lat]` or `coordinateIssue`, plus `coordinateRevision`, the item revision read. The full refresh fills these. `--coordinates` adds them to the committed snapshot and leaves every other pinned fact alone. Both use the same cache, batching and politeness rules as the rest of the refresh. At the 2026-11-18 run, 555 capital items took 12 requests.

**Choosing one point.** Deprecated statements, non-Earth globes and out-of-range values are ignored, and preferred rank beats normal. Wikidata often records a city twice at slightly different points. If every best-rank point lies within 10 km of the first, the first statement's point is used. Otherwise the capital is `ambiguous`; with no usable value it is `missing`. Coordinates are rounded to five decimals.

**Publication.** `<year>.capitals.<hash>.json` is a FeatureCollection of points:

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [28.97602, 41.01224] },
  "properties": { "name": "Constantinople", "t": 1306, "qid": "Q16869" }
}
```

`name` is the capital's English label, `t` is the territory id in that year's split index (`docs/HISTORICAL_DATA.md`), and `qid` is the capital item.

A point is published only when:

- the capital is in that year's context file, so it passed the validity, rank and untimed-capital rules above; and
- the point lies inside the territory's polygons, or within **50 km** of their border. Distance is measured on an equirectangular projection centred on the point, accurate to well under 1% at that scale.

Everything else goes to `rejected` in `data/historical-capitals.json` with a reason: `outside territory` (with `distanceKm`), `coordinates missing`, `coordinates ambiguous`, `coordinates not fetched`, `territory not in the split index`, or `capital has no label`.

Observed at the committed snapshot: 1,587 capital points across the 53 years (1492: 14, 1815: 47, 1914: 63) and 39 rejections. 34 were outside their territory and 5 had no coordinates. The rejections are mostly a capital that moved or a map that differs from Wikidata. Bern, previously rejected 116 km from the 1994–2010 "Switzerland" sliver, is published since the name override moved the name to the real polygon (`docs/HISTORICAL_DATA.md` "Reviewed name overrides"). Examples:

- Constantinople lies 404 km from the Byzantine Empire of 1400.
- Hanseongbu's Wikidata point is 13,679 km from Coree.

The capitals files depend on split territory ids, so a historical refresh that changes names or ids needs `yarn data:refresh:context --offline`; validation fails until then. `yarn size:check` budgets the largest capitals file at 48 KiB (24 KiB observed).

## Attribution

Wikidata structured data is CC0. Attribution is not required, but the panel credits "Facts: Wikidata", and each fact links to the Wikidata statement it came from (`https://www.wikidata.org/wiki/<QID>#<property>`). The snapshot pins the revision of every entity, so a reviewer can open `https://www.wikidata.org/w/index.php?oldid=<lastrevid>` to see the exact statement set used.

## Refresh review

1. Run `yarn data:reconcile:context` and review the diff of `data/historical-entities.json`, especially new `matched` records among large or frequent names.
2. Record corrections in `data/historical-entity-overrides.json` and rerun reconciliation (cached, so it is fast).
3. Run `yarn data:refresh:context --refresh`, then `yarn data:validate:context`.
4. Spot-check several years, including BC and early-modern ones, in the panel.
5. Commit the mapping, overrides, snapshot, manifest, and new context files together.

A historical border refresh that changes names requires reconciliation again. Validation fails until the mapping matches the published names.

## Known limits

- Office holders are only as complete as their P39 statements: an undated holder, a regent recorded under another office, or a co-ruler may be missing, and shared offices (for example a king of a personal union) apply to every polity that names them. The lifespan and validity checks bound, but do not remove, this risk.
- Wikidata coverage is uneven across regions and eras, and items can conflict. Facts are a starting point for a lesson, not an authority. The panel keeps the border-source uncertainty notices.
