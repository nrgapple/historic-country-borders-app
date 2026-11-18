'use strict';

/**
 * PIAA high-school sports facts for the Pennsylvania school-district map.
 *
 * Two committed files, both reviewable in a diff:
 *
 * - `data/pa-sports-schools.json`: the source extract. One record per PIAA
 *   member school found in PIAA's public classification lists (`LIST_SPORTS`), read from that school's public directory page:
 *   PIAA district, school district, school type, grade 9–11 enrollment and
 *   football class/co-op. No contacts, names of people, phones or emails.
 * - `data/pa-sports.json`: the join to PASDA's 500 districts, keyed by the
 *   PASDA district `NAME` (unique, and the page's `?place=` key). Not by
 *   PASDA's `AUN_NUM`: it holds the AUN of the district's career-technical
 *   school (74 values for 500 districts; 15 are "NULL"), not the district's.
 *   It is derived deterministically from the extract, the PASDA artifact and
 *   `data/pa-sports-overrides.json`, so `yarn data:validate` re-derives it and
 *   fails on any drift.
 *
 * See docs/PA_SCHOOL_DISTRICTS.md ("High-school sports").
 */

const crypto = require('crypto');

const SCHEMA_VERSION = 1;
const PIAA_ORIGIN = 'https://www.piaa.org';
/** PIAA classification list ids (`classlist.aspx?sportID=`). */
const SPORT = { football: 10, boysBasketball: 3 };
/**
 * Class lists read to find every member high school, football or not: a
 * school with no football or boys' basketball (Shade, Turkeyfoot Valley)
 * still sponsors one of these.
 */
const LIST_SPORTS = [
  SPORT.football,
  SPORT.boysBasketball,
  4, // girls' basketball
  2, // baseball
  29, // softball
  7, // boys' cross country
  8, // girls' cross country
  34, // boys' track and field
];
const PIAA_DISTRICTS = 12;
const CLASS_NAMES = ['1A', '2A', '3A', '4A', '5A', '6A'];
const ROMAN = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];
/** Coverage floors: a refresh that matches fewer districts is rejected. */
const MIN_DISTRICTS_WITH_PIAA = 480;
const MIN_DISTRICTS_WITH_FOOTBALL = 440;

const fail = (message) => {
  throw new Error(`PA sports data: ${message}`);
};

const sha256 = (value) =>
  crypto.createHash('sha256').update(value).digest('hex');

/* ---- HTML parsing (PIAA's ASP.NET pages; stable element ids) ------------ */

const decode = (value) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "AAAAAA" → "6A"; "A" → "1A"; anything else → null. */
const classFromLetters = (letters) => {
  const value = String(letters ?? '').trim();
  if (!/^A{1,6}$/.test(value)) return null;
  return CLASS_NAMES[value.length - 1];
};

/** School ids listed on one `sportDistrict.aspx` page. */
const parseSportDistrictPage = (html) => {
  const caption = /<caption[^>]*>([\s\S]*?)<\/caption>/i.exec(html);
  const season = caption
    ? (/Classification Season:\s*([0-9]{2}\/[0-9]{2})/.exec(
        decode(caption[1]),
      ) ?? [])[1]
    : undefined;
  const ids = [
    ...html.matchAll(/\/schools\/directory\/details\.aspx\?ID=(\d+)/g),
  ].map((m) => Number(m[1]));
  return { season, ids: [...new Set(ids)] };
};

const span = (html, id) => {
  const match = new RegExp(
    `id="${id}"[^>]*>([\\s\\S]*?)<\\/(?:span|a)>`,
    'i',
  ).exec(html);
  return match ? decode(match[1]) : undefined;
};

const integer = (value) => {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

/**
 * One school's directory page → its facts. Contacts, addresses and phone
 * numbers on the page are deliberately not read.
 */
const parseSchoolPage = (html, id) => {
  const name = span(html, 'SchoolName');
  const district = /PIAA District (\d{1,2})/.exec(
    span(html, 'PIAADistrict') ?? '',
  );
  if (!name) fail(`school ${id}: no school name`);
  const enrollmentDate = span(html, 'EnrollmentDate');
  // The boys' table row for football: <a …sportID=10">Football</a> | class | co-op.
  const row =
    /sportID=10"[^>]*>\s*Football\s*<\/a>\s*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([\s\S]*?)<\/td>/i.exec(
      html,
    );
  return {
    id,
    name,
    piaaDistrict: district ? Number(district[1]) : null,
    schoolDistrict: span(html, 'SchoolDistrict') ?? null,
    type: span(html, 'SchoolType') ?? null,
    enrollmentSeason:
      (/\((\d{2}\/\d{2}) classification season\)/.exec(enrollmentDate ?? '') ??
        [])[1] ?? null,
    enrollmentDate:
      (/([A-Z][a-z]+ \d{1,2}, \d{4})/.exec(enrollmentDate ?? '') ?? [])[1] ??
      null,
    total: integer(span(html, 'EnrollmentTotal')) ?? null,
    boys: integer(span(html, 'EnrollmentMale')) ?? null,
    football: row ? classFromLetters(row[1]) : null,
    footballCoop: row ? /yes/i.test(decode(row[2])) : false,
  };
};

/* ---- Matching PIAA "School District" names to PASDA districts --------------- */

/** "Mt. Lebanon" / "Mount Lebanon SD" → "mt lebanon". */
const normalizeName = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bmount\b/g, 'mt')
    .replace(/\bsaint\b/g, 'st')
    .replace(/[.'’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(school district|sd)$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const LOOSE_WORDS = new Set([
  'area',
  'city',
  'school',
  'district',
  'sd',
  'township',
  'twp',
  'borough',
  'boro',
  'regional',
  'joint',
  'consolidated',
  'the',
  'of',
  'and',
]);
/** "Philadelphia City" → "philadelphia"; used only when unique. */
const looseKey = (value) =>
  normalizeName(value)
    .split(' ')
    .filter((word) => word && !LOOSE_WORDS.has(word))
    .join(' ');

/**
 * Builds a resolver from PASDA districts. Order: a reviewed override, then an
 * exact normalized name, then a loose key that names exactly one district.
 */
const createMatcher = (pasdaDistricts, overrides = {}) => {
  const exact = new Map();
  const loose = new Map();
  const names = new Set();
  for (const d of pasdaDistricts) {
    const district = String(d.NAME);
    names.add(district);
    for (const name of [d.SCHOOL_NAM, d.SCHOOL_DIS, d.NAME]) {
      if (!name) continue;
      exact.set(normalizeName(name), district);
      const key = looseKey(name);
      if (!key) continue;
      // A key two districts share is never used (null stays null).
      loose.set(
        key,
        loose.has(key) && loose.get(key) !== district ? null : district,
      );
    }
  }
  const byOverride = new Map(
    Object.entries(overrides).map(([name, district]) => [
      normalizeName(name),
      district,
    ]),
  );
  for (const [name, district] of byOverride)
    if (district !== null && !names.has(district))
      fail(`override "${name}" names unknown district ${district}`);
  return (schoolDistrict) => {
    const key = normalizeName(schoolDistrict);
    if (byOverride.has(key)) {
      const district = byOverride.get(key);
      return district === null
        ? { district: null, how: 'excluded' }
        : { district, how: 'override' };
    }
    if (exact.has(key)) return { district: exact.get(key), how: 'exact' };
    const l = loose.get(looseKey(schoolDistrict));
    if (l) return { district: l, how: 'loose' };
    return { district: null, how: 'unmatched' };
  };
};

/** Only public schools belong to a PASDA district. */
const isPublic = (school) => /^public\b/i.test(school.type ?? '');

const rankOf = (cls) => (cls ? CLASS_NAMES.indexOf(cls) + 1 : 0);

const byName = (a, b) => a.name.localeCompare(b.name, 'en');

/**
 * Joins the PIAA extract to PASDA districts. Every public school is either
 * matched to a district, deliberately excluded by an override, or reported as
 * unmatched; nothing is dropped silently.
 */
const buildSportsArtifact = ({ extract, pasdaDistricts, overrides = {} }) => {
  const match = createMatcher(pasdaDistricts, overrides);
  const grouped = new Map();
  const unmatched = [];
  const excluded = [];
  const methods = { exact: 0, loose: 0, override: 0 };
  let nonPublic = 0;
  for (const school of extract.schools) {
    if (!isPublic(school)) {
      nonPublic += 1;
      continue;
    }
    const { district, how } = match(school.schoolDistrict);
    if (how === 'excluded') {
      excluded.push({
        id: school.id,
        name: school.name,
        schoolDistrict: school.schoolDistrict,
      });
      continue;
    }
    if (!district) {
      unmatched.push({
        id: school.id,
        name: school.name,
        schoolDistrict: school.schoolDistrict,
      });
      continue;
    }
    methods[how] += 1;
    if (!grouped.has(district)) grouped.set(district, []);
    grouped.get(district).push(school);
  }

  const districts = {};
  for (const district of [...grouped.keys()].sort()) {
    const schools = grouped.get(district).slice().sort(byName);
    const piaaCounts = new Map();
    for (const s of schools)
      if (s.piaaDistrict)
        piaaCounts.set(
          s.piaaDistrict,
          (piaaCounts.get(s.piaaDistrict) ?? 0) + 1,
        );
    const piaa = [...piaaCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0]?.[0];
    const top = schools.reduce(
      (best, s) => (rankOf(s.football) > rankOf(best) ? s.football : best),
      null,
    );
    const sum = (key) =>
      schools.every((s) => Number.isInteger(s[key]))
        ? schools.reduce((n, s) => n + s[key], 0)
        : null;
    districts[district] = {
      piaa: piaa ?? null,
      ...(piaaCounts.size > 1
        ? { piaaAll: [...piaaCounts.keys()].sort((a, b) => a - b) }
        : {}),
      football: top,
      footballSchools: schools.filter((s) => s.football).length,
      enrollment: sum('total'),
      boys: sum('boys'),
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        football: s.football,
        ...(s.footballCoop ? { coop: true } : {}),
        total: s.total,
        boys: s.boys,
      })),
    };
  }

  const values = Object.values(districts);
  return {
    schemaVersion: SCHEMA_VERSION,
    source: extract.source,
    coverage: {
      pasdaDistricts: pasdaDistricts.length,
      districtsWithSchools: values.length,
      districtsWithPiaaDistrict: values.filter((d) => d.piaa).length,
      districtsWithFootball: values.filter((d) => d.football).length,
      multiSchoolDistricts: values.filter((d) => d.schools.length > 1).length,
      publicSchoolsMatched: methods.exact + methods.loose + methods.override,
      matchedBy: methods,
      nonPublicSchoolsSkipped: nonPublic,
      excluded: excluded.sort(byName),
      unmatched: unmatched.sort(byName),
    },
    districts,
  };
};

/* ---- Validation --------------------------------------------------------- */

const isClass = (v) => v === null || CLASS_NAMES.includes(v);
const isCount = (v) => v === null || (Number.isInteger(v) && v >= 0);

const validateExtract = (extract) => {
  if (!extract || extract.schemaVersion !== SCHEMA_VERSION)
    fail('extract schemaVersion mismatch');
  const s = extract.source;
  for (const key of [
    'publisher',
    'url',
    'season',
    'enrollmentDate',
    'retrievedAt',
    'terms',
  ])
    if (typeof s?.[key] !== 'string' || !s[key].trim())
      fail(`extract source.${key} is missing`);
  if (!Array.isArray(extract.schools) || extract.schools.length < 500)
    fail('extract lists too few schools');
  const ids = new Set();
  for (const school of extract.schools) {
    if (!Number.isInteger(school.id) || ids.has(school.id))
      fail(`bad or duplicate school id ${school.id}`);
    ids.add(school.id);
    if (typeof school.name !== 'string' || !school.name.trim())
      fail(`school ${school.id} has no name`);
    if (
      school.piaaDistrict !== null &&
      !(
        Number.isInteger(school.piaaDistrict) &&
        school.piaaDistrict >= 1 &&
        school.piaaDistrict <= PIAA_DISTRICTS
      )
    )
      fail(`school ${school.id} has PIAA district ${school.piaaDistrict}`);
    if (!isClass(school.football))
      fail(`school ${school.id} has football class ${school.football}`);
    if (typeof school.footballCoop !== 'boolean')
      fail(`school ${school.id} has a non-boolean co-op flag`);
    if (!isCount(school.total) || !isCount(school.boys))
      fail(`school ${school.id} has a malformed enrollment`);
    if (
      school.total !== null &&
      school.boys !== null &&
      school.boys > school.total
    )
      fail(`school ${school.id} has more boys than students`);
  }
  return { schools: extract.schools.length };
};

const validateSportsArtifact = (artifact, pasdaDistricts) => {
  if (!artifact || artifact.schemaVersion !== SCHEMA_VERSION)
    fail('artifact schemaVersion mismatch');
  const names = new Set(pasdaDistricts.map((d) => String(d.NAME)));
  const entries = Object.entries(artifact.districts ?? {});
  for (const [district, d] of entries) {
    if (!names.has(district)) fail(`${district} is not a PASDA district`);
    if (
      d.piaa !== null &&
      !(Number.isInteger(d.piaa) && d.piaa >= 1 && d.piaa <= PIAA_DISTRICTS)
    )
      fail(`District ${district} has PIAA district ${d.piaa}`);
    if (!isClass(d.football))
      fail(`District ${district} has class ${d.football}`);
    if (!isCount(d.enrollment) || !isCount(d.boys))
      fail(`District ${district} has a malformed enrollment`);
    if (!Array.isArray(d.schools) || d.schools.length === 0)
      fail(`District ${district} lists no schools`);
    const top = d.schools.reduce(
      (best, s) => (rankOf(s.football) > rankOf(best) ? s.football : best),
      null,
    );
    if (top !== d.football)
      fail(
        `District ${district}: district class is not its largest school class`,
      );
    for (const s of d.schools) {
      if (!isClass(s.football))
        fail(`District ${district}: school class ${s.football}`);
      if (typeof s.name !== 'string' || !s.name)
        fail(`District ${district}: school name`);
    }
  }
  const withPiaa = entries.filter(([, d]) => d.piaa).length;
  const withFootball = entries.filter(([, d]) => d.football).length;
  if (withPiaa < MIN_DISTRICTS_WITH_PIAA)
    fail(
      `only ${withPiaa} districts have a PIAA district (floor ${MIN_DISTRICTS_WITH_PIAA})`,
    );
  if (withFootball < MIN_DISTRICTS_WITH_FOOTBALL)
    fail(
      `only ${withFootball} districts have a football class (floor ${MIN_DISTRICTS_WITH_FOOTBALL})`,
    );
  return {
    districts: entries.length,
    withPiaa,
    withFootball,
    unmatched: artifact.coverage?.unmatched?.length ?? 0,
  };
};

module.exports = {
  CLASS_NAMES,
  MIN_DISTRICTS_WITH_FOOTBALL,
  MIN_DISTRICTS_WITH_PIAA,
  PIAA_DISTRICTS,
  PIAA_ORIGIN,
  ROMAN,
  LIST_SPORTS,
  SCHEMA_VERSION,
  SPORT,
  buildSportsArtifact,
  classFromLetters,
  createMatcher,
  decode,
  isPublic,
  looseKey,
  normalizeName,
  parseSchoolPage,
  parseSportDistrictPage,
  sha256,
  validateExtract,
  validateSportsArtifact,
};
