import React, { ReactNode } from 'react';
import Link from 'next/link';
import Dialog from './Dialog';
import { useChrome } from '../contexts/ChromeContext';

export const REPOSITORY_URL =
  'https://github.com/nrgapple/historic-country-borders-app';

interface AboutDialogProps {
  /** Page-specific description of the data on screen. */
  sources: ReactNode;
  /** Keyboard shortcuts relevant to the page. */
  shortcuts?: Array<{ keys: string[]; action: string }>;
}

export default function AboutDialog({
  sources,
  shortcuts = [],
}: AboutDialogProps) {
  const { overlay, closeOverlay } = useChrome();

  return (
    <Dialog
      open={overlay === 'about'}
      onClose={closeOverlay}
      title="About this map"
      className="about"
    >
      <p className="dialog__lede">
        Historic Borders is a free, open-source atlas for exploring how
        political boundaries have changed. Select any territory to read a short
        Wikipedia summary.
      </p>

      <section className="about__section">
        <h3>Sources and accuracy</h3>
        {sources}
      </section>

      {shortcuts.length > 0 && (
        <section className="about__section">
          <h3>Keyboard</h3>
          <dl className="shortcuts">
            {shortcuts.map((shortcut) => (
              <div key={shortcut.action} className="shortcuts__row">
                <dt>
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{shortcut.action}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="about__section">
        <h3>More</h3>
        <ul className="link-list">
          <li>
            <Link href="/year/1914" onClick={closeOverlay}>
              World history map
            </Link>
          </li>
          <li>
            <Link href="/pa/school-districts" onClick={closeOverlay}>
              Pennsylvania school districts map
            </Link>
          </li>
          <li>
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer">
              Source code on GitHub
            </a>
          </li>
          <li>
            <a
              href={`${REPOSITORY_URL}/discussions`}
              target="_blank"
              rel="noreferrer"
            >
              Community discussions
            </a>
          </li>
        </ul>
      </section>
    </Dialog>
  );
}
