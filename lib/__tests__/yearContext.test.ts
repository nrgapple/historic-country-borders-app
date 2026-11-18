import { describe, expect, it } from 'vitest';
import {
  contextFacts,
  formatYearRange,
  validateYearContext,
  type YearContext,
} from '../yearContext';

const context: YearContext = {
  schemaVersion: 1,
  year: 1492,
  source: {
    name: 'Wikidata',
    license: 'CC0-1.0',
    retrievedAt: '2026-11-17T00:00:00.000Z',
  },
  places: {
    'Ottoman Empire': {
      qid: 'Q12560',
      existed: { start: 1299, end: 1922 },
      capital: [
        { qid: 'Q16869', label: 'Constantinople', start: 1453, end: 1922 },
      ],
      headOfState: [
        { qid: 'Q194300', label: 'Bayezid II', start: 1481, end: 1512 },
      ],
    },
    Rome: {
      qid: 'Q17167',
      existed: { start: -509, end: -27, startApprox: true },
      headOfGovernment: [
        { qid: 'Q1', label: 'A', start: 1913 },
        { qid: 'Q2', label: 'B', end: 1920, endApprox: true },
        { qid: 'Q3', label: 'C' },
      ],
    },
    Founded: { qid: 'Q4', existed: { start: 1776 } },
    Sultanate: {
      qid: 'Q6',
      headOfState: [{ qid: 'Q7', label: 'Sultan', start: 1500, end: 1500 }],
      headOfStateOffice: 'Q8',
    },
    Ended: { qid: 'Q5', existed: { end: -30, endApprox: true } },
  },
  changes: {
    previousYear: 1400,
    appeared: [],
    disappeared: [],
    changed: [],
  },
};

describe('contextFacts', () => {
  it('returns source-linked capital, ruler, and lifespan facts', () => {
    expect(contextFacts(context, 'Ottoman Empire')).toEqual([
      {
        label: 'Capital',
        value: 'Constantinople',
        href: 'https://www.wikidata.org/wiki/Q12560#P36',
        source: 'Wikidata',
      },
      {
        label: 'Head of state',
        value: 'Bayezid II (1481–1512 AD)',
        href: 'https://www.wikidata.org/wiki/Q12560#P35',
        source: 'Wikidata',
      },
      {
        label: 'Existed',
        value: '1299–1922 AD',
        href: 'https://www.wikidata.org/wiki/Q12560',
        source: 'Wikidata',
      },
    ]);
  });

  it('formats open terms, approximate dates, and BC lifespans', () => {
    const facts = contextFacts(context, 'Rome');
    expect(facts[0]).toMatchObject({
      label: 'Head of government',
      value: 'A (from 1913); B (until c. 1920); C',
    });
    expect(facts[1]).toMatchObject({ label: 'Existed', value: 'c. 509–27 BC' });
    expect(contextFacts(context, 'Founded')[0]).toMatchObject({
      label: 'Founded',
      value: '1776',
    });
    expect(contextFacts(context, 'Ended')[0]).toMatchObject({
      label: 'Ended',
      value: 'c. 30 BC',
    });
  });

  it('links an office-derived head of state to the office item', () => {
    expect(contextFacts(context, 'Sultanate')).toEqual([
      {
        label: 'Head of state',
        value: 'Sultan (1500)',
        href: 'https://www.wikidata.org/wiki/Q8',
        source: 'Wikidata',
      },
    ]);
  });

  it('returns nothing for unknown places or missing context', () => {
    expect(contextFacts(context, 'Atlantis')).toEqual([]);
    expect(contextFacts(undefined, 'Ottoman Empire')).toEqual([]);
  });
});

describe('formatYearRange', () => {
  it('writes the era once when both ends share it', () => {
    expect(formatYearRange(1299, 1922)).toBe('1299–1922 AD');
    expect(formatYearRange(-3100, -30)).toBe('3,100–30 BC');
    expect(formatYearRange(-27, 476)).toBe('27 BC – 476 AD');
    expect(formatYearRange(-27, 476, { startApprox: true })).toBe(
      'c. 27 BC – 476 AD',
    );
  });
});

describe('validateYearContext', () => {
  it('accepts context files and rejects malformed ones', () => {
    expect(validateYearContext(context)).toBe(context);
    expect(validateYearContext({ ...context, changes: null }).changes).toBe(
      null,
    );
    expect(() => validateYearContext({ ...context, places: [] })).toThrow(
      'malformed',
    );
    expect(() =>
      validateYearContext({
        ...context,
        changes: { previousYear: 1400, appeared: [1] },
      }),
    ).toThrow('malformed');
    expect(() => validateYearContext(null)).toThrow('malformed');
  });
});
