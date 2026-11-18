'use strict';

// Resolves the headers a path receives from public/_headers, with the
// semantics of Cloudflare's asset worker (workers-shared, Wrangler 4.164):
// a rule's `*` matches any characters including `/`; every matching rule
// applies in file order; the first rule to set a header replaces the asset
// default, and later matching rules append to it ("a, b").

const parseHeadersFile = (text) => {
  const rules = [];
  let rule = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('/')) {
      rule = { path: line, headers: [] };
      rules.push(rule);
      continue;
    }
    if (!rule) throw new Error(`header outside a rule: ${line}`);
    const colon = line.indexOf(':');
    if (colon < 1) throw new Error(`malformed header: ${line}`);
    rule.headers.push([
      line.slice(0, colon).trim(),
      line.slice(colon + 1).trim(),
    ]);
  }
  for (const r of rules) {
    if ((r.path.match(/\*/g) || []).length > 1)
      throw new Error(`only one * per rule: ${r.path}`);
    if (!r.headers.length) throw new Error(`no headers for ${r.path}`);
  }
  return rules;
};

const ruleRegExp = (rulePath) =>
  new RegExp(
    '^' +
      rulePath
        .split('*')
        .map((part) =>
          part
            .replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
            .replace(/:([A-Za-z]\w*)/g, '[^/]+'),
        )
        .join('.*') +
      '$',
  );

/** Returns { header-name-lowercase: value } for a pathname. */
const resolveHeaders = (rules, pathname) => {
  const result = {};
  for (const rule of rules) {
    if (!ruleRegExp(rule.path).test(pathname)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      result[key] = key in result ? `${result[key]}, ${value}` : value;
    }
  }
  return result;
};

module.exports = { parseHeadersFile, resolveHeaders, ruleRegExp };
