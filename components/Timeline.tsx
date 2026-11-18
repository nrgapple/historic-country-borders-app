import React, {
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Icon from './Icon';
import {
  eraOf,
  eraSpans,
  formatYear,
  formatYearLong,
  yearParts,
} from '../lib/years';

export type TimelineChangeMethod = 'step' | 'track' | 'keyboard';

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

const LABEL_CHAR_PX = 6.6;
const LABEL_PADDING_PX = 14;

/**
 * Chooses which ticks get a text label so labels never collide. Era starts are
 * preferred because they anchor the reader; other years fill the gaps.
 */
export const chooseLabelledTicks = (
  years: readonly number[],
  width: number,
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
    0,
    last,
    ...spans.map((span) => span.start),
    ...years.map((_, index) => index),
  ];
  candidates.forEach((index) => {
    if (!chosen.has(index) && fits(index)) chosen.add(index);
  });
  return chosen;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('input, textarea, select, dialog, [role="slider"]'))
    return true;
  // Mapbox uses arrow keys to pan while its canvas has focus.
  return Boolean(target.closest('.mapboxgl-map'));
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

  const lastIndex = years.length - 1;
  const selectedIndex = Math.max(0, years.indexOf(value));
  const displayIndex = dragIndex ?? selectedIndex;
  const displayYear = years[displayIndex];
  const spans = useMemo(() => eraSpans(years), [years]);
  const labelled = useMemo(
    () => chooseLabelledTicks(years, trackWidth),
    [years, trackWidth],
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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    setDragIndex(indexFromPointer(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const index = indexFromPointer(event.clientX);
    if (dragIndex !== null) setDragIndex(index);
    else if (event.pointerType === 'mouse') setHoverIndex(index);
  };

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    const index = indexFromPointer(event.clientX);
    setDragIndex(null);
    commit(index, 'track');
  };

  const cancelDrag = () => setDragIndex(null);

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

          <div className="timeline__current" aria-hidden="true">
            {parts && (
              <>
                <span className="timeline__current-value">{parts.value}</span>
                <span className="timeline__current-suffix">{parts.suffix}</span>
              </>
            )}
            <span className="timeline__current-era">
              {displayYear !== undefined && eraOf(displayYear).label}
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

      <div className="timeline__ruler">
        <div className="timeline__eras" aria-hidden="true">
          {spans.map((span) => (
            <span
              key={span.era.id}
              className="timeline__era"
              data-active={
                displayIndex >= span.start &&
                displayIndex < span.start + span.count
                  ? true
                  : undefined
              }
              style={{ flexGrow: span.count }}
              title={span.era.label}
            >
              <span className="timeline__era-label">{span.era.label}</span>
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
          onPointerLeave={() => setHoverIndex(null)}
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
