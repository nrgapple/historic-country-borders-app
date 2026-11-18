import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  drawnClasses,
  legendEntries,
  MARKER,
  type LegendEntry,
} from '../adapters/mapStyle';
import { legendKey, watchMapKey, type KeyView } from '../atlas/mapKey';
import { drawGlobe, landRings, type Ring } from '../lib/globe';
import { loadLand } from '../lib/land';
import {
  formatKm,
  formatLatitude,
  scaleBar,
  type ScaleBar,
} from '../lib/scaleBar';
import { eraOf, formatYear } from '../lib/years';
import { COLOR, ERA_TINTS, type EraId } from '../styles/tokens';
import './MapKey.css';

/** The visitor's last choice on a wide screen (a per-viewer convenience). */
export const KEY_STORAGE = 'hb:map-key-open';
/** Phones and short screens start with only the scale bar and the toggle. */
export const COMPACT_QUERY = '(max-width: 699px), (max-height: 600px)';

const readStored = (): boolean | null => {
  try {
    const v = window.localStorage.getItem(KEY_STORAGE);
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
};
const store = (open: boolean) => {
  try {
    window.localStorage.setItem(KEY_STORAGE, open ? '1' : '0');
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
};

/** Outer land rings for the globe, from the shared 110m download. */
const loadGlobeLand = (): Promise<Ring[]> =>
  loadLand().then((fc) => (fc ? landRings(fc) : []));

export interface MapKeyProps {
  year: number;
  /** The live map, once mounted (from the controller's handle). */
  map?: MapLibreMap | null;
  /** T6's low-power mode: the dependency swatch drops its hatch. */
  lowPower?: boolean;
  /** Called after the key opens or closes, so map labels can move clear of it. */
  onLayout?: () => void;
  /** A bottom sheet (Settings) is open: on phones the key steps aside. */
  underSheet?: boolean;
}

/**
 * The corner map key (plan §2.1, §9.2 P3): Direction A's cartouche merged
 * with Direction B's key. Title, locator globe, a legend of the classes the
 * map is drawing, an alternating scale bar true at the view's centre
 * latitude, and a north arrow.
 *
 * - Phones and short screens show the scale bar and a "Key" toggle only.
 * - On phones it sits bottom left; with the place sheet open it moves to the
 *   top, so it never overlaps the sheet.
 * - It is marked `data-map-obstacle`: state names whose label point falls
 *   under it are drawn in the visible part of their territory instead.
 */
export default function MapKeySlot({
  year,
  map = null,
  lowPower = false,
  onLayout,
  underSheet = false,
}: MapKeyProps) {
  const era = eraOf(year);
  const accent = ERA_TINTS[era.id as EraId]?.ink ?? COLOR.ink;
  // null = automatic (open on wide screens, closed on compact ones).
  const [choice, setChoice] = useState<boolean | null>(null);
  const [compact, setCompact] = useState(false);
  const [view, setView] = useState<KeyView | null>(null);
  const [legend, setLegend] = useState<LegendEntry[]>([]);
  const [land, setLand] = useState<Ring[] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const open = choice ?? !compact;
  const openRef = useRef(open);
  openRef.current = open;

  // Screen class, and the stored choice on wide screens.
  useEffect(() => {
    const query = window.matchMedia?.(COMPACT_QUERY);
    const update = () => setCompact(Boolean(query?.matches));
    update();
    if (!query?.matches) setChoice(readStored());
    query?.addEventListener?.('change', update);
    return () => query?.removeEventListener?.('change', update);
  }, []);

  // Camera on moveend; legend on idle. Never per frame.
  useEffect(() => {
    if (!map) return;
    const readLegend = () => {
      if (!openRef.current) return;
      const next = legendEntries(drawnClasses(map, lowPower));
      setLegend((prev) => (legendKey(prev) === legendKey(next) ? prev : next));
    };
    const stop = watchMapKey(map, setView, readLegend);
    readLegend();
    return stop;
  }, [map, lowPower]);

  // Opening the key: read the legend now (the map may already be idle),
  // fetch the globe's land the first time, and let labels move clear of it.
  useEffect(() => {
    if (open && map) {
      const next = legendEntries(drawnClasses(map, lowPower));
      setLegend((prev) => (legendKey(prev) === legendKey(next) ? prev : next));
    }
    if (open && !land) void loadGlobeLand().then(setLand);
    if (!onLayout) return;
    const frame = requestAnimationFrame(() => onLayout());
    return () => cancelAnimationFrame(frame);
  }, [open, map, lowPower, land, onLayout]);

  // The globe follows `view`, which changes only on moveend.
  useEffect(() => {
    const el = canvas.current;
    if (!el || !open || !view || !land) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(el.clientWidth * dpr) || 128;
    if (el.width !== px) el.width = el.height = px;
    drawGlobe(
      el,
      land,
      { center: view.center, bounds: view.bounds },
      {
        water: COLOR.water,
        land: COLOR.land,
        coast: COLOR.waterInk,
        ink: COLOR.ink,
        accent,
      },
    );
  }, [view, land, open, accent]);

  const toggle = () => {
    const next = !open;
    setChoice(next);
    if (!compact) store(next);
  };

  const scale: ScaleBar | null = view
    ? scaleBar(view.center[1], view.zoom, compact ? 96 : 132, 48)
    : null;

  return (
    <section
      className="map-key"
      data-slot="map-key"
      data-open={open || undefined}
      data-under-sheet={underSheet || undefined}
      data-map-obstacle
      aria-label="Map key"
    >
      <div className="map-key__body" id="map-key-body" hidden={!open}>
        <div className="map-key__head">
          <canvas
            ref={canvas}
            className="map-key__globe"
            role="img"
            aria-label="Locator globe: the area on the map is outlined"
            width={128}
            height={128}
          />
          <div className="map-key__plate">
            <p className="map-key__kicker">The World in</p>
            <p className="map-key__title">{formatYear(year)}</p>
            <p className="map-key__sub">{era.label} era</p>
          </div>
        </div>
        {legend.length > 0 && (
          <ul className="map-key__legend" aria-label="Legend">
            {legend.map((entry) => (
              <li key={entry.id} className="map-key__item">
                <LegendSymbol entry={entry} />
                <span>{entry.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="map-key__bar">
        {scale && (
          <div
            className="scalebar"
            role="img"
            aria-label={`Scale bar: ${formatKm(scale.km)} kilometres at ${formatLatitude(scale.lat)}`}
            data-km={scale.km}
            data-lat={scale.lat}
          >
            <div
              className="scalebar__bar"
              style={{ width: `${scale.px.toFixed(1)}px` }}
            >
              <span />
              <span />
              <span />
              <span />
            </div>
            <div
              className="scalebar__nums"
              style={{ width: `${scale.px.toFixed(1)}px` }}
              aria-hidden="true"
            >
              <span style={{ left: 0 }}>0</span>
              <span style={{ left: '50%' }}>{formatKm(scale.km / 2)}</span>
              <span style={{ left: '100%' }}>{formatKm(scale.km)}</span>
            </div>
            <p className="scalebar__caption" aria-hidden="true">
              {compact ? 'km' : `Kilometres at ${formatLatitude(scale.lat)}`}
            </p>
          </div>
        )}
        <svg
          className="map-key__north"
          viewBox="0 0 24 34"
          role="img"
          aria-label="North is up"
        >
          <path d="M12 2l6 21-6-4.5-6 4.5z" fill={COLOR.ink} />
          <path
            d="M12 2l6 21-6-4.5z"
            fill={COLOR.sheet}
            stroke={COLOR.ink}
            strokeWidth="1"
          />
          <text x="12" y="33" textAnchor="middle">
            n
          </text>
        </svg>
        <button
          type="button"
          className="map-key__toggle"
          aria-expanded={open}
          aria-controls="map-key-body"
          onClick={toggle}
        >
          Key
          <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
            <path d={open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
          </svg>
        </button>
      </div>
    </section>
  );
}

/** The legend's symbol, drawn like T6's map marker of the same class. */
function LegendSymbol({ entry }: { entry: LegendEntry }) {
  const { symbol } = entry;
  if (symbol.kind === 'swatch') {
    return (
      <span
        className="map-key__swatch"
        aria-hidden="true"
        style={{
          backgroundColor: symbol.fill,
          borderColor: symbol.edge,
          backgroundImage: symbol.hatch
            ? `repeating-linear-gradient(135deg, ${symbol.edge} 0 1px, transparent 1px 5px)`
            : undefined,
        }}
      />
    );
  }
  return (
    <svg
      className="map-key__icon"
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
    >
      {symbol.image === MARKER.capital ? (
        <>
          <circle
            cx="10"
            cy="10"
            r="8"
            fill={COLOR.sheet}
            stroke={COLOR.ink}
            strokeWidth="1.6"
          />
          <path
            d="M10 4.2l1.5 4.2h4.4l-3.6 2.6 1.4 4.3L10 12.7l-3.7 2.6 1.4-4.3-3.6-2.6h4.4z"
            fill={COLOR.ink}
          />
        </>
      ) : symbol.image === MARKER.site ? (
        <g fill={COLOR.ink} stroke={COLOR.sheet} strokeWidth="1">
          <circle cx="10" cy="6" r="2.4" />
          <circle cx="6" cy="13" r="2.4" />
          <circle cx="14" cy="13" r="2.4" />
        </g>
      ) : (
        <circle
          cx="10"
          cy="10"
          r="3.8"
          fill={COLOR.ink}
          stroke={COLOR.sheet}
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}
