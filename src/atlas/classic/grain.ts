/**
 * Paper grain: one static `feTurbulence` tile multiplied over the map at 22%,
 * never animated. A DOM overlay, so it is not part of the MapLibre style.
 */
export const PAPER_GRAIN_IMAGE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35 0 0 0 0 .27 0 0 0 0 .17 0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

export const PAPER_GRAIN_OPACITY = 0.22;

/** Adds the grain over `container`; returns a remover. */
export function attachPaperGrain(container: HTMLElement): () => void {
  const el = document.createElement('div');
  el.className = 'hb-paper-grain';
  el.setAttribute('aria-hidden', 'true');
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2',
    backgroundImage: PAPER_GRAIN_IMAGE,
    mixBlendMode: 'multiply',
    opacity: String(PAPER_GRAIN_OPACITY),
  });
  container.append(el);
  return () => el.remove();
}
