import { eraOf, formatYear } from '../lib/years';

/**
 * PLACEHOLDER for T7's `MapKey` (plan §2.1, item 1; §9.2 P3): the corner
 * cartouche merged with Direction B's key (title, locator globe, legend,
 * scale bar, north arrow). It holds the bottom-left slot, the safe-area
 * padding and the phone collapse rules, so T7 replaces only the contents.
 * Today it prints the plate title only; the legend's classes are listed in
 * `LEGEND` (src/adapters/mapStyle.ts).
 */
export default function MapKeySlot({ year }: { year: number }) {
  const era = eraOf(year);
  return (
    <div className="map-key" data-slot="map-key" data-placeholder>
      <p className="map-key__kicker">The World in</p>
      <p className="map-key__title">{formatYear(year)}</p>
      <p className="map-key__sub">Political divisions in the {era.label} era</p>
    </div>
  );
}
