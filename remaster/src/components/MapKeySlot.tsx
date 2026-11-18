import { eraOf, formatYear } from '../lib/years';

interface MapKeySlotProps {
  /** Year pages: the plate title is the year and its era. */
  year?: number;
  /** Other maps (Pennsylvania): the plate title, set explicitly. */
  plate?: { kicker: string; title: string; sub: string };
}

/**
 * PLACEHOLDER for T7's `MapKey` (plan §2.1, item 1; §9.2 P3): the corner
 * cartouche merged with Direction B's key (title, locator globe, legend,
 * scale bar, north arrow). It holds the bottom-left slot, the safe-area
 * padding and the phone collapse rules, so T7 replaces only the contents.
 * Today it prints the plate title only; the legend's classes are listed in
 * `LEGEND` (src/adapters/mapStyle.ts). The Pennsylvania page passes its own
 * plate; its key (P5) is T7's PA form when that lands.
 */
export default function MapKeySlot({ year, plate }: MapKeySlotProps) {
  const content =
    plate ??
    (year !== undefined
      ? {
          kicker: 'The World in',
          title: formatYear(year),
          sub: `Political divisions in the ${eraOf(year).label} era`,
        }
      : null);
  if (!content) return null;
  return (
    <div className="map-key" data-slot="map-key" data-placeholder>
      <p className="map-key__kicker">{content.kicker}</p>
      <p className="map-key__title">{content.title}</p>
      <p className="map-key__sub">{content.sub}</p>
    </div>
  );
}
