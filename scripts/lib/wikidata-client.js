/**
 * Polite, cached access to the Wikidata and English Wikipedia APIs for the
 * explicit context refresh. Never used by the build or the browser.
 *
 * - one request at a time with a minimum interval, `maxlag`, and retries that
 *   honour Retry-After;
 * - a descriptive User-Agent naming the project;
 * - bounded response size and timeouts; and
 * - a gitignored on-disk cache (`.cache/wikidata/`) so reruns are cheap.
 *   Entities are cached individually (trimmed to the properties this pipeline
 *   reads) with their retrieval time; searches are cached by request URL.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TRIM_VERSION, isQid, trimEntity } = require('./wikidata');

const USER_AGENT =
  'HistoricBordersContextRefresh/1.0 (https://historicborders.app; explicit offline data refresh)';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const ENWIKI_API = 'https://en.wikipedia.org/w/api.php';
const MAX_RESPONSE_BYTES = 40 * 1024 * 1024;
const BATCH_SIZE = 50;
const RETRYABLE_ERRORS = new Set([
  'maxlag',
  'ratelimited',
  'cirrussearch-too-busy-error',
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value) =>
  crypto.createHash('sha256').update(value).digest('hex').slice(0, 32);

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value));
  fs.renameSync(temporary, file);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function createClient({
  cacheDirectory,
  minIntervalMs = 500,
  refresh = false,
  log = () => {},
}) {
  let last = 0;
  let requests = 0;

  async function request(base, params) {
    const url = `${base}?${new URLSearchParams({
      format: 'json',
      formatversion: '2',
      maxlag: '5',
      ...params,
    })}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const wait = last + minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      requests += 1;
      let response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        log(`network error (${error.message}); retrying`);
        await sleep(2000 * 2 ** attempt);
        continue;
      }
      const retryAfter = Number(response.headers.get('retry-after')) || 0;
      if (response.status === 429 || response.status >= 500) {
        log(`HTTP ${response.status}; retrying`);
        await sleep(Math.max(retryAfter * 1000, 2000 * 2 ** attempt));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES)
        throw new Error(`Response too large for ${url}`);
      const body = JSON.parse(text);
      if (RETRYABLE_ERRORS.has(body.error?.code)) {
        log(`${body.error.code}; waiting`);
        await sleep(Math.max(retryAfter * 1000, 5000 * 2 ** attempt));
        continue;
      }
      if (body.error)
        throw new Error(`${body.error.code}: ${body.error.info} (${url})`);
      return body;
    }
    throw new Error(`Gave up after retries: ${url}`);
  }

  async function cachedRequest(kind, base, params) {
    const key = JSON.stringify([base, params]);
    const file = path.join(cacheDirectory, kind, `${hash(key)}.json`);
    const cached = !refresh && readJson(file);
    if (cached && cached.key === key) return cached.body;
    const body = await request(base, params);
    writeJson(file, { key, retrievedAt: new Date().toISOString(), body });
    return body;
  }

  /** wbsearchentities for one English name. */
  async function search(name, limit = 7) {
    const body = await cachedRequest('search', WIKIDATA_API, {
      action: 'wbsearchentities',
      search: name,
      language: 'en',
      uselang: 'en',
      type: 'item',
      limit: String(limit),
      strictlanguage: '1',
    });
    return (body.search || [])
      .map((result) => result.id)
      .filter((id) => isQid(id));
  }

  /**
   * English Wikipedia titles → { qid, match: 'title' | 'redirect' }, resolving
   * redirects and skipping missing pages. Batches 50 titles per request.
   */
  async function wikipediaItems(titles) {
    const result = new Map();
    for (let index = 0; index < titles.length; index += BATCH_SIZE) {
      const batch = titles.slice(index, index + BATCH_SIZE);
      const body = await cachedRequest('enwiki', ENWIKI_API, {
        action: 'query',
        titles: batch.join('|'),
        redirects: '1',
        prop: 'pageprops',
        ppprop: 'wikibase_item',
      });
      const query = body.query || {};
      const normalized = new Map(
        (query.normalized || []).map(({ from, to }) => [from, to]),
      );
      const redirects = new Map(
        (query.redirects || []).map(({ from, to }) => [from, to]),
      );
      const pages = new Map(
        (query.pages || []).map((page) => [page.title, page]),
      );
      batch.forEach((title) => {
        const normal = normalized.get(title) || title;
        const target = redirects.get(normal);
        const page = pages.get(target || normal);
        const qid = page?.pageprops?.wikibase_item;
        if (!page || page.missing || !isQid(qid)) return;
        result.set(title, { qid, match: target ? 'redirect' : 'title' });
      });
    }
    return result;
  }

  /**
   * Fetches entities by QID (50 per request), caching each trimmed entity
   * with its retrieval time. Follows Wikidata redirects: the result maps each
   * requested id to the trimmed target entity (or null when missing).
   */
  async function entities(ids, { minTrimVersion = TRIM_VERSION } = {}) {
    const unique = [...new Set(ids)].filter((id) => isQid(id));
    const result = new Map();
    const missing = [];
    unique.forEach((id) => {
      const cached = !refresh && readJson(entityFile(id));
      // Reconciliation reads only labels, types, and dates (version 1);
      // publication also needs office statements (TRIM_VERSION).
      if (
        cached &&
        (cached.missing || (cached.trimVersion || 1) >= minTrimVersion)
      )
        result.set(id, cached);
      else missing.push(id);
    });
    for (let index = 0; index < missing.length; index += BATCH_SIZE) {
      const batch = missing.slice(index, index + BATCH_SIZE);
      log(
        `Fetching entities ${index + 1}-${index + batch.length} of ${missing.length}`,
      );
      const body = await request(WIKIDATA_API, {
        action: 'wbgetentities',
        ids: batch.join('|'),
        props: 'info|labels|aliases|claims|sitelinks',
        languages: 'en',
        sitefilter: 'enwiki',
      });
      const retrievedAt = new Date().toISOString();
      const redirects = new Map(
        Object.values(body.entities || {})
          .filter((entity) => entity.redirects)
          .map((entity) => [entity.redirects.from, entity.id]),
      );
      batch.forEach((id) => {
        const targetId = redirects.get(id) || id;
        const entity = body.entities?.[targetId] || body.entities?.[id];
        const stored =
          !entity || 'missing' in entity || !isQid(entity.id)
            ? { id, missing: true, retrievedAt }
            : { ...trimEntity(entity), retrievedAt };
        writeJson(entityFile(id), stored);
        result.set(id, stored);
      });
    }
    unique.forEach((id) => {
      if (result.get(id)?.missing) result.set(id, null);
    });
    return result;
  }

  /**
   * Items with a P39 (position held) statement for an office, via
   * CirrusSearch `haswbstatement`. Bounded to 1,000 holders per office.
   */
  async function officeHolders(officeId) {
    if (!isQid(officeId)) throw new Error(`Invalid office ${officeId}`);
    const holders = [];
    for (let offset = 0; offset < 1000; offset += 500) {
      const body = await cachedRequest('holders', WIKIDATA_API, {
        action: 'query',
        list: 'search',
        srsearch: `haswbstatement:P39=${officeId}`,
        srnamespace: '0',
        srlimit: '500',
        sroffset: String(offset),
        srinfo: 'totalhits',
        srprop: '',
      });
      const page = (body.query?.search || [])
        .map((result) => result.title)
        .filter((id) => isQid(id));
      holders.push(...page);
      if (page.length < 500) break;
    }
    return holders;
  }

  const entityFile = (id) =>
    path.join(cacheDirectory, 'entities', `${id}.json`);

  return {
    entities,
    officeHolders,
    search,
    wikipediaItems,
    get requests() {
      return requests;
    },
  };
}

module.exports = { USER_AGENT, createClient };
