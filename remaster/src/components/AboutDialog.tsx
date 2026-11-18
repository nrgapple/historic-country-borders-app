import type { ReactNode } from 'react';
import Dialog from './Dialog';
import { useChrome } from '../atlas/hooks';
import { FONT_LICENSES } from '../adapters/glyphs';

export const REPOSITORY_URL =
  'https://github.com/nrgapple/historic-country-borders-app';

/** Opening paragraph for the world history maps. */
export const HISTORICAL_INTRO = (
  <p className="dialog__lede">
    Historic Borders is a free, open-source atlas for exploring how political
    boundaries have changed. Select any territory to read a short Wikipedia
    summary.
  </p>
);

interface AboutDialogProps {
  /** Page-specific opening paragraph(s). */
  intro?: ReactNode;
  /** Page-specific description of the data on screen. */
  sources: ReactNode;
  /** Keyboard shortcuts relevant to the page. */
  shortcuts?: Array<{ keys: string[]; action: string }>;
}

export default function AboutDialog({
  intro = HISTORICAL_INTRO,
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
      {intro}

      <section className="about__section">
        <h3>Sources and accuracy</h3>
        {sources}
      </section>

      <section className="about__section">
        <h3>Type</h3>
        {/* Text from docs/FONTS.md, "Licenses and attribution" (T3). */}
        <p>
          Map labels and text use Alegreya, Alegreya SC and Alegreya Sans by
          Huerta Tipográfica, and Atkinson Hyperlegible Next by the Braille
          Institute (for projector text). Names in Cherokee, Canadian
          Aboriginal syllabics, Osage and some phonetic letters use Noto Sans
          fonts by the Noto Project Authors. All fonts are used under the SIL
          Open Font License 1.1.
        </p>
        <p className="about__licenses">
          Licenses:{' '}
          {FONT_LICENSES.map((license, i) => (
            <span key={license.href}>
              {i > 0 && ', '}
              <a href={license.href}>{license.font}</a>
            </span>
          ))}
          .
        </p>
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
            <a href="/year/1914">World history map</a>
          </li>
          <li>
            <a href="/">Random year</a>
          </li>
          <li>
            <a href="/pa/school-districts">
              Pennsylvania school districts map
            </a>
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
