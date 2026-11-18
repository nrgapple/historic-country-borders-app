'use strict';

// Network half of the PA street basemap refresh (docs/PA_BASEMAP.md): reads
// tiles out of one pinned Protomaps daily build over HTTP Range requests,
// like `pmtiles extract`, and caches them on disk. Pure Node: the `pmtiles`
// package parses the archive header and directories; tile bytes are fetched
// in coalesced ranges so ~50k tiles take a few hundred requests.
//
// Only `scripts/refresh-pa-basemap.js` calls this. Nothing in a build, test
// or validation touches the network.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** Tiles closer than this in the archive are fetched in one range. */
const MAX_GAP = 64 * 1024;
/** Upper bound for one coalesced range request. */
const MAX_RANGE = 8 * 1024 * 1024;
const CONCURRENCY = 6;

const pmtilesModule = () => require('pmtiles');

/** Opens the pinned archive and checks it is the pinned build. */
async function openArchive(pin) {
  const { PMTiles, FetchSource, SharedPromiseCache } = pmtilesModule();
  const source = new FetchSource(pin.url);
  const archive = new PMTiles(source, new SharedPromiseCache(4096));
  const header = await archive.getHeader();
  if (pin.etag && header.etag && header.etag !== pin.etag)
    throw new Error(
      `${pin.url}: etag ${header.etag} does not match the pin ${pin.etag}. ` +
        'The build changed upstream; review it and update data/pa-basemap-sources.json.',
    );
  if (header.tileType !== 1)
    throw new Error(`${pin.url}: not a vector-tile archive`);
  return { archive, source, header };
}

/** Resolves tile ids to absolute byte ranges, walking root and leaf directories. */
async function locate({ archive, source, header }, tileId) {
  const { findTile } = pmtilesModule();
  let offset = header.rootDirectoryOffset;
  let length = header.rootDirectoryLength;
  for (let depth = 0; depth <= 3; depth += 1) {
    const directory = await archive.cache.getDirectory(
      source,
      offset,
      length,
      header,
    );
    const entry = findTile(directory, tileId);
    if (!entry) return null;
    if (entry.runLength > 0)
      return {
        offset: header.tileDataOffset + entry.offset,
        length: entry.length,
      };
    offset = header.leafDirectoryOffset + entry.offset;
    length = entry.length;
  }
  throw new Error(`tile ${tileId}: directory deeper than 3 levels`);
}

const pool = async (items, limit, worker) => {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: limit }, run));
};

const rangeRequest = async (url, offset, length, etag) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=${offset}-${offset + length - 1}` },
      });
      if (response.status !== 206)
        throw new Error(`HTTP ${response.status} for a Range request`);
      const got = response.headers.get('etag');
      if (etag && got && got !== etag)
        throw new Error(`etag changed mid-refresh (${got})`);
      const body = Buffer.from(await response.arrayBuffer());
      if (body.length !== length)
        throw new Error(`short read: ${body.length} of ${length} bytes`);
      return body;
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
};

const decompress = (buffer, compression) => {
  // PMTiles Compression: 1 none, 2 gzip.
  if (compression === 2 || (buffer[0] === 0x1f && buffer[1] === 0x8b))
    return zlib.gunzipSync(buffer);
  if (compression === 1 || compression === 0) return buffer;
  throw new Error(`unsupported tile compression ${compression}`);
};

/**
 * Downloads every requested tile that is not cached yet into
 * `<cacheDir>/<z>/<x>/<y>.mvt` (decompressed MVT; `.none` marks a tile the
 * archive does not have). Returns request and byte counts.
 */
async function fetchTiles(pin, tiles, cacheDir, log = console.log) {
  const { zxyToTileId } = pmtilesModule();
  const file = (t) => path.join(cacheDir, String(t.z), String(t.x), `${t.y}`);
  const missing = tiles.filter(
    (t) =>
      !fs.existsSync(`${file(t)}.mvt`) && !fs.existsSync(`${file(t)}.none`),
  );
  if (!missing.length) return { requested: 0, ranges: 0, bytes: 0 };
  log(`pa-basemap: locating ${missing.length} tiles in ${pin.url}`);
  const opened = await openArchive(pin);
  const located = [];
  await pool(missing, 16, async (t) => {
    const at = await locate(opened, zxyToTileId(t.z, t.x, t.y));
    if (!at) {
      fs.mkdirSync(path.dirname(file(t)), { recursive: true });
      fs.writeFileSync(`${file(t)}.none`, '');
    } else located.push({ ...t, ...at });
  });
  located.sort((a, b) => a.offset - b.offset);
  const ranges = [];
  for (const t of located) {
    const last = ranges[ranges.length - 1];
    const end = t.offset + t.length;
    if (
      last &&
      t.offset - last.end <= MAX_GAP &&
      end - last.start <= MAX_RANGE
    ) {
      last.end = Math.max(last.end, end);
      last.tiles.push(t);
    } else ranges.push({ start: t.offset, end, tiles: [t] });
  }
  let bytes = 0;
  let done = 0;
  await pool(ranges, CONCURRENCY, async (range) => {
    const body = await rangeRequest(
      pin.url,
      range.start,
      range.end - range.start,
      opened.header.etag,
    );
    bytes += body.length;
    for (const t of range.tiles) {
      const raw = body.subarray(
        t.offset - range.start,
        t.offset - range.start + t.length,
      );
      const out = file(t);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(
        `${out}.mvt`,
        decompress(raw, opened.header.tileCompression),
      );
    }
    done += 1;
    if (done % 50 === 0 || done === ranges.length)
      log(
        `pa-basemap: ${done}/${ranges.length} ranges, ${(bytes / 1048576).toFixed(1)} MiB`,
      );
  });
  return { requested: located.length, ranges: ranges.length, bytes };
}

module.exports = { fetchTiles, openArchive };
