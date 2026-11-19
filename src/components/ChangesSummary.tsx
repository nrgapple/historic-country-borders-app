import type { TerritoryChange, YearContext } from '../lib/yearContext';
import { track } from '../lib/analytics';
import { formatYear } from '../lib/years';

/** Names listed per group before "and N more". */
export const CHANGES_LIMIT = 8;

interface ChangesSummaryProps {
  /** Loaded context; may still be the previous year's while loading. */
  context: YearContext | undefined;
  year: number;
}

const changeText = ({ name, field, from, to }: TerritoryChange) => {
  const relation = field === 'subjectTo' ? 'under' : 'part of';
  if (from && to) return `${name}: ${relation} ${from} → ${to}`;
  if (to) return `${name}: now ${relation} ${to}`;
  return `${name}: no longer ${relation} ${from}`;
};

function Group({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  const hidden = items.length - CHANGES_LIMIT;
  return (
    <section className="changes-summary__group">
      <h3 className="changes-summary__heading">
        {title} <span className="changes-summary__count">{items.length}</span>
      </h3>
      <ul className="changes-summary__list">
        {items.slice(0, CHANGES_LIMIT).map((item) => (
          <li key={item}>{item}</li>
        ))}
        {hidden > 0 && (
          <li className="changes-summary__more">and {hidden} more</li>
        )}
      </ul>
    </section>
  );
}

/**
 * "Changes since <previous year>": names that appear, disappear, or
 * change overlord between two published maps. Collapsed by default so the
 * map stays uncluttered; a native <details> keeps it keyboard accessible.
 */
export default function ChangesSummary({ context, year }: ChangesSummaryProps) {
  const changes = context?.changes;
  if (!changes) return null;
  const stale = context.year !== year;
  const { appeared, disappeared, changed, previousYear } = changes;
  if (!appeared.length && !disappeared.length && !changed.length) return null;

  return (
    <details
      className="changes-summary"
      onToggle={(event) => {
        if (event.currentTarget.open) track('changes_open', { year });
      }}
      data-map-obstacle
      aria-busy={stale || undefined}
      data-stale={stale || undefined}
    >
      <summary className="changes-summary__toggle">
        Changes since {formatYear(previousYear)}
      </summary>
      <div className="changes-summary__body">
        <Group title="New on the map" items={appeared} />
        <Group title="Gone from the map" items={disappeared} />
        <Group title="Changed rule" items={changed.map(changeText)} />
        <p className="changes-summary__note">
          Compared with the {formatYear(previousYear)} map in this atlas. A name
          can also change because the source maps differ, not only because of
          history.
        </p>
      </div>
    </details>
  );
}
