import { useEffect, useRef, type ReactNode } from 'react';
import Icon from './Icon';
import CopyLinkButton from './CopyLinkButton';
import './PlacePanel.css';
import { useWikiSummary } from '../hooks/useWiki';

export interface PlaceFact {
  label: string;
  value: string;
  /** Source link for the value, e.g. the Wikidata statement. */
  href?: string;
  /** Short source credit shown under the facts, e.g. "Wikidata". */
  source?: string;
  /** A second, italic line, e.g. a ruler's office. */
  detail?: string;
  /** Marks the border-precision row, drawn with a dashed-line key when approximate. */
  kind?: 'borders';
}

/** Licence notes for fact sources, shown once under the fact box. */
const SOURCE_NOTES: Record<string, string> = {
  Wikidata: 'Wikidata (CC0)',
  'Historical Basemaps': 'Historical Basemaps (GPL-3.0)',
};

interface PlacePanelProps {
  /** Small heading above the name, e.g. "Territory · Map of 1492". */
  eyebrow: string;
  name: string;
  /** Italic line under the name, e.g. "Part of the Holy Roman Empire". */
  subtitle?: string;
  /** Heading of the fact box, e.g. "In 1492". */
  factsTitle?: string;
  facts?: PlaceFact[];
  /** Search phrase for Wikipedia; defaults to the name. */
  wikiQuery?: string;
  note?: string;
  /** Shows a "Copy link" action for sharing this selection. */
  shareable?: boolean;
  /** Extra sections after the overview, e.g. the Key dates bar. */
  children?: ReactNode;
  onClose: () => void;
}

/**
 * The place panel as a page in a gazetteer (Direction A): snapshot facts for
 * the map year first, then the encyclopedia overview, explicitly attributed,
 * then key dates. A right-hand page on wide screens, a bottom sheet on phones.
 */
export default function PlacePanel({
  eyebrow,
  name,
  subtitle,
  factsTitle,
  facts = [],
  wikiQuery,
  note,
  shareable = true,
  children,
  onClose,
}: PlacePanelProps) {
  const { summary, isLoading, isMissing, error, retry } = useWikiSummary(
    wikiQuery ?? name,
  );
  const closeRef = useRef<HTMLButtonElement>(null);
  const factSources = [
    ...new Set(facts.flatMap((fact) => (fact.source ? [fact.source] : []))),
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]'))
        onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside className="place-panel paper-grain" aria-labelledby="place-panel-title">
      <span className="place-panel__handle" aria-hidden="true" />
      <div className="place-panel__scroll">
        <header className="place-panel__header">
          <div>
            <p className="place-panel__eyebrow">{eyebrow}</p>
            <h2 className="place-panel__title" id="place-panel-title">
              {name}
            </h2>
            {subtitle && <p className="place-panel__subtitle">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label={`Close details for ${name}`}
          >
            <Icon name="close" />
          </button>
        </header>

        {facts.length > 0 && (
          <section
            className="place-panel__factbox"
            aria-label={factsTitle ?? 'Facts'}
          >
            {factsTitle && (
              <p className="place-panel__facts-title" aria-hidden="true">
                {factsTitle}
              </p>
            )}
            <dl className="place-panel__facts">
              {facts.map((fact) => (
                <div key={fact.label} className="place-panel__fact">
                  <dt>{fact.label}</dt>
                  <dd>
                    {fact.kind === 'borders' && fact.value === 'Approximate' && (
                      <svg
                        className="place-panel__approx"
                        viewBox="0 0 26 8"
                        aria-hidden="true"
                      >
                        <path
                          d="M1 4h24"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeDasharray="4 3"
                        />
                      </svg>
                    )}
                    {fact.href ? (
                      <a
                        href={fact.href}
                        target="_blank"
                        rel="noreferrer"
                        title={fact.source && `Source: ${fact.source}`}
                      >
                        {fact.value}
                      </a>
                    ) : (
                      fact.value
                    )}
                    {fact.detail && <small>{fact.detail}</small>}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {factSources.length > 0 && (
          <p className="place-panel__facts-source">
            Facts from{' '}
            {factSources.map((s) => SOURCE_NOTES[s] ?? s).join(' and ')}.
          </p>
        )}

        <section
          className="place-panel__wiki"
          aria-labelledby="place-panel-wiki"
          aria-live="polite"
        >
          <h3 className="section-label" id="place-panel-wiki">
            Overview · Wikipedia
          </h3>
          {isLoading && (
            <div className="skeleton" role="status">
              <span className="visually-hidden">
                Loading Wikipedia summary…
              </span>
              <span className="skeleton__line" />
              <span className="skeleton__line" />
              <span className="skeleton__line skeleton__line--short" />
            </div>
          )}

          {error && (
            <p className="place-panel__status">
              Wikipedia is unavailable right now.{' '}
              <button type="button" className="text-button" onClick={retry}>
                Try again
              </button>
            </p>
          )}

          {isMissing && (
            <p className="place-panel__status">
              No matching Wikipedia article was found.
            </p>
          )}

          {summary && (
            <>
              {summary.title !== name && (
                <p className="place-panel__match">
                  Closest article: <strong>{summary.title}</strong>
                </p>
              )}
              <p className="place-panel__extract">{summary.extract}</p>
              {summary.thumbnail && (
                <img
                  className="place-panel__image"
                  src={summary.thumbnail.source}
                  width={summary.thumbnail.width || undefined}
                  height={summary.thumbnail.height || undefined}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <p className="place-panel__source">
                <a href={summary.url} target="_blank" rel="noreferrer">
                  Read more on Wikipedia
                  <Icon name="external" size={14} />
                </a>
                <span>
                  {' · '}Text{' '}
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    CC BY-SA 4.0
                  </a>
                </span>
              </p>
            </>
          )}
        </section>

        {children}

        {note && <p className="place-panel__note">{note}</p>}
      </div>
      {shareable && (
        <footer className="place-panel__foot">
          <CopyLinkButton key={name} />
        </footer>
      )}
    </aside>
  );
}
