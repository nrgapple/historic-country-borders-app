/**
 * Maps every published territory NAME to a Wikidata item, conservatively.
 *
 * Explicit, network-using maintenance step (`yarn data:reconcile:context`);
 * never part of the build. Writes the reviewable `data/historical-entities.json`.
 * See docs/HISTORICAL_CONTEXT.md for the method.
 *
 * Flags: --refresh ignores the local response cache.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('./lib/wikidata-client');
const {
  collectTerritories,
  loadYearSummaries,
  validateMapping,
} = require('./lib/historical-context');
const {
  POLITY_ROOTS,
  PROPERTY,
  decide,
  evaluateCandidate,
  isQid,
  itemValues,
} = require('./lib/wikidata');

const ROOT = path.join(__dirname, '..');
const OUTPUT = path.join(ROOT, 'data', 'historical-entities.json');
const OVERRIDES = path.join(ROOT, 'data', 'historical-entity-overrides.json');
const CACHE = path.join(ROOT, '.cache', 'wikidata');
const MAX_CLASS_DEPTH = 12;

const log = (message) => console.log(message);

function readOverrides() {
  const file = JSON.parse(fs.readFileSync(OVERRIDES, 'utf8'));
  if (file.schemaVersion !== 1 || !Array.isArray(file.overrides))
    throw new Error('Entity overrides have an unsupported schema');
  const overrides = new Map();
  file.overrides.forEach((override, index) => {
    if (
      typeof override.name !== 'string' ||
      (override.qid !== null && !isQid(override.qid)) ||
      typeof override.reason !== 'string' ||
      !override.reason.trim()
    )
      throw new Error(`Entity override ${index} is invalid`);
    if (overrides.has(override.name))
      throw new Error(`Entity override for ${override.name} is duplicated`);
    overrides.set(override.name, override);
  });
  return overrides;
}

/** Fetches P31 classes and their P279 ancestors breadth-first. */
async function loadClasses(client, entities) {
  const classes = {};
  let frontier = new Set();
  entities.forEach((entity) =>
    itemValues(entity, PROPERTY.instanceOf).forEach((id) => frontier.add(id)),
  );
  for (let depth = 0; depth < MAX_CLASS_DEPTH && frontier.size; depth += 1) {
    const ids = [...frontier].filter((id) => !(id in classes));
    log(`Class depth ${depth}: ${ids.length} classes`);
    const fetched = await client.entities(ids, { minTrimVersion: 1 });
    frontier = new Set();
    ids.forEach((id) => {
      const entity = fetched.get(id);
      classes[id] = entity;
      itemValues(entity, PROPERTY.subclassOf).forEach((parent) => {
        if (!(parent in classes) && !POLITY_ROOTS[parent]) frontier.add(parent);
      });
    });
  }
  return classes;
}

const percent = (part, whole) =>
  whole ? `${((100 * part) / whole).toFixed(1)}%` : 'n/a';

async function main() {
  const refresh = process.argv.includes('--refresh');
  const client = createClient({ cacheDirectory: CACHE, refresh, log });
  const overrides = readOverrides();

  log('Summarising published historical payloads...');
  const territories = collectTerritories(loadYearSummaries(ROOT));
  // Largest and most frequent first, so review effort lands where it matters.
  const names = [...territories.keys()].sort(
    (a, b) =>
      territories.get(b).area - territories.get(a).area ||
      territories.get(b).years.length - territories.get(a).years.length ||
      a.localeCompare(b),
  );
  log(`${names.length} distinct territory names`);

  log('Looking up English Wikipedia titles...');
  const titles = await client.wikipediaItems(names);

  log('Searching Wikidata...');
  const searchResults = new Map();
  for (let index = 0; index < names.length; index += 1) {
    if (index % 250 === 0) log(`  search ${index}/${names.length}`);
    searchResults.set(names[index], await client.search(names[index]));
  }

  const candidateIds = new Set();
  names.forEach((name) => {
    if (titles.get(name)) candidateIds.add(titles.get(name).qid);
    searchResults.get(name).forEach((id) => candidateIds.add(id));
  });
  overrides.forEach(({ qid }) => qid && candidateIds.add(qid));
  log(`Fetching ${candidateIds.size} candidate entities...`);
  const candidates = await client.entities([...candidateIds], {
    minTrimVersion: 1,
  });
  const classes = await loadClasses(
    client,
    [...candidates.values()].filter(Boolean),
  );

  const entities = {};
  const tally = { matched: 0, ambiguous: 0, none: 0 };
  const weights = {
    occurrences: { matched: 0, total: 0 },
    area: { matched: 0, total: 0 },
  };
  [...names].sort().forEach((name) => {
    const territory = territories.get(name);
    const appearance = {
      first: territory.years[0],
      last: territory.years[territory.years.length - 1],
      years: territory.years,
    };
    const title = titles.get(name);
    const ids = [
      ...new Set([...(title ? [title.qid] : []), ...searchResults.get(name)]),
    ];
    // A Wikidata redirect resolves to its target; evaluate each item once.
    const seen = new Set();
    const evaluations = ids
      .map((id) => ({ id, entity: candidates.get(id) }))
      .filter(
        ({ entity }) => entity && !seen.has(entity.id) && seen.add(entity.id),
      )
      .map(({ id, entity }) =>
        evaluateCandidate(
          entity,
          name,
          appearance,
          classes,
          title?.qid === id ? title.match : null,
        ),
      );

    const override = overrides.get(name);
    let record;
    if (override) {
      const evaluation =
        override.qid &&
        evaluateCandidate(
          candidates.get(override.qid),
          name,
          appearance,
          classes,
          null,
        );
      record = override.qid
        ? {
            status: 'matched',
            qid: candidates.get(override.qid).id,
            label: evaluation.label,
            evidence: [`reviewed: ${override.reason}`, ...evaluation.evidence],
            ...(evaluation.reasons.length
              ? { warnings: evaluation.reasons }
              : {}),
          }
        : {
            status: 'none',
            qid: null,
            evidence: [`reviewed: ${override.reason}`],
          };
    } else {
      const decision = decide(evaluations);
      if (decision.status === 'matched') {
        record = {
          status: 'matched',
          qid: decision.qid,
          label: decision.chosen.label,
          evidence: decision.chosen.evidence,
        };
      } else if (decision.status === 'ambiguous') {
        record = {
          status: 'ambiguous',
          qid: null,
          evidence: [decision.reason],
          candidates: decision.candidates,
        };
      } else {
        const rejected = evaluations.filter(
          (evaluation) => evaluation.nameMatch || evaluation.titleMatch,
        );
        record = {
          status: 'none',
          qid: null,
          evidence: rejected.length
            ? rejected
                .slice(0, 2)
                .map(
                  (evaluation) =>
                    `rejected ${evaluation.qid} (${evaluation.label}): ${evaluation.reasons.join('; ')}`,
                )
            : ['no candidate with this exact name or Wikipedia title'],
        };
      }
    }
    entities[name] = {
      ...record,
      years: [appearance.first, appearance.last],
      occurrences: territory.years.length,
    };
    tally[record.status] += 1;
    weights.occurrences.total += territory.years.length;
    weights.area.total += territory.area;
    if (record.status === 'matched') {
      weights.occurrences.matched += territory.years.length;
      weights.area.matched += territory.area;
    }
  });

  const unusedOverrides = [...overrides.keys()].filter(
    (name) => !territories.has(name),
  );
  if (unusedOverrides.length)
    throw new Error(
      `Overrides name unknown territories: ${unusedOverrides.join(', ')}`,
    );

  const mapping = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    method:
      'Wikidata search and English Wikipedia titles, then type (P31/P279* to a polity class) and inception/dissolution checks; see docs/HISTORICAL_CONTEXT.md',
    summary: {
      names: names.length,
      ...tally,
      coverage: {
        names: percent(tally.matched, names.length),
        occurrences: percent(
          weights.occurrences.matched,
          weights.occurrences.total,
        ),
        area: percent(weights.area.matched, weights.area.total),
      },
    },
    entities,
  };
  validateMapping(mapping, names);
  // Prettier-formatted so `yarn format:check` and review diffs stay stable.
  const prettier = require('prettier');
  fs.writeFileSync(
    OUTPUT,
    await prettier.format(JSON.stringify(mapping), { filepath: OUTPUT }),
  );
  log(
    `Matched ${tally.matched}, ambiguous ${tally.ambiguous}, none ${tally.none}`,
  );
  log(`Coverage: ${JSON.stringify(mapping.summary.coverage)}`);
  log(`${client.requests} network requests; wrote ${OUTPUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
