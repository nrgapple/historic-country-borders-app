import React, {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Icon from './Icon';
import './Timeline.css';
import {
  type EraSpan,
  eraOf,
  eraSpans,
  formatYear,
  formatYearLong,
  yearParts,
} from '../lib/years';
import { track } from '../lib/analytics';

export type TimelineChangeMethod = 'step' | 'track' | 'keyboard' | 'select';

interface TimelineProps {
  years: readonly number[];
  value: number;
  onChange: (year: number, method: TimelineChangeMethod) => void;
  /** Rendered at the start of the header row (e.g. the brand). */
  leading?: ReactNode;
  /** Rendered at the end of the header row (e.g. the toolbar). */
  trailing?: ReactNode;
}

/** Compact ruler label: "123k BC", "500 BC", "1492". */
export const formatRulerLabel = (year: number) => {
  if (year <= -10000) return `${Math.round(-year / 1000)}k BC`;
  return formatYear(year);
};

/** Direction A ruler years: Alegreya 500 at 15 px (14 px on phones). */
const LABEL_CHAR_PX = 7.4;
const LABEL_PADDING_PX = 16;

/**
 * Chooses which ticks get a text label so labels never collide. The selected
 * year is always printed (Direction A), so the thumb never sits beside a
 * neighbour's label; then both ends, era starts, and other years in order.
 */
export const chooseLabelledTicks = (
  years: readonly number[],
  width: number,
  selected = -1,
): Set<number> => {
  const chosen = new Set<number>();
  if (!years.length || width <= 0) return chosen;
  const step = width / years.length;
  const last = years.length - 1;
  // Horizontal extent of a label; the first and last labels are edge-aligned.
  const extent = (index: number): [number, number] => {
    const labelWidth =
      formatRulerLabel(years[index]).length * LABEL_CHAR_PX + LABEL_PADDING_PX;
    const center = (index + 0.5) * step;
    if (index === 0) return [center - 4, center - 4 + labelWidth];
    if (index === last) return [center + 4 - labelWidth, center + 4];
    return [center - labelWidth / 2, center + labelWidth / 2];
  };
  const fits = (index: number) => {
    const [left, right] = extent(index);
    return Array.from(chosen).every((other) => {
      const [otherLeft, otherRight] = extent(other);
      return right <= otherLeft || left >= otherRight;
    });
  };

  const spans = eraSpans(years);
  const candidates = [
    selected,
    0,
    last,
    ...spans.map((span) => span.start),
    ...years.map((_, index) => index),
  ];
  candidates.forEach((index) => {
    if (index >= 0 && index <= last && !chosen.has(index) && fits(index))
      chosen.add(index);
  });
  return chosen;
};

/**
 * Estimated width of an era name in Alegreya SC: 14 px with 0.1 em tracking
 * (about 9.6 px per character) above a 600 px track, 12 px with 0.04 em
 * (about 8.4 px) below it, plus the band's padding.
 */
const eraLabelWidth = (label: string, width: number, padding: number) =>
  label.length * (width < 600 ? 8.4 : 9.6) + padding;

/**
 * Picks the full era name when it fits its band on the ruler, else the short
 * name, else nothing: Direction A leaves a narrow wash unlabelled rather than
 * clip it (the band keeps the name as its title, and the current era is
 * always named under the year). Before the track is measured the full name
 * is used.
 */
export const eraBandLabel = (
  span: EraSpan,
  totalYears: number,
  width: number,
) => {
  if (width <= 0 || totalYears <= 0) return span.era.label;
  const band = (span.count / totalYears) * width;
  if (eraLabelWidth(span.era.label, width, 14) <= band) return span.era.label;
  if (eraLabelWidth(span.era.shortLabel, width, 8) <= band)
    return span.era.shortLabel;
  return '';
};

/** The span each era covers, printed in italic beside the era name. */
export const ERA_RANGES: Record<string, string> = {
  prehistory: 'before 3000 BC',
  ancient: '3000 BC – AD 499',
  medieval: '500 – 1499',
  'early-modern': '1500 – 1799',
  modern: '1800 – today',
};

/**
 * Pointer travel, in px, before a press counts as a drag: a press on a
 * printed year keeps that year until then, and a cancelled press commits
 * only after it.
 */
const DRAG_THRESHOLD_PX = 4;

/**
 * A touch's pointerdown and touchstart arrive together. Only within this
 * window does one count as the other's twin; later, the earlier press is a
 * stale one whose end was lost, and the new press replaces it.
 */
const TWIN_WINDOW_MS = 300;

const isTwinOf = (press: Press | null, family: PressSource) =>
  press !== null &&
  press.source !== family &&
  press.twin === null &&
  press.pointerType === 'touch' &&
  performance.now() - press.startedAt < TWIN_WINDOW_MS;

/**
 * Which event family drives a press. Pointer events are preferred; Touch
 * Events take a touch only when its pointerdown never reached the ruler
 * (seen on iPad Safari reports), so one gesture is never handled twice.
 */
type PressSource = 'pointer' | 'touch';

interface Press {
  source: PressSource;
  /** pointerId, or Touch.identifier for a touch-driven press. */
  id: number;
  /** The pointerType of a pointer press ('touch' for a touch press). */
  pointerType: string;
  /**
   * The same finger's id in the other event family, once its first event
   * arrived: those events are then ignored (one source per gesture), except
   * that a touchend backstops a pointerup that never comes.
   */
  twin: number | null;
  /** clientX at the press. */
  x: number;
  /** The printed year pressed, until the press becomes a drag. */
  labelIndex: number | null;
  /** The year index currently previewed. */
  index: number;
  /** Whether the pointer has travelled at least DRAG_THRESHOLD_PX. */
  moved: boolean;
  /**
   * For analytics: the input ('mouse', 'touch', 'pen', or 'touch-events'
   * for the Touch Events fallback), start time and starting year index.
   */
  pointer: string;
  startedAt: number;
  startIndex: number;
}

/** One report per page of a stale press replaced by a new one. */
let reportedReplacedPress = false;

/** The touch with this identifier in a TouchList (or an array in tests). */
const findTouch = (list: TouchList | undefined, id: number | null) => {
  if (!list || id === null) return null;
  for (let i = 0; i < list.length; i += 1)
    if (list[i]?.identifier === id) return list[i];
  return null;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('input, textarea, select, dialog, [role="slider"]'))
    return true;
  // MapLibre uses arrow keys to pan while its canvas has focus.
  return Boolean(target.closest('.maplibregl-map'));
};

export default function Timeline({
  years,
  value,
  onChange,
  leading,
  trailing,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // The press in progress, kept in a ref so pointer handlers never depend on
  // when React re-renders (WebKit can deliver capture events between them).
  // A press that starts on a printed year selects that year unless the
  // pointer then moves far enough to count as a drag.
  const pressRef = useRef<Press | null>(null);
  const selectId = useId();

  const lastIndex = years.length - 1;
  const selectedIndex = Math.max(0, years.indexOf(value));
  const displayIndex = dragIndex ?? selectedIndex;
  const displayYear = years[displayIndex];
  const spans = useMemo(() => eraSpans(years), [years]);
  const labelled = useMemo(
    () => chooseLabelledTicks(years, trackWidth, selectedIndex),
    [years, trackWidth, selectedIndex],
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => setTrackWidth(track.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const commit = useCallback(
    (index: number, method: TimelineChangeMethod) => {
      const clamped = Math.min(lastIndex, Math.max(0, index));
      if (years[clamped] !== value) onChange(years[clamped], method);
    },
    [lastIndex, onChange, value, years],
  );

  const indexFromPointer = (clientX: number) => {
    const track = trackRef.current;
    if (!track || years.length === 0) return selectedIndex;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / Math.max(1, rect.width);
    return Math.min(lastIndex, Math.max(0, Math.floor(ratio * years.length)));
  };

  const labelIndexOf = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return null;
    const label = target.closest<HTMLElement>('[data-index]');
    const index = label ? Number(label.dataset.index) : NaN;
    return Number.isInteger(index) ? index : null;
  };

  // The era row, the track, and the printed years all share one hit area.
  // Touch and mouse go through the same path; the year is committed once, on
  // release, so the map loads one year rather than every year passed over.
  //
  // A new press always replaces whatever press the ruler still remembers,
  // without committing it: if a browser ever drops the end of a gesture (a
  // finger lifted off the bar, a system gesture, an edge swipe), the next
  // drag still works instead of being ignored until the page reloads.
  const beginPress = (
    source: PressSource,
    id: number,
    pointerType: string,
    clientX: number,
    target: EventTarget | null,
  ) => {
    const stale = pressRef.current;
    const pointer =
      source === 'touch' ? 'touch-events' : pointerType || 'unknown';
    if (stale && !reportedReplacedPress) {
      // An earlier press never ended; before it was replaced it blocked
      // the timeline until reload (the iPad report, docs/ANALYTICS.md).
      reportedReplacedPress = true;
      track('timeline_press_replaced', {
        pointer,
        stale_ms: Math.round(performance.now() - stale.startedAt),
      });
    }
    trackRef.current?.focus({ preventScroll: true });
    const labelIndex = labelIndexOf(target);
    const index = labelIndex ?? indexFromPointer(clientX);
    pressRef.current = {
      source,
      id,
      pointerType,
      twin: null,
      x: clientX,
      labelIndex,
      index,
      moved: false,
      pointer,
      startedAt: performance.now(),
      startIndex: selectedIndex,
    };
    setHoverIndex(null);
    setDragIndex(index);
  };

  const movePress = (press: Press, clientX: number) => {
    if (!press.moved) {
      if (Math.abs(clientX - press.x) < DRAG_THRESHOLD_PX) {
        // A press on a printed year keeps that year until it becomes a drag.
        if (press.labelIndex != null) return;
      } else {
        press.moved = true;
      }
    }
    press.labelIndex = null;
    press.index = indexFromPointer(clientX);
    setDragIndex(press.index);
  };

  const endPress = (
    press: Press,
    index: number | null,
    lostCapture = false,
  ) => {
    if (pressRef.current !== press) return;
    pressRef.current = null;
    setDragIndex(null);
    // Mouse clicks are already counted as year changes; touch and pen
    // gestures (including the Touch Events fallback's, pointer
    // 'touch-events'), and every cancelled press, are reported for debugging.
    if (press.pointer !== 'mouse' || index === null)
      track('timeline_gesture', {
        outcome: lostCapture
          ? 'lost_capture'
          : index === null
            ? 'cancelled'
            : press.moved
              ? 'committed'
              : 'tap',
        pointer: press.pointer,
        years_moved: index === null ? 0 : Math.abs(index - press.startIndex),
      });
    if (index !== null) commit(index, 'track');
  };

  const releasePress = (press: Press, clientX: number) =>
    endPress(press, press.labelIndex ?? indexFromPointer(clientX));

  // The browser took the gesture (a scroll, a system gesture, an incoming
  // call). After a real horizontal drag the visitor was choosing a year, so
  // the year last shown is kept; a press that had not moved is discarded.
  const cancelPress = (press: Press, lostCapture = false) =>
    endPress(press, press.moved ? press.index : null, lostCapture);

  // A finger's pointer stream ended before it moved while its touch events
  // still come (a WebKit pointercancel or lost capture at the very start of
  // a drag): the touch events carry on with the same press. A real system
  // gesture also sends touchcancel, which then discards it.
  const cancelPointerPress = (press: Press, lostCapture = false) => {
    if (pressRef.current !== press) return;
    if (!press.moved && press.pointerType === 'touch' && press.twin !== null) {
      pressRef.current = {
        ...press,
        source: 'touch',
        id: press.twin,
        twin: press.id,
        pointer: 'touch-events',
      };
      return;
    }
    cancelPress(press, lostCapture);
  };

  /** Forgets the press without choosing a year (the page lost focus). */
  const abandonPress = () => {
    const press = pressRef.current;
    if (press) endPress(press, null);
  };

  const pointerPress = (event: React.PointerEvent | PointerEvent) => {
    const press = pressRef.current;
    return press?.source === 'pointer' && press.id === event.pointerId
      ? press
      : null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.isPrimary === false) return;
    const current = pressRef.current;
    if (
      current &&
      event.pointerType === 'touch' &&
      isTwinOf(current, 'pointer')
    ) {
      // The Touch Events fallback already drives this finger.
      current.twin = event.pointerId;
      return;
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // A synthetic or already-released pointer: the ruler still receives
      // its events while the finger stays over it, and the document-level
      // listeners below still see its end.
    }
    beginPress(
      'pointer',
      event.pointerId,
      event.pointerType,
      event.clientX,
      event.target,
    );
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pointerPress(event);
    if (!press) {
      if (!pressRef.current && event.pointerType === 'mouse')
        setHoverIndex(indexFromPointer(event.clientX));
      return;
    }
    movePress(press, event.clientX);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pointerPress(event);
    if (press) releasePress(press, event.clientX);
  };

  const cancelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const press = pointerPress(event);
    if (press) cancelPointerPress(press);
  };

  // Lost capture without a pointerup or pointercancel (the ruler was hidden
  // or capture was released elsewhere) ends the press like a cancel. Capture
  // events bubble, so only the ruler's own counts, and the end waits a task:
  // WebKit may fire lostpointercapture just before the pointerup it follows.
  const handleLostPointerCapture = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (event.target !== event.currentTarget) return;
    const press = pointerPress(event);
    if (!press) return;
    window.setTimeout(() => cancelPointerPress(press, true), 0);
  };

  // Touch Events, for a touch whose pointer events do not reach the ruler.
  // A touch that follows its own pointerdown is that pointer's twin and is
  // ignored, except that its end also ends the press a task later if the
  // pointerup never came (capture failed and it landed elsewhere).
  const handleTouchStart = (event: TouchEvent) => {
    // A second finger, like a non-primary pointer, is ignored.
    if (event.touches.length !== 1) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const current = pressRef.current;
    if (current && isTwinOf(current, 'touch')) {
      current.twin = touch.identifier;
      return;
    }
    // Stops the page scrolling, zooming or starting a text selection.
    if (event.cancelable) event.preventDefault();
    beginPress('touch', touch.identifier, 'touch', touch.clientX, touch.target);
  };

  const handleTouchMove = (event: TouchEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const touch = findTouch(
      event.changedTouches,
      press.source === 'touch' ? press.id : press.twin,
    );
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    if (press.source === 'touch') movePress(press, touch.clientX);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const press = pressRef.current;
    if (!press) return;
    const cancelled = event.type === 'touchcancel';
    if (press.source === 'touch') {
      const touch = findTouch(event.changedTouches, press.id);
      if (!touch) return;
      // No emulated mouse events or click after a timeline drag.
      if (event.cancelable) event.preventDefault();
      if (cancelled) cancelPress(press);
      else releasePress(press, touch.clientX);
      return;
    }
    const touch = findTouch(event.changedTouches, press.twin);
    if (!touch) return;
    const x = touch.clientX;
    window.setTimeout(() => {
      if (pressRef.current !== press) return;
      if (cancelled) cancelPress(press);
      else releasePress(press, x);
    }, 0);
  };

  // Native listeners read the latest handlers through a ref: React's own
  // touch listeners are passive, so they could not stop the page scrolling.
  const latest = useRef({
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    pointerPress,
    releasePress,
    cancelPointerPress,
    abandonPress,
  });
  latest.current = {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    pointerPress,
    releasePress,
    cancelPointerPress,
    abandonPress,
  };

  useEffect(() => {
    const ruler = rulerRef.current;
    if (!ruler) return;
    const start = (event: TouchEvent) => latest.current.handleTouchStart(event);
    const move = (event: TouchEvent) => latest.current.handleTouchMove(event);
    const end = (event: TouchEvent) => latest.current.handleTouchEnd(event);
    const options = { passive: false } as const;
    ruler.addEventListener('touchstart', start, options);
    ruler.addEventListener('touchmove', move, options);
    ruler.addEventListener('touchend', end, options);
    ruler.addEventListener('touchcancel', end, options);

    // Backstops so a press can never stay stuck: the end of the tracked
    // pointer anywhere on the page (it bubbles here after the ruler's own
    // handler, which has then already ended the press), and the page losing
    // focus or being hidden mid-drag.
    const pointerUp = (event: PointerEvent) => {
      const press = latest.current.pointerPress(event);
      if (press) latest.current.releasePress(press, event.clientX);
    };
    const pointerCancel = (event: PointerEvent) => {
      const press = latest.current.pointerPress(event);
      if (press) latest.current.cancelPointerPress(press);
    };
    const abandon = () => latest.current.abandonPress();
    const visibility = () => {
      if (document.visibilityState === 'hidden') abandon();
    };
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', pointerCancel);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', abandon);
    return () => {
      ruler.removeEventListener('touchstart', start);
      ruler.removeEventListener('touchmove', move);
      ruler.removeEventListener('touchend', end);
      ruler.removeEventListener('touchcancel', end);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', abandon);
    };
  }, []);

  const step = useCallback(
    (delta: number, method: TimelineChangeMethod) =>
      commit(selectedIndex + delta, method),
    [commit, selectedIndex],
  );

  const handleTrackKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -5,
      PageUp: 5,
    };
    if (event.key in moves) {
      event.preventDefault();
      step(moves[event.key], 'keyboard');
    } else if (event.key === 'Home') {
      event.preventDefault();
      commit(0, 'keyboard');
    } else if (event.key === 'End') {
      event.preventDefault();
      commit(lastIndex, 'keyboard');
    }
  };

  // Arrow keys (and the legacy A/D shortcuts) move through time from anywhere
  // on the page unless the visitor is typing or panning the map.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableTarget(event.target) ||
        document.querySelector('dialog[open], .toolbar__overflow[data-open]')
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'arrowleft' || key === 'a') {
        event.preventDefault();
        step(-1, 'keyboard');
      } else if (key === 'arrowright' || key === 'd') {
        event.preventDefault();
        step(1, 'keyboard');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [step]);

  const position = (index: number) =>
    `${((index + 0.5) / Math.max(1, years.length)) * 100}%`;

  const previousYear = selectedIndex > 0 ? years[selectedIndex - 1] : null;
  const nextYear = selectedIndex < lastIndex ? years[selectedIndex + 1] : null;
  const parts = displayYear !== undefined ? yearParts(displayYear) : null;

  return (
    <div className="timeline" data-dragging={dragIndex !== null || undefined}>
      <div className="timeline__head">
        <div className="timeline__leading">{leading}</div>

        <div className="timeline__stepper">
          <button
            type="button"
            className="timeline__step"
            onClick={() => step(-1, 'step')}
            disabled={previousYear === null}
            aria-label={
              previousYear === null
                ? 'Earliest year'
                : `Previous year: ${formatYearLong(previousYear)}`
            }
          >
            <Icon name="chevronLeft" />
            <span className="timeline__step-label">
              {previousYear !== null && formatYear(previousYear)}
            </span>
          </button>

          {/* A native select over the large year: it opens the platform's
              own picker on phones and Chromebooks and lists every year. */}
          <div className="timeline__current">
            <label className="visually-hidden" htmlFor={selectId}>
              Choose a year
            </label>
            <select
              id={selectId}
              className="timeline__select"
              value={years[selectedIndex] ?? ''}
              onChange={(event) =>
                commit(years.indexOf(Number(event.target.value)), 'select')
              }
            >
              {spans.map((span) => (
                <optgroup key={span.era.id} label={span.era.label}>
                  {years
                    .slice(span.start, span.start + span.count)
                    .map((year) => (
                      <option key={year} value={year}>
                        {formatYearLong(year)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <span className="timeline__current-display" aria-hidden="true">
              {parts && (
                <>
                  <span className="timeline__current-value" data-year-heading>
                    {parts.value}
                  </span>
                  <span className="timeline__current-suffix">
                    {parts.suffix}
                    <Icon name="chevronDown" size={14} />
                  </span>
                </>
              )}
              <span className="timeline__current-era">
                {displayYear !== undefined && (
                  <>
                    <span className="timeline__current-era-name">
                      {eraOf(displayYear).label}
                    </span>
                    <span className="timeline__current-range">
                      {ERA_RANGES[eraOf(displayYear).id]}
                    </span>
                  </>
                )}
              </span>
            </span>
          </div>

          <button
            type="button"
            className="timeline__step timeline__step--next"
            onClick={() => step(1, 'step')}
            disabled={nextYear === null}
            aria-label={
              nextYear === null
                ? 'Latest year'
                : `Next year: ${formatYearLong(nextYear)}`
            }
          >
            <span className="timeline__step-label">
              {nextYear !== null && formatYear(nextYear)}
            </span>
            <Icon name="chevronRight" />
          </button>
        </div>

        <div className="timeline__trailing">{trailing}</div>
      </div>

      <div
        ref={rulerRef}
        className="timeline__ruler"
        style={{ '--years': years.length } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <div className="timeline__eras" aria-hidden="true">
          {spans.map((span) => (
            <span
              key={span.era.id}
              className="timeline__era"
              data-era={span.era.id}
              data-active={
                displayIndex >= span.start &&
                displayIndex < span.start + span.count
                  ? true
                  : undefined
              }
              style={{ flexGrow: span.count }}
              title={span.era.label}
            >
              <span className="timeline__era-label">
                {eraBandLabel(span, years.length, trackWidth)}
              </span>
            </span>
          ))}
        </div>

        <div
          ref={trackRef}
          className="timeline__track"
          role="slider"
          tabIndex={0}
          aria-label="Map year"
          aria-valuemin={0}
          aria-valuemax={lastIndex}
          aria-valuenow={selectedIndex}
          aria-valuetext={
            years[selectedIndex] !== undefined
              ? formatYearLong(years[selectedIndex])
              : undefined
          }
          onKeyDown={handleTrackKeyDown}
        >
          <div className="timeline__baseline" />
          {years.map((year, index) => (
            <span
              key={year}
              className="timeline__tick"
              data-major={labelled.has(index) || undefined}
              data-era-start={
                spans.some((span) => span.start === index && index > 0) ||
                undefined
              }
              data-past={index < displayIndex || undefined}
              style={{ left: position(index) }}
            />
          ))}
          {hoverIndex !== null && dragIndex === null && (
            <span
              className="timeline__hover"
              style={{ left: position(hoverIndex) }}
              aria-hidden="true"
            >
              {formatYear(years[hoverIndex])}
            </span>
          )}
          <span
            className="timeline__thumb"
            style={{ left: position(displayIndex) }}
            aria-hidden="true"
          />
        </div>

        <div className="timeline__labels" aria-hidden="true">
          {years.map((year, index) =>
            labelled.has(index) ? (
              <span
                key={year}
                className="timeline__label"
                data-index={index}
                data-era={eraOf(year).id}
                data-active={index === displayIndex || undefined}
                data-edge={
                  index === 0
                    ? 'start'
                    : index === lastIndex
                      ? 'end'
                      : undefined
                }
                style={{ left: position(index) }}
              >
                {formatRulerLabel(year)}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
