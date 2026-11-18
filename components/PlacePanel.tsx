import React, { useEffect, useRef } from 'react';
import Icon from './Icon';
import CopyLinkButton from './CopyLinkButton';
import { useWikiSummary } from '../hooks/useWiki';

export interface PlaceFact {
  label: string;
  value: string;
  /** Source link for the value, e.g. the Wikidata statement. */
  href?: string;
  /** Short source credit shown under the facts, e.g. "Wikidata". */
  source?: string;
}

interface PlacePanelProps {
  /** Small heading above the name, e.g. "Territory · 1492". */
  eyebrow: string;
  name: string;
  facts?: PlaceFact[];
  /** Search phrase for Wikipedia; defaults to the name. */
  wikiQuery?: string;
  note?: string;
  /** Shows a "Copy link" action for sharing this selection. */
  shareable?: boolean;
  onClose: () => void;
}

export default function PlacePanel({
  eyebrow,
  name,
  facts = [],
  wikiQuery,
  note,
  shareable = true,
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
    <aside className="place-panel" aria-labelledby="place-panel-title">
      <header className="place-panel__header">
        <div>
          <p className="place-panel__eyebrow">{eyebrow}</p>
          <h2 className="place-panel__title" id="place-panel-title">
            {name}
          </h2>
          {shareable && <CopyLinkButton key={name} />}
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

      <div className="place-panel__body">
        {facts.length > 0 && (
          <dl className="place-panel__facts">
            {facts.map((fact) => (
              <div key={fact.label} className="place-panel__fact">
                <dt>{fact.label}</dt>
                <dd>
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
                </dd>
              </div>
            ))}
          </dl>
        )}
        {factSources.length > 0 && (
          <p className="place-panel__facts-source">
            Facts: {factSources.join(', ')}
          </p>
        )}

        <section className="place-panel__wiki" aria-live="polite">
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
              {summary.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
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
              {summary.title !== name && (
                <p className="place-panel__match">
                  Closest article: <strong>{summary.title}</strong>
                </p>
              )}
              <p className="place-panel__extract">{summary.extract}</p>
              <p className="place-panel__source">
                <a href={summary.url} target="_blank" rel="noreferrer">
                  Read more on Wikipedia
                  <Icon name="external" size={14} />
                </a>
                <span>
                  Text from Wikipedia,{' '}
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

        {note && <p className="place-panel__note">{note}</p>}
      </div>
    </aside>
  );
}
