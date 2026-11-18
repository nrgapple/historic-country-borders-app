import { useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react';
import { actions, getState, subscribe, type AtlasState } from './store';
import { loadIndex, YEARS, type Territory } from './data';
import { eraOf, ERAS, formatYear, formatYearLong } from './years';
import type { mountMap as MountMap } from './map';

// Start fetching MapLibre (its own chunk) the moment this island's module runs,
// in parallel with hydration, instead of after the first effect.
const mapModule = typeof window === 'undefined' ? null : import('./map');

let primed = false;
function useAtlasState(initialYear: number): AtlasState {
  if (typeof window !== 'undefined' && !primed) {
    primed = true;
    actions.init(initialYear);
  }
  const server: AtlasState = { year: initialYear, selected: null, status: 'loading' };
  return useSyncExternalStore(subscribe, getState, () => server);
}

const PRECISION: Record<number, string> = { 1: 'Approximate', 2: 'Moderately precise', 3: 'Set by treaty or law' };

export default function Atlas({ initialYear }: { initialYear: number }) {
  const { year, selected, status } = useAtlasState(initialYear);
  const index = YEARS.indexOf(year);
  const prev = YEARS[index - 1];
  const next = YEARS[index + 1];

  useEffect(() => {
    document.title = `World borders in ${formatYearLong(year)} · Historic Borders`;
  }, [year]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.altKey || e.ctrlKey || e.metaKey || t.closest('input, select, textarea, .maplibregl-canvas-container')) return;
      const i = YEARS.indexOf(getState().year);
      if (e.key === 'ArrowRight' && YEARS[i + 1] !== undefined) actions.setYear(YEARS[i + 1]);
      else if (e.key === 'ArrowLeft' && YEARS[i - 1] !== undefined) actions.setYear(YEARS[i - 1]);
      else if (e.key === 'Escape') actions.select(null);
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="atlas" data-status={status}>
      <header className="atlas__header">
        <a className="brand" href="/">Historic Borders</a>
        <h1 className="year" aria-live="polite">
          <span className="year__value">{formatYear(year).replace(' BC', '')}</span>
          <span className="year__suffix">{year < 0 ? 'BC' : 'AD'}</span>
          <span className="year__era">{eraOf(year).label}</span>
        </h1>
        <PlaceFinder year={year} />
      </header>
      <MapView />
      <PlacePanel year={year} selected={selected} />
      <p className="status" role="status">{status === 'loading' ? `Loading the ${formatYearLong(year)} map…` : status === 'error' ? 'The map data could not be loaded.' : ''}</p>
      <Timeline year={year} prev={prev} next={next} />
    </div>
  );
}

function MapView() {
  const ref = useRef<HTMLDivElement>(null);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    let handle: ReturnType<typeof MountMap> | undefined;
    let cancelled = false;
    void mapModule!.then(({ mountMap, supportsWebGL2 }) => {
      if (cancelled || !ref.current) return;
      if (!supportsWebGL2()) return setWebgl(false);
      handle = mountMap(ref.current);
      (window as unknown as { __atlasMap: typeof handle }).__atlasMap = handle;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);
  if (!webgl) {
    return (
      <div className="map map--unavailable" role="alert">
        <p><strong>This device can’t draw the interactive map.</strong> It needs WebGL 2, which is turned off or unsupported here.</p>
        <p>The timeline and the <a href="#territories">list of territories on this map</a> still work.</p>
      </div>
    );
  }
  return <div ref={ref} className="map" role="region" aria-label="Historical map" />;
}

function useTerritories(year: number) {
  const [territories, setTerritories] = useState<Territory[] | null>(null);
  useEffect(() => {
    let live = true;
    loadIndex(year).then((ix) => live && setTerritories(ix.territories), () => live && setTerritories(null));
    return () => void (live = false);
  }, [year]);
  return territories;
}

function PlacePanel({ year, selected }: { year: number; selected: string | null }) {
  const territories = useTerritories(year);
  if (!selected) return null;
  const t = territories?.find((x) => x[0] === selected);
  const facts: [string, string][] = [];
  if (t?.[1] && t[1] !== t[0]) facts.push(['Part of', t[1]]);
  if (t?.[2] && t[2] !== t[0] && t[2] !== t[1]) facts.push(['Subject to', t[2]]);
  if (t?.[3] && PRECISION[t[3]]) facts.push(['Border precision', PRECISION[t[3]]]);
  return (
    <aside className="panel" aria-labelledby="panel-title">
      <p className="panel__kicker">{formatYearLong(year)}</p>
      <h2 id="panel-title" className="panel__title">{selected}</h2>
      {facts.length > 0 && (
        <dl className="panel__facts">
          {facts.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      )}
      <button type="button" className="panel__close" onClick={() => actions.select(null)} aria-label="Close details">×</button>
    </aside>
  );
}

function PlaceFinder({ year }: { year: number }) {
  const territories = useTerritories(year);
  const names = territories ? [...new Set(territories.map((t) => t[0]))].sort((a, b) => a.localeCompare(b)) : [];
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const t = territories?.find((x) => x[0] === e.target.value);
    if (!t) return;
    actions.select(t[0]);
    (window as unknown as { __atlasMap?: { flyToBounds(b: Territory[4]): void } }).__atlasMap?.flyToBounds(t[4]);
    e.target.value = '';
  };
  return (
    <label className="finder">
      <span className="visually-hidden">Find a place on this map</span>
      <input type="search" list="finder-names" placeholder="Find a place…" onChange={onChange} disabled={!territories} />
      <datalist id="finder-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
    </label>
  );
}

function Timeline({ year, prev, next }: { year: number; prev?: number; next?: number }) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? year;
  const range = useRef<HTMLInputElement>(null);
  // Native 'change' fires on release (pointer) or per key press: commit then,
  // so dragging across 40 years downloads only the year the student stops on.
  useEffect(() => {
    const el = range.current!;
    const commit = () => {
      setPreview(null);
      actions.setYear(YEARS[Number(el.value)]);
    };
    el.addEventListener('change', commit);
    return () => el.removeEventListener('change', commit);
  }, []);
  return (
    <nav className="timeline" aria-label="Timeline">
      <button type="button" onClick={() => prev !== undefined && actions.setYear(prev)} disabled={prev === undefined}>
        ‹ <span className="visually-hidden">Previous year:</span> {prev !== undefined ? formatYear(prev) : ''}
      </button>
      <div className="timeline__track">
        <input
          ref={range}
          type="range"
          min={0}
          max={YEARS.length - 1}
          step={1}
          value={YEARS.indexOf(shown)}
          aria-label="Year"
          aria-valuetext={formatYearLong(shown)}
          onChange={(e) => setPreview(YEARS[Number(e.target.value)])}
        />
        <div className="timeline__eras" aria-hidden="true">
          {ERAS.map((era) => {
            const first = YEARS.findIndex((y) => eraOf(y).id === era.id);
            const count = YEARS.filter((y) => eraOf(y).id === era.id).length;
            return <span key={era.id} style={{ flexGrow: count }} data-active={eraOf(shown).id === era.id || undefined}>{count > 4 || first < 0 ? era.label : ''}</span>;
          })}
        </div>
      </div>
      <label className="timeline__chooser">
        <span className="visually-hidden">Choose a year</span>
        <select value={year} onChange={(e) => actions.setYear(Number(e.target.value))}>
          {YEARS.map((y) => <option key={y} value={y}>{formatYear(y)}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => next !== undefined && actions.setYear(next)} disabled={next === undefined}>
        <span className="visually-hidden">Next year:</span> {next !== undefined ? formatYear(next) : ''} ›
      </button>
    </nav>
  );
}
