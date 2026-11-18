/**
 * Fetches Wikidata facts for reconciled territories and publishes per-year
 * context files. Explicit, network-using maintenance step
 * (`yarn data:refresh:context`); never part of the build.
 *
 * 1. reads the reviewed mapping in data/historical-entities.json;
 * 2. fetches matched entities and the items their capital / head-of-state /
 *    head-of-government statements reference (50 ids per request, cached);
 * 3. writes the pinned snapshot data/historical-context-facts.json (revision
 *    and retrieval time per entity);
 * 4. builds public/data/context/<year>.<hash>.json from the snapshot and our
 *    own border payloads, and the bundled manifest data/historical-context.json.
 *
 * Flags: --refresh ignores the local response cache (use for a real update);
 * --offline rebuilds the published files from the committed snapshot only.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('./lib/wikidata-client');
const {
  buildContextFiles,
  contextFileName,
  loadYearSummaries,
  validateContextManifest,
  validateMapping,
  validateSnapshot,
  validateYearContext,
} = require('./lib/historical-context');
const {
  PROPERTY,
  englishLabel,
  itemValues,
  officeHolderClaims,
} = require('./lib/wikidata');

const ROOT = path.join(__dirname, '..');
const MAPPING = path.join(ROOT, 'data', 'historical-entities.json');
const SNAPSHOT = path.join(ROOT, 'data', 'historical-context-facts.json');
const MANIFEST = path.join(ROOT, 'data', 'historical-context.json');
const OUTPUT_DIRECTORY = path.join(ROOT, 'public', 'data', 'context');
const CACHE = path.join(ROOT, '.cache', 'wikidata');
const FACT_PROPERTIES = [
  PROPERTY.capital,
  PROPERTY.headOfState,
  PROPERTY.headOfGovernment,
  PROPERTY.headOfStateOffice,
  PROPERTY.inception,
  PROPERTY.dissolution,
  PROPERTY.startTime,
  PROPERTY.endTime,
];

const log = (message) => console.log(message);

function writeAtomically(destination, content) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, destination);
}

/** Keeps only what publication reads: rank, value, and time qualifiers. */
function compactSnak(snak) {
  const value = snak.datavalue?.value;
  const compact =
    value && typeof value === 'object'
      ? value.id
        ? { id: value.id }
        : { time: value.time, precision: value.precision }
      : undefined;
  return {
    snaktype: snak.snaktype,
    property: snak.property,
    ...(compact ? { datavalue: { value: compact } } : {}),
  };
}

function compactClaim(claim) {
  return {
    rank: claim.rank,
    mainsnak: compactSnak(claim.mainsnak),
    ...(claim.qualifiers
      ? {
          qualifiers: Object.fromEntries(
            Object.entries(claim.qualifiers).map(([key, snaks]) => [
              key,
              snaks.map(compactSnak),
            ]),
          ),
        }
      : {}),
  };
}

function compactEntity(entity) {
  const claims = {};
  FACT_PROPERTIES.forEach((property) => {
    const list = (entity.claims[property] || []).filter(
      (claim) => claim.rank !== 'deprecated',
    );
    if (!list.length) return;
    claims[property] = list.map(compactClaim);
  });
  return {
    id: entity.id,
    lastrevid: entity.lastrevid,
    retrievedAt: entity.retrievedAt,
    label: englishLabel(entity),
    sitelinks: entity.sitelinks,
    claims,
  };
}

async function fetchSnapshot(mapping, refresh) {
  const client = createClient({ cacheDirectory: CACHE, refresh, log });
  const records = Object.values(mapping.entities).filter(
    (record) => record.status === 'matched',
  );
  const qids = [...new Set(records.map((record) => record.qid))].sort();
  log(`Fetching ${qids.length} matched entities...`);
  const fetched = await client.entities(qids);

  const entities = {};
  qids.forEach((qid) => {
    const entity = fetched.get(qid);
    if (!entity) throw new Error(`Matched entity ${qid} is missing`);
    if (entity.id !== qid)
      throw new Error(
        `Matched entity ${qid} redirects to ${entity.id}; rerun yarn data:reconcile:context`,
      );
    entities[qid] = compactEntity(entity);
  });

  // Many historical items name their ruler only through the office held by
  // the head of state (P1906); its holders carry dated P39 statements.
  const officeIds = new Set();
  Object.values(entities).forEach((entity) =>
    itemValues(entity, PROPERTY.headOfStateOffice).forEach((id) =>
      officeIds.add(id),
    ),
  );
  log(`Finding holders of ${officeIds.size} head-of-state offices...`);
  const holderIdsByOffice = new Map();
  for (const office of [...officeIds].sort()) {
    holderIdsByOffice.set(office, await client.officeHolders(office));
  }
  const allHolderIds = [...new Set([...holderIdsByOffice.values()].flat())];
  log(`Fetching ${allHolderIds.length} office holders...`);
  const holderEntities = await client.entities(allHolderIds);
  const offices = {};
  holderIdsByOffice.forEach((holderIds, office) => {
    const holders = holderIds
      .map((id) => holderEntities.get(id))
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
    const claims = officeHolderClaims(office, holders).map(compactClaim);
    if (claims.length) offices[office] = claims;
  });

  const referencedIds = new Set(Object.keys(offices));
  Object.values(entities).forEach((entity) =>
    [PROPERTY.capital, PROPERTY.headOfState, PROPERTY.headOfGovernment].forEach(
      (property) =>
        itemValues(entity, property).forEach((id) => referencedIds.add(id)),
    ),
  );
  Object.values(offices).forEach((claims) =>
    claims.forEach((claim) =>
      referencedIds.add(claim.mainsnak.datavalue.value.id),
    ),
  );
  log(`Fetching ${referencedIds.size} referenced items...`);
  const referencedEntities = await client.entities([...referencedIds]);
  const referenced = {};
  [...referencedIds].sort().forEach((id) => {
    const entity = referencedEntities.get(id);
    if (!entity) return;
    const death = entity.claims?.[PROPERTY.dateOfDeath]?.find(
      (claim) => claim.rank !== 'deprecated' && claim.mainsnak.datavalue,
    );
    const value = death?.mainsnak.datavalue.value;
    // For capitals: founding date and dated "capital of" statements that
    // point at a published entity (see untimedCapitalPlausible).
    const claims = {};
    const founded = (entity.claims?.[PROPERTY.inception] || []).filter(
      (claim) => claim.rank !== 'deprecated',
    );
    const capitalOf = (entity.claims?.[PROPERTY.capitalOf] || []).filter(
      (claim) =>
        claim.rank !== 'deprecated' &&
        entities[claim.mainsnak.datavalue?.value?.id],
    );
    if (founded.length) claims[PROPERTY.inception] = founded.map(compactClaim);
    if (capitalOf.length)
      claims[PROPERTY.capitalOf] = capitalOf.map(compactClaim);
    referenced[id] = {
      label: englishLabel(entity),
      ...(value
        ? { died: { time: value.time, precision: value.precision } }
        : {}),
      ...(Object.keys(claims).length ? { claims } : {}),
    };
  });

  const retrievedAt = Object.values(entities)
    .map((entity) => entity.retrievedAt)
    .sort()
    .pop();
  log(`${client.requests} network requests`);
  return {
    schemaVersion: 1,
    source: {
      name: 'Wikidata',
      api: 'https://www.wikidata.org/w/api.php',
      license: 'CC0-1.0',
    },
    retrievedAt,
    entities,
    offices,
    referenced,
  };
}

async function main() {
  const offline = process.argv.includes('--offline');
  const refresh = process.argv.includes('--refresh');
  const summaries = loadYearSummaries(ROOT);
  const names = new Set();
  summaries.forEach((summary) => summary.forEach((_, name) => names.add(name)));
  const mapping = validateMapping(
    JSON.parse(fs.readFileSync(MAPPING, 'utf8')),
    [...names],
  );

  const snapshot = offline
    ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))
    : await fetchSnapshot(mapping, refresh);
  validateSnapshot(snapshot, mapping);
  if (!offline) writeAtomically(SNAPSHOT, `${JSON.stringify(snapshot)}\n`);

  const files = buildContextFiles(summaries, mapping, snapshot);
  const years = {};
  files.forEach(({ year, json }) => {
    validateYearContext(JSON.parse(json), year);
    const fileName = contextFileName(year, json);
    writeAtomically(path.join(OUTPUT_DIRECTORY, fileName), json);
    years[String(year)] = `/data/context/${fileName}`;
  });
  const manifest = validateContextManifest({ schemaVersion: 1, years }, [
    ...summaries.keys(),
  ]);
  writeAtomically(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  const published = new Set(
    Object.values(years).map((url) => path.basename(url)),
  );
  fs.readdirSync(OUTPUT_DIRECTORY)
    .filter((file) => file.endsWith('.json') && !published.has(file))
    .forEach((file) => fs.unlinkSync(path.join(OUTPUT_DIRECTORY, file)));

  const sizes = files.map(({ json }) => Buffer.byteLength(json));
  log(
    `Published ${files.length} context files (${(sizes.reduce((a, b) => a + b, 0) / 1024).toFixed(1)} KiB total, ${(Math.max(...sizes) / 1024).toFixed(1)} KiB largest)`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
