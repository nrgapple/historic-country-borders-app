import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Toolbar, { Brand, RestoreControlsButton } from '../components/Toolbar';
import PlacePanel from '../components/PlacePanel';
import SettingsPanel from '../components/SettingsPanel';
import AboutDialog from '../components/AboutDialog';
import FeedbackDialog from '../components/FeedbackDialog';
import MapStatus from '../components/MapStatus';
import PlaceFinder from '../components/PlaceFinder';
import ProjectorCaption from '../components/ProjectorCaption';
import MapKeySlot from '../components/MapKeySlot';
import type { PlaceOption } from '../lib/places';
import { trackEvent } from '../lib/analytics';
import {
  actions,
  getState,
  InitialYear,
  useAtlas,
  YEARS,
} from '../atlas/store';
import type { MapHandle } from '../atlas/mapController';
import pa from '../data/pa.json';
import {
  CLASS_PREFIX,
  classRank,
  COUNTY_PREFIX,
  countyBounds,
  countyName,
  districtFacts,
  districtFullName,
  finderOptions,
  formatVintage,
  groupMembers,
  PIAA_PREFIX,
  sportsFacts,
  text,
  titleCase,
  unionBounds,
} from './districts';
import { replaceSearch } from '../lib/mapView';
import {
  colourLegend,
  colourSearch,
  parseColourBy,
  piaaName,
} from './colourBy';
import ColourByField from './ColourByField';
import {
  STALE_AFTER_MONTHS,
  usePASchoolDistricts,
  type District,
  type DistrictSports,
} from './usePASchoolDistricts';
import './pa.css';

const mapModule = typeof window === 'undefined' ? null : import('./paMap');

/**
 * The store's year is not shown on this page; the latest map year sets the
 * modern era accent, matching the prerendered `<html data-era="modern">`.
 */
export const PA_STORE_YEAR = YEARS[YEARS.length - 1];

const DISTRICT_COUNT = pa.districtCount;
const PASDA_HOME = 'https://www.pasda.psu.edu/';
const SPORTS = pa.sports;
const PIAA_HOME = SPORTS.url;

let sharedColourApplied = false;
/** A shared `?colour=` link wins over the stored choice, once per page load. */
const applySharedColour = () => {
  if (sharedColourApplied) return;
  sharedColourApplied = true;
  const shared = parseColourBy(window.location.search);
  if (shared && shared !== getState().settings.paColourBy)
    actions.updateSettings({ paColourBy: shared });
};

const SHORTCUTS = [
  {
    keys: ['←', '↑', '→', '↓'],
    action: 'Pan the map (when the map is focused)',
  },
  { keys: ['+', '−'], action: 'Zoom in or out (when the map is focused)' },
  { keys: ['Esc'], action: 'Close the details panel' },
];

/** The atlas island for /pa/school-districts, over the same store as the year pages. */
export default function SchoolDistrictsAtlas() {
  if (typeof window !== 'undefined') {
    actions.init(PA_STORE_YEAR, { themeScope: 'pa' });
    applySharedColour();
  }
  return (
    <InitialYear.Provider value={PA_STORE_YEAR}>
      <PaApp />
    </InitialYear.Provider>
  );
}

function PaApp() {
  // The controller's handle, for the map key (globe and scale bar).
  const [mapHandle, setMapHandle] = useState<MapHandle | null>(null);
  const place = useAtlas((s) => s.place);
  const overlay = useAtlas((s) => s.overlay);
  const focusMode = useAtlas((s) => s.focusMode);
  const webgl = useAtlas((s) => s.webgl);
  const projectorText = useAtlas((s) => s.settings.projectorText);
  const colourBy = useAtlas((s) => s.settings.paColourBy);
  const theme = useAtlas((s) => s.theme);
  const { data, isLoading, isEmpty, isError, isStale, retry } =
    usePASchoolDistricts();

  const districts = data?.districts;
  const selection: District | undefined = place
    ? districts?.find((d) => d.NAME === place)
    : undefined;
  const options = useMemo(
    () => (districts ? finderOptions(districts) : []),
    [districts],
  );
  const legend = useMemo(
    () =>
      colourLegend(
        colourBy,
        (districts ?? []).map((d) => ({
          f: classRank(d.sports?.football),
          p: d.sports?.piaa ?? 0,
          e: d.sports?.enrollment ?? 0,
        })),
        data?.sportsSource?.season ?? SPORTS.season,
        theme,
      ),
    [colourBy, districts, data, theme],
  );

  // The colouring is shareable: mirror it to `?colour=` (absent for the default).
  useEffect(() => {
    const next = colourSearch(window.location.search, colourBy);
    if (next !== window.location.search) replaceSearch(next);
  }, [colourBy]);

  const handleFind = useCallback(
    (option: PlaceOption) => {
      if (!districts) return;
      if (option.name.startsWith(COUNTY_PREFIX)) {
        const bounds = countyBounds(
          districts,
          option.name.slice(COUNTY_PREFIX.length),
        );
        if (bounds) actions.frame(bounds);
        return;
      }
      // "PIAA District III" or "6A football": frame the group, colour by it.
      if (
        option.name.startsWith(PIAA_PREFIX) ||
        option.name.startsWith(CLASS_PREFIX)
      ) {
        const bounds = unionBounds(
          groupMembers(districts, option.name).map((d) => d.bbox),
        );
        actions.updateSettings({
          paColourBy: option.name.startsWith(PIAA_PREFIX) ? 'piaa' : 'football',
        });
        if (bounds) actions.frame(bounds);
        return;
      }
      const match = districts.find((d) => d.NAME === option.name);
      if (!match) return;
      trackEvent('district_select', { name: match.NAME });
      actions.select(match.NAME);
      actions.frame(match.bbox);
    },
    [districts],
  );
  const closePanel = useCallback(() => actions.select(null), []);

  const dataState = isLoading
    ? 'loading'
    : isError
      ? 'unavailable'
      : isEmpty
        ? 'empty'
        : data
          ? 'ready'
          : 'unavailable';
  const vintage = data && !isEmpty ? data.source.vintage : undefined;
  const sportsSource = data?.sportsSource ?? SPORTS;
  const metadataUrl = data?.source.metadataUrl ?? pa.metadataUrl;
  const fullName = selection ? districtFullName(selection) : undefined;
  const panelOpen = !focusMode && Boolean(selection);

  return (
    <div className="atlas" data-focus={focusMode || undefined}>
      <h1 className="visually-hidden">Pennsylvania school districts</h1>

      {!focusMode && (
        <header className="topbar paper-grain">
          <div className="pa-bar">
            <div className="pa-bar__leading">
              <Brand
                subtitle=""
                compactTitle="PA school districts"
                compactDetail={
                  vintage
                    ? `Boundaries ${formatVintage(vintage, 'short')}`
                    : undefined
                }
              />
            </div>
            <div className="pa-bar__plate">
              <p className="pa-bar__title">Pennsylvania School Districts</p>
              <p className="pa-bar__meta">
                {vintage && (
                  <>
                    Boundaries {formatVintage(vintage)}
                    <span aria-hidden="true"> · </span>
                    <a href={metadataUrl} target="_blank" rel="noreferrer">
                      PASDA source
                    </a>
                  </>
                )}
                {isEmpty && !isError && 'No school districts are available.'}
              </p>
            </div>
            <div className="pa-bar__trailing">
              <div className="topbar__tools">
                <PlaceFinder
                  options={options}
                  onSelect={handleFind}
                  label="Find a district or county"
                  placeholder="Find a district or county"
                  collapsible
                />
                <Toolbar />
              </div>
            </div>
          </div>
          <SettingsPanel>
            <ColourByField />
          </SettingsPanel>
          {isStale && vintage && (
            <p className="pa-banner" role="note">
              These boundaries are from {formatVintage(vintage)}, more than{' '}
              {STALE_AFTER_MONTHS} months ago. Verify current boundaries with
              your district.
            </p>
          )}
        </header>
      )}

      <main
        className="stage"
        data-testid="pa-school-districts-map-container"
        data-data-state={dataState}
        data-feature-count={districts?.length ?? 0}
        data-panel-open={panelOpen || undefined}
      >
        <div className="frame">
          <PaMapView onMount={setMapHandle} />
        </div>

        <MapStatus
          isLoading={isLoading}
          error={isError}
          onRetry={() => {
            retry();
            actions.retry();
          }}
          loadingLabel={`Loading ${DISTRICT_COUNT} district boundaries`}
          readyLabel="School district map ready"
          errorLabel="School district map data is unavailable."
        />

        {!focusMode && (
          <MapKeySlot
            map={mapHandle?.map}
            lowPower={mapHandle?.lowPower}
            underSheet={overlay === 'settings'}
            legend={legend}
            plate={{
              kicker: 'Commonwealth of',
              title: 'Pennsylvania',
              sub: `${DISTRICT_COUNT} public school districts`,
            }}
          />
        )}

        {!focusMode && (
          <p className="credit">
            Boundaries are for reference only; confirm a home’s school with the
            district. Districts: PennDOT via PASDA · Sports: PIAA · Streets and
            places: © OpenStreetMap contributors (ODbL), Protomaps
          </p>
        )}

        {focusMode && (
          <>
            <ProjectorCaption title="PA school districts" place={fullName} />
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

        {panelOpen && selection && fullName && (
          <PlacePanel
            eyebrow={
              vintage
                ? `School district · Boundaries ${formatVintage(vintage, 'short')}`
                : 'School district'
            }
            name={fullName}
            subtitle={districtSubtitle(selection)}
            factsTitle="District"
            facts={[
              ...districtFacts(selection),
              ...sportsFacts(selection.sports, sportsSource),
            ]}
            wikiQuery={`${fullName} Pennsylvania`}
            onClose={closePanel}
          >
            {selection.sports !== undefined && (
              <SportsSection
                sports={selection.sports}
                season={sportsSource.season}
                enrollmentDate={sportsSource.enrollmentDate}
              />
            )}
            <section
              className="place-panel__section pa-provenance"
              aria-labelledby="pa-provenance-title"
            >
              <h3 className="section-label" id="pa-provenance-title">
                Boundary source
              </h3>
              <p>
                {data?.source.publisher ?? 'PennDOT'}, distributed by{' '}
                <a href={metadataUrl} target="_blank" rel="noreferrer">
                  PASDA
                </a>
                {vintage ? `, ${formatVintage(vintage)}` : ''}.
              </p>
              <p className="pa-provenance__caveat">
                Boundaries are for reference only. To confirm which school a
                home is assigned to, contact the school district; enrollment
                follows the district’s own records, not this map.
              </p>
              <p>
                To correct a boundary, contact PennDOT, which publishes it
                through{' '}
                <a href={metadataUrl} target="_blank" rel="noreferrer">
                  PASDA
                </a>
                .
              </p>
            </section>
          </PlacePanel>
        )}
      </main>

      <FeedbackDialog
        corrections={
          <>
            To correct a district boundary, contact PennDOT, which publishes the
            boundaries through{' '}
            <a
              href={data?.source.metadataUrl ?? PASDA_HOME}
              target="_blank"
              rel="noreferrer"
            >
              PASDA
            </a>
            . For enrollment questions, contact the school district. Street or
            place names come from{' '}
            <a
              href="https://www.openstreetmap.org/fixthemap"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap
            </a>
            , which anyone can correct.
          </>
        }
      />
      <AboutDialog
        intro={
          <>
            <p className="dialog__lede">
              This map shows the boundaries of Pennsylvania&rsquo;s{' '}
              {DISTRICT_COUNT} public school districts. Select a district to see
              its county, intermediate unit, and career and technical school.
            </p>
            <p>
              With “Colour districts by” in Settings, the map can also show each
              district’s PIAA football class, its PIAA district, or the size of
              its high schools.
            </p>
            <p className="about__caveat">
              Boundaries are for reference only. To confirm which school a home
              is assigned to, contact the school district.
            </p>
          </>
        }
        shortcuts={SHORTCUTS}
        sources={
          <>
            <p>
              District boundaries are the{' '}
              {data ? formatVintage(data.source.vintage) : 'published'}{' '}
              Pennsylvania School Districts dataset from PennDOT, distributed by{' '}
              <a
                href={data?.source.metadataUrl ?? PASDA_HOME}
                target="_blank"
                rel="noreferrer"
              >
                PASDA
              </a>
              . {data?.source.disclaimer}
            </p>
            <p>
              High-school sports: PIAA football classifications for{' '}
              {sportsSource.season}, PIAA districts and grade 9–11 enrollment
              (reported {sportsSource.enrollmentDate}) from the{' '}
              <a href={PIAA_HOME} target="_blank" rel="noreferrer">
                Pennsylvania Interscholastic Athletic Association
              </a>
              , matched to districts by name. Conferences and leagues are not
              shown.
            </p>
            <p>
              Streets, water and place names: ©{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors
              </a>
              , available under the Open Database License (ODbL), in{' '}
              <a href="https://protomaps.com" target="_blank" rel="noreferrer">
                Protomaps
              </a>{' '}
              tiles. Every map file is served from this site.
            </p>
          </>
        }
      />
    </div>
  );
}

/**
 * The district's PIAA high schools, each with its football class and
 * enrollment, and the source. Shown for every district PIAA lists.
 */
function SportsSection({
  sports,
  season,
  enrollmentDate,
}: {
  sports: DistrictSports | null;
  season: string;
  enrollmentDate: string;
}) {
  const fmt = (n: number | null) =>
    n === null ? '–' : n.toLocaleString('en-US');
  return (
    <section
      className="place-panel__section pa-schools"
      aria-labelledby="pa-schools-title"
    >
      <h3 className="section-label" id="pa-schools-title">
        High-school sports
      </h3>
      {sports && sports.schools.length > 0 && (
        <ul aria-label="PIAA high schools">
          {sports.schools.map((school) => (
            <li key={school.id}>
              <span>{school.name}</span>
              <span className="pa-schools__class">
                {school.football
                  ? `${school.football}${school.coop ? ' co-op' : ''}`
                  : 'No football'}
              </span>
              <span className="pa-schools__meta">
                {fmt(school.total)} students in grades 9–11
                {school.boys !== null ? ` · ${fmt(school.boys)} boys` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p>
        {sports?.piaa ? `${piaaName(sports.piaa)} runs its playoffs. ` : ''}
        PIAA football classes for {season}, from enrollment reported in{' '}
        {enrollmentDate}. A school may play up a class by choice or under PIAA’s
        competition rule, and co-op teams combine schools. Confirm with{' '}
        <a href={PIAA_HOME} target="_blank" rel="noreferrer">
          PIAA
        </a>
        .
      </p>
    </section>
  );
}

/** "Northampton County · Colonial IU 20". */
const districtSubtitle = (d: District) =>
  [countyName(d), text(d.IU_NAME) && titleCase(text(d.IU_NAME)!)]
    .filter(Boolean)
    .join(' · ') || undefined;

function PaMapView({
  onMount,
}: {
  onMount: (handle: MapHandle | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const webgl = useAtlas((s) => s.webgl);

  useEffect(() => {
    let handle: MapHandle | undefined;
    let cancelled = false;
    mapModule
      ?.then(({ mountPaMap, supportsWebGL2 }) => {
        if (cancelled || !ref.current) return;
        if (!supportsWebGL2()) {
          actions.setWebgl(false);
          return;
        }
        handle = mountPaMap(ref.current);
        (window as unknown as { __atlasMap?: MapHandle['map'] }).__atlasMap =
          handle.map;
        onMount(handle);
      })
      .catch(() => actions.setWebgl(false));
    return () => {
      cancelled = true;
      handle?.destroy();
      onMount(null);
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
          The <a href="#districts">list of all {DISTRICT_COUNT} districts</a>,
          by county, still works.
        </p>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className="map-canvas"
      role="region"
      aria-label="Map of Pennsylvania school districts"
    />
  );
}
