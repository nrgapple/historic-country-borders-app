'use strict';

/**
 * Explicit refresh of the PIAA sports facts (docs/PA_SCHOOL_DISTRICTS.md,
 * "High-school sports"). Never part of a build.
 *
 *   yarn data:refresh:pa-sports            fetch PIAA (~850 pages), then join
 *   yarn data:refresh:pa-sports --join     re-join the committed extract only
 *                                          (after editing the overrides)
 *
 * Fetching is polite and sequential: PIAA's robots.txt allows /schools/; one
 * request at a time with a pause between them, an identifying User-Agent,
 * and only public classification and directory pages. Contacts on those
 * pages are never read or stored. Any failure leaves committed data as is.
 */

const fs = require('fs');
const path = require('path');
const {
  PIAA_DISTRICTS,
  PIAA_ORIGIN,
  SCHEMA_VERSION,
  LIST_SPORTS,
  buildSportsArtifact,
  parseSchoolPage,
  parseSportDistrictPage,
  validateExtract,
  validateSportsArtifact,
} = require('./lib/pa-sports');

const root = path.resolve(__dirname, '..');
const EXTRACT = path.join(root, 'data/pa-sports-schools.json');
const ARTIFACT = path.join(root, 'data/pa-sports.json');
const OVERRIDES = path.join(root, 'data/pa-sports-overrides.json');
const PASDA = path.join(root, 'public/data/pa-school-districts.json');

const USER_AGENT =
  'HistoricBordersDataRefresh/1.0 (+https://historicborders.app/pa/school-districts)';
const PAUSE_MS = 700;

const writeJsonAtomic = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 1)}\n`);
  fs.renameSync(temporaryPath, filePath);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchText = async (
  url,
  fetchImpl,
  { attempts = 3, pause = PAUSE_MS } = {},
) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(pause * 4 * attempt);
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError?.message}`);
};

const readPasda = () =>
  JSON.parse(fs.readFileSync(PASDA, 'utf8')).data.borders.features.map(
    (f) => f.properties,
  );
const readOverrides = () =>
  fs.existsSync(OVERRIDES)
    ? JSON.parse(fs.readFileSync(OVERRIDES, 'utf8')).schoolDistricts
    : {};

const crawl = async ({
  fetchImpl = fetch,
  pause = PAUSE_MS,
  log = console.log,
  now = new Date(),
} = {}) => {
  const ids = new Set();
  let season;
  for (const sportID of LIST_SPORTS) {
    for (let district = 1; district <= PIAA_DISTRICTS; district += 1) {
      const url = `${PIAA_ORIGIN}/schools/classifications/sportDistrict.aspx?sportID=${sportID}&district=${district}`;
      const page = parseSportDistrictPage(
        await fetchText(url, fetchImpl, { pause }),
      );
      if (!page.ids.length) throw new Error(`No schools listed at ${url}`);
      season ??= page.season;
      page.ids.forEach((id) => ids.add(id));
      await sleep(pause);
    }
  }
  log(`pa-sports: ${ids.size} schools listed; reading their directory pages`);
  const schools = [];
  for (const id of [...ids].sort((a, b) => a - b)) {
    const html = await fetchText(
      `${PIAA_ORIGIN}/schools/directory/details.aspx?ID=${id}`,
      fetchImpl,
      { pause },
    );
    schools.push(parseSchoolPage(html, id));
    if (schools.length % 100 === 0)
      log(`pa-sports: ${schools.length}/${ids.size}`);
    await sleep(pause);
  }
  const seasons = new Set(
    schools.map((s) => s.enrollmentSeason).filter(Boolean),
  );
  const dates = schools.map((s) => s.enrollmentDate).filter(Boolean);
  const [yy] = (season ?? [...seasons][0] ?? '').split('/');
  const first = 2000 + Number(yy);
  const extract = {
    schemaVersion: SCHEMA_VERSION,
    source: {
      publisher: 'Pennsylvania Interscholastic Athletic Association (PIAA)',
      url: `${PIAA_ORIGIN}/schools/classifications/default.aspx`,
      directoryUrl: `${PIAA_ORIGIN}/schools/directory/default.aspx`,
      season: `${first}-${String(first + 1).slice(2)} and ${first + 1}-${String(first + 2).slice(2)}`,
      classificationSeason: season ?? null,
      enrollmentDate: dates.length ? 'October 2025' : 'unknown',
      enrollmentBasis:
        'PIAA classification enrollment: students in grades 9–11 reported by each member school (boys for football).',
      retrievedAt: now.toISOString(),
      terms:
        'Facts (classification, PIAA district, enrollment) from PIAA’s public classification and school-directory pages. The site states “Copyright © PIAA. All Rights Reserved.” and publishes no terms of use; robots.txt allows /schools/. Only factual fields are stored, with attribution and a link to the source; no contacts are stored.',
    },
    schools,
  };
  // The enrollment date is a month PIAA set for every school.
  const months = new Set(dates.map((d) => d.replace(/ \d{1,2},/, '')));
  if (months.size === 1) extract.source.enrollmentDate = [...months][0];
  return extract;
};

const join = (extract) => {
  const pasda = readPasda();
  const artifact = buildSportsArtifact({
    extract,
    pasdaDistricts: pasda,
    overrides: readOverrides(),
  });
  return { artifact, report: validateSportsArtifact(artifact, pasda) };
};

const main = async () => {
  const joinOnly = process.argv.includes('--join');
  const extract = joinOnly
    ? JSON.parse(fs.readFileSync(EXTRACT, 'utf8'))
    : await crawl();
  validateExtract(extract);
  // The extract is the reviewed source record: kept even if the join below
  // fails its coverage floors, so overrides can be added with --join.
  if (!joinOnly) writeJsonAtomic(EXTRACT, extract);
  const { artifact, report } = join(extract);
  writeJsonAtomic(ARTIFACT, artifact);
  console.log(
    `pa-sports: ${report.districts} districts (${report.withFootball} with football, ${report.withPiaa} with a PIAA district); ${report.unmatched} public schools unmatched.`,
  );
  for (const s of artifact.coverage.unmatched)
    console.log(
      `  unmatched: ${s.name} (school district "${s.schoolDistrict}")`,
    );
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { crawl, join, fetchText };
