import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import historicalManifest from '../../data/historical-manifest.json';
import Timeline from '../Timeline';
import '../../styles/index.css';

// Real layout in Chromium: jsdom has no boxes, so it cannot tell whether the
// printed ruler years collide at phone and tablet widths.
const years = historicalManifest.years as number[];

const mountAt = (width: number) => {
  const host = document.createElement('div');
  host.style.width = `${width}px`;
  document.body.append(host);
  render(<Timeline years={years} value={1492} onChange={() => undefined} />, {
    container: host,
  });
  return host;
};

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

afterEach(() => {
  document.body.replaceChildren();
});

describe('Timeline ruler in a real browser', () => {
  for (const width of [374, 728, 1176]) {
    it(`prints non-overlapping years inside the ruler at ${width}px`, async () => {
      const host = mountAt(width);
      await settle();
      const labels = Array.from(
        host.querySelectorAll<HTMLElement>('.timeline__label'),
      ).map((el) => ({
        text: el.textContent,
        box: el.getBoundingClientRect(),
      }));
      const ruler = host
        .querySelector('.timeline__labels')!
        .getBoundingClientRect();

      expect(labels.length).toBeGreaterThan(2);
      for (const { text, box } of labels) {
        expect(box.left, `${text} starts inside`).toBeGreaterThanOrEqual(
          ruler.left - 1,
        );
        expect(box.right, `${text} ends inside`).toBeLessThanOrEqual(
          ruler.right + 1,
        );
      }
      const sorted = [...labels].sort((a, b) => a.box.left - b.box.left);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(
          sorted[i].box.left,
          `${sorted[i - 1].text} and ${sorted[i].text} overlap`,
        ).toBeGreaterThanOrEqual(sorted[i - 1].box.right);
      }
    });
  }
});
