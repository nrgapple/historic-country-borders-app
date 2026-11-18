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
import { useAtlas } from '../atlas/store';
import { THEME_TOKENS, type EraId, type ThemeId } from '../styles/tokens';
import type { ColourLegend } from '../pa/colourBy';
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
  /** Year pages: the plate title is the year and its era. */
  year?: number;
  /** Other maps (Pennsylvania): the plate title, set explicitly. */
  plate?: { kicker: string; title: string; sub: string };
  /** The live map, once mounted (from the controller's handle). */
  map?: MapLibreMap | null;
  /** T6's low-power mode: the dependency swatch drops its hatch. */
  lowPower?: boolean;
  /** Called after the key opens or closes, so map labels can move clear of it. */
  onLayout?: () => void;
  /** A bottom sheet (Settings) is open: on phones the key steps aside. */
  underSheet?: boolean;
  /**
   * A legend set by the page (Pennsylvania's "Colour districts by"). When
   * given, it replaces the legend read from the map's drawn classes.
   */
  legend?: ColourLegend | null;
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
  plate,
  map = null,
  lowPower = false,
  onLayout,
  underSheet = false,
  legend: pageLegend = null,
}: MapKeyProps) {
  const theme = useAtlas((s) => s.theme);
  const { color: COLOR, eraTints } = THEME_TOKENS[theme];
  const era = year === undefined ? null : eraOf(year);
  const accent = era
    ? (eraTints[era.id as EraId]?.ink ?? COLOR.ink)
    : COLOR.ink;
  const title =
    plate ??
    (year !== undefined && era
      ? {
          kicker: 'The World in',
          title: formatYear(year),
          sub: `${era.label} era`,
        }
      : null);
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
      const next = legendEntries(drawnClasses(map, lowPower), theme);
      setLegend((prev) => (legendKey(prev) === legendKey(next) ? prev : next));
    };
    const stop = watchMapKey(map, setView, readLegend);
    readLegend();
    return stop;
  }, [map, lowPower, theme]);

  // Opening the key: read the legend now (the map may already be idle),
  // fetch the globe's land the first time, and let labels move clear of it.
  useEffect(() => {
    if (open && map) {
      const next = legendEntries(drawnClasses(map, lowPower), theme);
      setLegend((prev) => (legendKey(prev) === legendKey(next) ? prev : next));
    }
    if (open && !land) void loadGlobeLand().then(setLand);
    if (!onLayout) return;
    const frame = requestAnimationFrame(() => onLayout());
    return () => cancelAnimationFrame(frame);
  }, [open, map, lowPower, land, onLayout, theme]);

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
  }, [view, land, open, accent, COLOR]);

  const toggle = () => {
    const next = !open;
    setChoice(next);
    if (!compact) store(next);
  };

  const scale: ScaleBar | null = view
    ? scaleBar(view.center[1], view.zoom, compact ? 96 : 112, 48)
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
          {title && (
            <div className="map-key__plate">
              <p className="map-key__kicker">{title.kicker}</p>
              <p
                className="map-key__title"
                data-long={title.title.length > 8 || undefined}
              >
                {title.title}
              </p>
              <p className="map-key__sub">{title.sub}</p>
            </div>
          )}
        </div>
        {pageLegend && <PageLegend legend={pageLegend} />}
        {!pageLegend && legend.length > 0 && (
          <ul className="map-key__legend" aria-label="Legend">
            {legend.map((entry) => (
              <li key={entry.id} className="map-key__item">
                <LegendSymbol entry={entry} theme={theme} />
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

/** A page-supplied legend: a title, swatches with counts, and a note. */
function PageLegend({ legend }: { legend: ColourLegend }) {
  return (
    <div className="map-key__page-legend" data-testid="map-key-legend">
      <p className="map-key__legend-title">{legend.title}</p>
      <ul
        className="map-key__legend"
        aria-label={legend.title}
        data-columns={legend.columns}
        style={
          legend.columns
            ? { gridTemplateColumns: `repeat(${legend.columns}, auto)` }
            : undefined
        }
      >
        {legend.entries.map((entry) => (
          <li key={entry.id} className="map-key__item">
            <span
              className="map-key__swatch"
              aria-hidden="true"
              style={{
                backgroundColor: entry.fill,
                borderColor: entry.edge,
                backgroundImage: entry.hatch
                  ? `repeating-linear-gradient(135deg, ${entry.hatch} 0 1px, transparent 1px 5px)`
                  : undefined,
              }}
            />
            <span>
              {entry.label}
              {entry.count && (
                <span className="map-key__count"> · {entry.count}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {legend.note && <p className="map-key__legend-note">{legend.note}</p>}
    </div>
  );
}

/** The legend's symbol, drawn like the theme's map marker of the same class. */
function LegendSymbol({
  entry,
  theme,
}: {
  entry: LegendEntry;
  theme: ThemeId;
}) {
  const { symbol } = entry;
  const { color: COLOR } = THEME_TOKENS[theme];
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
      {symbol.image === MARKER.capital && theme === 'textbook' ? (
        // B's capital: an ink star with a white keyline (the selected
        // territory's capital is the same star in the map accent).
        <path
          d="M10 1.8l2.3 5.3 5.7.5-4.3 3.8 1.3 5.6L10 14l-5 3 1.3-5.6L2 7.6l5.7-.5z"
          fill={COLOR.ink}
          stroke={COLOR.sheet}
          strokeWidth="1.4"
        />
      ) : symbol.image === MARKER.capital ? (
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
