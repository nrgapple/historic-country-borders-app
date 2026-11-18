import { lifespanLayout, type Existed } from '../lib/lifespan';

interface LifespanBarProps {
  existed: Existed | undefined;
  /** The map year, marked "This map". */
  year: number;
  /** Link to the Wikidata item the dates come from. */
  href?: string;
}

/**
 * "Key dates": a bar from the territory's start to its end with the map year
 * marked (plan §2.1, from Direction B). Approximate bounds get soft ends and
 * "c.". Hidden when either end is unknown.
 */
export default function LifespanBar({ existed, year, href }: LifespanBarProps) {
  const layout = lifespanLayout(existed, year);
  if (!layout) return null;
  const { start, end, marker } = layout;
  const left = `${(marker.position * 100).toFixed(2)}%`;
  return (
    <section className="lifespan" aria-labelledby="lifespan-title">
      <h3 className="section-label" id="lifespan-title">
        Key dates
      </h3>
      <p className="visually-hidden">{layout.description}</p>
      <div
        className="lifespan__figure"
        data-placement={marker.placement}
        aria-hidden="true"
      >
        <div className="lifespan__track">
          <span
            className="lifespan__span"
            data-soft-start={start.approx || undefined}
            data-soft-end={end.approx || undefined}
          />
          <span className="lifespan__marker" style={{ left }} />
        </div>
        <div className="lifespan__ends">
          <span className="lifespan__end">{start.label}</span>
          <span className="lifespan__end">{end.label}</span>
        </div>
        <span
          className="lifespan__marker-label"
          data-edge={
            marker.position < 0.2
              ? 'start'
              : marker.position > 0.8
                ? 'end'
                : undefined
          }
          style={{ left }}
        >
          {marker.label}
        </span>
      </div>
      <p className="lifespan__source">
        Existed: {start.label} – {end.label}, from{' '}
        {href ? (
          <a href={href} target="_blank" rel="noreferrer">
            Wikidata
          </a>
        ) : (
          'Wikidata'
        )}
        .
      </p>
    </section>
  );
}
