import type { PlaceFact } from '../components/PlacePanel';
import type { Territory } from '../adapters/yearData';
import { contextFacts, type YearContext } from '../lib/yearContext';

const PRECISION: Record<number, string> = {
  1: 'Approximate',
  2: 'Moderately precise',
  3: 'Set by treaty or law',
};

const clean = (value: string | undefined) =>
  value && value.trim() ? value.trim() : undefined;

/**
 * The italic line under the name: the territory's relation to another, as
 * the source records it ("Part of …", or "Subject to …").
 */
export const territorySubtitle = (territory: Territory): string | undefined => {
  const partOf = clean(territory.PARTOF);
  const subjectTo = clean(territory.SUBJECTO);
  if (partOf && partOf !== territory.NAME) return `Part of ${partOf}`;
  if (subjectTo && subjectTo !== territory.NAME) return `Subject to ${subjectTo}`;
  return undefined;
};

/** Facts from the border data itself (Historical Basemaps). */
export const territoryFacts = (territory: Territory): PlaceFact[] => {
  const name = territory.NAME;
  const partOf = clean(territory.PARTOF);
  const subjectTo = clean(territory.SUBJECTO);
  const facts: PlaceFact[] = [];
  // The subtitle names the first relation; a second, different one is a fact.
  if (partOf && partOf !== name && subjectTo && subjectTo !== name && subjectTo !== partOf)
    facts.push({ label: 'Subject to', value: subjectTo, source: 'Historical Basemaps' });
  const precision = PRECISION[Number(territory.BORDERPRECISION)];
  if (precision)
    facts.push({ label: 'Borders', value: precision, kind: 'borders', source: 'Historical Basemaps' });
  return facts;
};

/** Direction A's fact box: Capital, Ruler, Existed, Borders (plus any extra Wikidata facts). */
const LABELS: Record<string, string> = { 'Head of state': 'Ruler' };
const ORDER = ['Capital', 'Ruler', 'Head of government', 'Existed', 'Founded', 'Ended', 'Subject to', 'Borders'];

export const panelFacts = (
  territory: Territory | undefined,
  context: YearContext | undefined,
  name: string,
): PlaceFact[] =>
  [
    ...contextFacts(context, name).map((fact) => ({ ...fact, label: LABELS[fact.label] ?? fact.label })),
    ...(territory ? territoryFacts(territory) : []),
  ].sort((a, b) => ORDER.indexOf(a.label) - ORDER.indexOf(b.label));
