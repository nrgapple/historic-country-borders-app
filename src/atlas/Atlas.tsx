import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Timeline, { type TimelineChangeMethod } from '../components/Timeline';
import Toolbar, { Brand, RestoreControlsButton } from '../components/Toolbar';
import PlacePanel from '../components/PlacePanel';
import SettingsPanel from '../components/SettingsPanel';
import { initAnalytics, track, trackPageview } from '../lib/analytics';
import AboutDialog from '../components/AboutDialog';
import FeedbackDialog from '../components/FeedbackDialog';
import MapStatus from '../components/MapStatus';
import ChangesSummary from '../components/ChangesSummary';
import PlaceFinder from '../components/PlaceFinder';
import ProjectorCaption from '../components/ProjectorCaption';
import LifespanBar from '../components/LifespanBar';
import MapKeySlot from '../components/MapKeySlot';
import Welcome from '../components/Welcome';
import {
  framingBounds,
  useYearIndex,
  type Territory,
} from '../adapters/yearData';
import { useYearContext } from '../hooks/useYearContext';
import { wikidataUrl } from '../lib/yearContext';
import type { PlaceOption } from '../lib/places';
import { formatYearLong } from '../lib/years';
import sources from '../data/sources.json';
import { panelFacts, territorySubtitle } from './facts';
import { actions, InitialYear, useAtlas, YEARS } from './store';
import { useWelcome } from './useWelcome';
import type { MapHandle } from './mapController';

// Start fetching MapLibre (its own chunk) as soon as the island's module
// runs, in parallel with hydration, instead of after the first effect.
const mapModule =
  typeof window === 'undefined' ? null : import('./mapController');

const SHORTCUTS = [
  {
    keys: ['←', '→'],
    action: 'Previous or next year (when the map is not focused)',
  },
  {
    keys: ['Home', 'End'],
    action: 'First or last year (when the timeline is focused)',
  },
  {
    keys: ['←', '↑', '→', '↓'],
    action: 'Pan the map (when the map is focused)',
  },
  { keys: ['Esc'], action: 'Close the details panel' },
];

const sourceDate = new Date(sources.historical.commitDate);

/** Closing the welcome returns focus to About, where it can be reopened. */
const closeWelcome = () => {
  const hadFocus = document.activeElement?.closest('.welcome');
  actions.closeOverlay();
  if (hadFocus)
    document
      .querySelector<HTMLElement>('.toolbar [aria-label="About this map"]')
      ?.focus();
};

const territoryOption = (t: Territory): PlaceOption => {
  const partOf = t.PARTOF?.trim();
  return {
    name: t.NAME,
    label: t.NAME,
    detail: partOf && partOf !== t.NAME ? `Part of ${partOf}` : undefined,
    keywords: [],
  };
};

/** The atlas island: one React tree over the store, rendered into /year/[year]. */
export default function Atlas({ initialYear }: { initialYear: number }) {
  if (typeof window !== 'undefined') {
    actions.init(initialYear);
    // Idempotent; GA itself loads when the page is idle.
    initAnalytics('year');
  }
  return (
    <InitialYear.Provider value={initialYear}>
      <AtlasApp />
    </InitialYear.Provider>
  );
}

function AtlasApp() {
  const year = useAtlas((s) => s.year);
  const place = useAtlas((s) => s.place);
  const status = useAtlas((s) => s.status);
  const focusMode = useAtlas((s) => s.focusMode);
  const webgl = useAtlas((s) => s.webgl);
  const projectorText = useAtlas((s) => s.settings.projectorText);
  const overlay = useAtlas((s) => s.overlay);
  const welcomeOpen = useWelcome();
  const welcomeView = useAtlas((s) => s.welcomeView);
  const welcomeAuto = useAtlas((s) => s.welcomeAuto);
  const index = useYearIndex(year);
  // The controller's handle, for the map key (camera, drawn classes, labels).
  const [mapHandle, setMapHandle] = useState<MapHandle | null>(null);
  const yearContext = useYearContext(year);
  const yearLabel = formatYearLong(year);

  useEffect(() => {
    document.title = `World borders in ${yearLabel} · Historic Borders`;
    // One page view per year shown (src/lib/analytics.ts).
    trackPageview(year);
  }, [yearLabel, year]);

  // Without WebGL the map never reports; the index decides the status.
  useEffect(() => {
    if (webgl) return;
    if (index.error) actions.setStatus('error');
    else if (index.value && !index.isLoading) actions.setStatus('ready');
  }, [webgl, index.value, index.isLoading, index.error]);

  const territories = index.value?.territories;
  const territory = territories?.find((t) => t.NAME === place);
  const options = useMemo(
    () => (territories ? territories.map(territoryOption) : []),
    [territories],
  );

  const setYear = useCallback(
    (next: number, method: TimelineChangeMethod) =>
      actions.setYear(next, method),
    [],
  );
  const handleFind = useCallback(
    (option: PlaceOption) => {
      const match = territories?.find((t) => t.NAME === option.name);
      if (!match) return;
      actions.select(match.NAME, { track: true, source: 'finder' });
      actions.frame(framingBounds(match.bbox));
    },
    [territories],
  );
  const closePanel = useCallback(() => actions.select(null), []);
  const context = yearContext.current;
  const placeContext = place ? context?.places[place] : undefined;
  const loading = status === 'loading';

  return (
    <div className="atlas" data-focus={focusMode || undefined}>
      <h1 className="visually-hidden">Political borders in {yearLabel}</h1>

      {!focusMode && (
        <header className="topbar paper-grain">
          <Timeline
            years={YEARS}
            value={year}
            onChange={setYear}
            leading={<Brand />}
            trailing={
              <div className="topbar__tools">
                <PlaceFinder
                  options={options}
                  onSelect={handleFind}
                  placeholder={`Find a place in ${yearLabel.replace(/ AD$/, '')}`}
                  collapsible
                />
                <Toolbar />
              </div>
            }
          />
          <SettingsPanel animation />
        </header>
      )}

      <main
        className="stage"
        data-testid="map-container"
        data-data-state={status === 'error' ? 'unavailable' : status}
        data-feature-count={status === 'ready' ? (territories?.length ?? 0) : 0}
        data-panel-open={
          (!focusMode && Boolean(place && territory)) || undefined
        }
      >
        {!focusMode && welcomeOpen && (
          <Welcome
            view={welcomeView}
            onViewChange={actions.setWelcomeView}
            onClose={closeWelcome}
            autoFocus={!welcomeAuto}
          />
        )}

        <div className="frame">
          <MapView yearLabel={yearLabel} onMount={setMapHandle} />
        </div>

        <MapStatus
          isLoading={loading}
          error={status === 'error' ? new Error('unavailable') : undefined}
          onRetry={() => {
            index.retry();
            actions.retry();
          }}
          loadingLabel={`Loading borders for ${yearLabel}`}
          readyLabel={`Showing borders for ${yearLabel}`}
        />

        {!focusMode && (
          <MapKeySlot
            year={year}
            map={mapHandle?.map}
            lowPower={mapHandle?.lowPower}
            onLayout={mapHandle?.refreshLabels}
            underSheet={overlay === 'settings'}
          />
        )}

        {!focusMode && (
          <p className="credit">
            Borders are reconstructions; many were approximate or contested.
            Borders: Historical Basemaps (GPL-3.0) · Coasts, rivers, relief:
            Natural Earth
          </p>
        )}

        {focusMode && (
          <>
            <ProjectorCaption
              title={yearLabel}
              place={territory ? (place ?? undefined) : undefined}
            />
            <div className="focus-tools">
              {!projectorText && (
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    actions.updateSettings({ projectorText: true })
                  }
                >
                  Use projector text
                </button>
              )}
              <RestoreControlsButton />
            </div>
          </>
        )}

        {!focusMode && place && territory && (
          <PlacePanel
            eyebrow={`Territory · Map of ${yearLabel.replace(/ AD$/, '')}`}
            name={place}
            subtitle={territorySubtitle(territory)}
            factsTitle={`In ${yearLabel.replace(/ AD$/, '')}`}
            facts={panelFacts(territory, context, place)}
            onClose={closePanel}
          >
            <LifespanBar
              existed={placeContext?.existed}
              year={year}
              href={placeContext ? wikidataUrl(placeContext.qid) : undefined}
            />
          </PlacePanel>
        )}

        {!focusMode && !place && (
          <ChangesSummary context={yearContext.value} year={year} />
        )}
      </main>

      <FeedbackDialog />
      <AboutDialog
        shortcuts={SHORTCUTS}
        onWelcome={actions.openWelcome}
        sources={
          <>
            <p>
              Borders come from the{' '}
              <a
                href="https://github.com/aourednik/historical-basemaps"
                target="_blank"
                rel="noreferrer"
              >
                historical-basemaps
              </a>{' '}
              project (snapshot of{' '}
              {sourceDate.toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric',
                timeZone: 'UTC',
              })}
              ,{' '}
              <a
                href={sources.historical.licenseUrl}
                target="_blank"
                rel="noreferrer"
              >
                GPL-3.0
              </a>
              ). {sources.historical.provenanceNote}
            </p>
            <p>
              Each map is a snapshot around one year. Borders are
              reconstructions: most are approximate, some were contested, and
              many peoples had no fixed borders at all.{' '}
              <a
                href="https://github.com/aourednik/historical-basemaps/issues"
                target="_blank"
                rel="noreferrer"
              >
                Report a border error to the map data project
              </a>
              .
            </p>
            <p>
              When you change the year, the borders flow from one map to the
              next. The animation only shows where the borders ended up; it does
              not show the order in which events happened. Turn it off in Map
              settings.
            </p>
            <p>
              Coastlines, lakes, rivers and relief come from{' '}
              <a
                href="https://www.naturalearthdata.com/"
                target="_blank"
                rel="noreferrer"
              >
                Natural Earth
              </a>{' '}
              (public domain); every map file is served from this site.
              Summaries from Wikipedia (CC BY-SA 4.0). Capitals, rulers, and
              dates from{' '}
              <a
                href="https://www.wikidata.org/"
                target="_blank"
                rel="noreferrer"
              >
                Wikidata
              </a>{' '}
              (CC0), matched to these maps by name and reviewed; most peoples
              and cultures on early maps have no such facts.
            </p>
          </>
        }
      />
    </div>
  );
}

function MapView({
  yearLabel,
  onMount,
}: {
  yearLabel: string;
  onMount: (handle: MapHandle | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const webgl = useAtlas((s) => s.webgl);

  useEffect(() => {
    let handle: MapHandle | undefined;
    let cancelled = false;
    mapModule
      ?.then(({ mountMap, supportsWebGL2 }) => {
        if (cancelled || !ref.current) return;
        if (!supportsWebGL2()) {
          actions.setWebgl(false);
          track('map_unavailable', { page_type: 'year', reason: 'no_webgl2' });
          return;
        }
        handle = mountMap(ref.current);
        // Test and screenshot hook (e2e, scripts/shoot.mjs); the app uses the handle.
        (window as unknown as { __atlasMap?: MapHandle['map'] }).__atlasMap =
          handle.map;
        onMount(handle);
      })
      .catch((error) => {
        actions.setWebgl(false);
        track('map_unavailable', {
          page_type: 'year',
          reason: error instanceof Error ? error.name : 'mount_failed',
        });
      });
    return () => {
      cancelled = true;
      onMount(null);
      handle?.destroy();
    };
  }, [onMount]);

  useEffect(() => {
    if (webgl) delete document.documentElement.dataset.webgl;
    else document.documentElement.dataset.webgl = 'none';
  }, [webgl]);

  if (!webgl) {
    return (
      <div className="map-canvas map-canvas--unavailable" role="alert">
        <p>
          <strong>This device can’t draw the interactive map.</strong> It needs
          WebGL 2, which is turned off or unsupported here.
        </p>
        <p>
          The timeline and the{' '}
          <a href="#territories">list of territories on this map</a> still work.
        </p>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="map-canvas"
      role="region"
      aria-label={`Map of the world in ${yearLabel}`}
    />
  );
}
