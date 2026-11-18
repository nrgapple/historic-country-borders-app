import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import historicalManifest from '../data/historical-manifest.json';
import Layout from './Layout';
import Timeline, { TimelineChangeMethod } from './Timeline';
import Toolbar, { Brand, RestoreControlsButton } from './Toolbar';
import PlacePanel, { PlaceFact } from './PlacePanel';
import SettingsPanel from './SettingsPanel';
import AboutDialog from './AboutDialog';
import FeedbackDialog from './FeedbackDialog';
import MapStatus from './MapStatus';
import PlaceFinder from './PlaceFinder';
import ProjectorCaption from './ProjectorCaption';
import type { FeatureProperties } from './map/MapCanvas';
import { useChrome } from '../contexts/ChromeContext';
import { useHistoricalBorders } from '../hooks/useHistoricalBorders';
import { useMapFocus, useSharedPlace } from '../hooks/useSharedPlace';
import { trackEvent } from '../lib/analytics';
import {
  featureBounds,
  featuresNamed,
  PlaceOption,
  placeOptionsFromFeatures,
} from '../lib/places';
import { formatYearLong, parseYearParam, yearPath } from '../lib/years';
import { yearPageDescription, yearPageTitle } from '../config/seo';

const HistoricalMap = dynamic(() => import('./map/HistoricalMap'), {
  ssr: false,
  loading: () => <div className="map-canvas map-canvas--pending" />,
});

const PRECISION: Record<number, string> = {
  1: 'Approximate',
  2: 'Moderately precise',
  3: 'Set by treaty or law',
};

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const countryFacts = (properties: FeatureProperties): PlaceFact[] => {
  const name = text(properties.NAME);
  const partOf = text(properties.PARTOF);
  const subjectTo = text(properties.SUBJECTO);
  const precision = PRECISION[Number(properties.BORDERPRECISION)];
  const facts: PlaceFact[] = [];
  if (partOf && partOf !== name)
    facts.push({ label: 'Part of', value: partOf });
  if (subjectTo && subjectTo !== name && subjectTo !== partOf)
    facts.push({ label: 'Subject to', value: subjectTo });
  if (precision) facts.push({ label: 'Border precision', value: precision });
  return facts;
};

interface Selection {
  name: string;
  properties: FeatureProperties;
}

/** Territories in the finder, with "Part of …" to tell similar names apart. */
const territoryOption = {
  detail: (properties: FeatureProperties) => {
    const name = text(properties.NAME);
    const partOf = text(properties.PARTOF);
    return partOf && partOf !== name ? `Part of ${partOf}` : undefined;
  },
};

const sourceDate = new Date(historicalManifest.source.commitDate);

const SHORTCUTS = [
  { keys: ['←', '→'], action: 'Previous or next year' },
  { keys: ['Home', 'End'], action: 'First or last year (timeline focused)' },
  { keys: ['Esc'], action: 'Close the details panel' },
];

interface HistoryAtlasProps {
  years: number[];
  initialYear: number;
}

export default function HistoryAtlas({
  years,
  initialYear,
}: HistoryAtlasProps) {
  const router = useRouter();
  const { focusMode } = useChrome();
  const year = parseYearParam(router.query.year, years) ?? initialYear;
  const index = years.indexOf(year);
  const neighbours = useMemo(
    () => [years[index - 1], years[index + 1]].filter((y) => y !== undefined),
    [years, index],
  );
  const borders = useHistoricalBorders(year, neighbours);
  const [selection, setSelection] = useState<Selection>();

  const setYear = useCallback(
    (next: number, method: TimelineChangeMethod) => {
      trackEvent('year_change', { year: next, method });
      void router.push(
        { pathname: '/year/[year]', query: { year: String(next) } },
        `${yearPath(next)}${window.location.search}`,
        { shallow: true, scroll: false },
      );
    },
    [router],
  );

  // Keep a selected territory across years when it still exists.
  useEffect(() => {
    if (!borders.value || borders.isPrevious) return;
    setSelection((current) => {
      if (!current) return current;
      const match = borders.value?.data.borders.features.find(
        (feature) => feature.properties?.NAME === current.name,
      );
      return match?.properties
        ? { name: current.name, properties: match.properties }
        : undefined;
    });
  }, [borders.value, borders.isPrevious]);

  const handleSelect = useCallback(
    (properties: FeatureProperties | undefined) => {
      const name = text(properties?.NAME);
      if (!properties || !name) {
        setSelection(undefined);
        return;
      }
      setSelection({ name, properties });
      trackEvent('country_select', { name, year });
    },
    [year],
  );

  // Place finder and shareable `?place=` links.
  const { onMapReady, focusBounds } = useMapFocus(6);
  const features = borders.value?.data.borders.features;
  const placeOptions = useMemo(
    () => (features ? placeOptionsFromFeatures(features, territoryOption) : []),
    [features],
  );

  const showPlace = useCallback(
    (name: string, frame: boolean) => {
      const matches = featuresNamed(features ?? [], name);
      const properties = matches[0]?.properties;
      if (!properties) return false;
      setSelection({ name, properties });
      if (frame) focusBounds(featureBounds(matches));
      return true;
    },
    [features, focusBounds],
  );

  const handleFind = useCallback(
    (option: PlaceOption) => {
      if (showPlace(option.name, true))
        trackEvent('country_select', { name: option.name, year });
    },
    [showPlace, year],
  );

  useSharedPlace({
    ready: Boolean(borders.value && !borders.isPrevious),
    selectedName: selection?.name,
    restore: showPlace,
    syncKey: year,
  });

  const closePanel = useCallback(() => setSelection(undefined), []);
  const yearLabel = formatYearLong(year);
  const dataState = borders.error
    ? 'unavailable'
    : borders.isLoading
      ? 'loading'
      : 'ready';

  return (
    <Layout
      title={yearPageTitle(year)}
      description={yearPageDescription(year)}
      path={yearPath(year)}
    >
      <main
        className="atlas"
        data-testid="map-container"
        data-data-state={dataState}
        data-feature-count={
          borders.isPrevious
            ? 0
            : (borders.value?.data.borders.features.length ?? 0)
        }
      >
        <h1 className="visually-hidden">Political borders in {yearLabel}</h1>

        <HistoricalMap
          data={borders.value}
          selectedName={selection?.name}
          onSelect={handleSelect}
          onReady={onMapReady}
        />

        {!focusMode && (
          <header className="topbar">
            <Timeline
              years={years}
              value={year}
              onChange={setYear}
              leading={<Brand />}
              trailing={
                <div className="topbar__tools">
                  <PlaceFinder
                    options={placeOptions}
                    onSelect={handleFind}
                    collapsible
                  />
                  <Toolbar />
                </div>
              }
            />
            <SettingsPanel />
            <MapStatus
              isLoading={borders.isLoading}
              error={borders.error}
              onRetry={borders.retry}
              loadingLabel={`Loading borders for ${yearLabel}`}
              readyLabel={`Showing borders for ${yearLabel}`}
            />
          </header>
        )}

        {focusMode && (
          <>
            <ProjectorCaption title={yearLabel} place={selection?.name} />
            <RestoreControlsButton />
          </>
        )}

        {!focusMode && selection && (
          <PlacePanel
            eyebrow={`Territory · ${yearLabel}`}
            name={selection.name}
            facts={countryFacts(selection.properties)}
            onClose={closePanel}
          />
        )}

        <FeedbackDialog />
        <AboutDialog
          shortcuts={SHORTCUTS}
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
                  href={historicalManifest.source.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  GPL-3.0
                </a>
                ). {historicalManifest.source.provenanceNote}
              </p>
              <p>
                Each map is a snapshot around one year. Borders are
                reconstructions: most are approximate, some were contested, and
                many peoples had no fixed borders at all. Found a mistake?{' '}
                <a
                  href="https://github.com/aourednik/historical-basemaps/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  Report it upstream
                </a>
                .
              </p>
              <p>
                Basemap © Mapbox © OpenStreetMap. Summaries from Wikipedia (CC
                BY-SA 4.0).
              </p>
            </>
          }
        />
      </main>
    </Layout>
  );
}
