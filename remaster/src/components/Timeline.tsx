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

/** Pointer travel, in px, before a press on a printed year becomes a drag. */
const DRAG_THRESHOLD_PX = 4;

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
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  // A press that starts on a printed year selects that year unless the
  // pointer then moves far enough to count as a drag.
  const pressRef = useRef<{ x: number; labelIndex: number | null } | null>(
    null,
  );
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
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    trackRef.current?.focus({ preventScroll: true });
    const labelIndex = labelIndexOf(event.target);
    pressRef.current = { x: event.clientX, labelIndex };
    setDragIndex(labelIndex ?? indexFromPointer(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const index = indexFromPointer(event.clientX);
    const press = pressRef.current;
    if (dragIndex !== null) {
      if (
        press?.labelIndex != null &&
        Math.abs(event.clientX - press.x) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      if (press) press.labelIndex = null;
      setDragIndex(index);
    } else if (event.pointerType === 'mouse') setHoverIndex(index);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    const index =
      pressRef.current?.labelIndex ?? indexFromPointer(event.clientX);
    pressRef.current = null;
    setDragIndex(null);
    commit(index, 'track');
  };

  const cancelDrag = () => {
    pressRef.current = null;
    setDragIndex(null);
  };

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
        document.querySelector('dialog[open]')
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
        className="timeline__ruler"
        style={{ '--years': years.length } as CSSProperties}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
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
