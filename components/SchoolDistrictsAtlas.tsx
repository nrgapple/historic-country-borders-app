import React, { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from './Layout';
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
import {
  STALE_AFTER_MONTHS,
  usePASchoolDistricts,
} from '../hooks/usePASchoolDistricts';
import { useMapFocus, useSharedPlace } from '../hooks/useSharedPlace';
import { trackEvent } from '../lib/analytics';
import {
  featureBounds,
  featuresNamed,
  PlaceOption,
  placeOptionsFromFeatures,
} from '../lib/places';

const SchoolDistrictsMap = dynamic(() => import('./map/SchoolDistrictsMap'), {
  ssr: false,
  loading: () => <div className="map-canvas map-canvas--pending" />,
});

const titleCase = (value: string) =>
  value.toLowerCase().replace(/\b([a-z])/g, (letter) => letter.toUpperCase());

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const districtFacts = (properties: FeatureProperties): PlaceFact[] => {
  const facts: PlaceFact[] = [];
  const county = text(properties.CTY_NAME);
  const unit = text(properties.IU_NAME);
  const career = text(properties.AVTS);
  const aun = text(properties.AUN_NUM);
  if (county) facts.push({ label: 'County', value: titleCase(county) });
  if (unit) facts.push({ label: 'Intermediate unit', value: titleCase(unit) });
  if (career)
    facts.push({
      label: 'Career & technical school',
      value: titleCase(career),
    });
  if (aun) facts.push({ label: 'AUN', value: aun });
  return facts;
};

/** "Pen Argyl Area SD" → "Pen Argyl Area School District". */
export const districtFullName = (properties: FeatureProperties) => {
  const full = text(properties.SCHOOL_DIS) ?? text(properties.NAME) ?? '';
  return full.replace(/\bSD$/, 'School District');
};

const formatVintage = (vintage: string) => {
  const match = /^(\d{4})-(\d{2})$/.exec(vintage);
  if (!match) return vintage;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1),
  ).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

interface Selection {
  name: string;
  properties: FeatureProperties;
}

/** "NORTHAMPTON" → "Northampton County". */
const countyName = (properties: FeatureProperties) => {
  const county = text(properties.CTY_NAME);
  if (!county) return undefined;
  const name = county
    .toLowerCase()
    .replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  return / county$/i.test(name) ? name : `${name} County`;
};

/** Districts in the finder; county names match too. */
const districtOption = {
  label: (properties: FeatureProperties) =>
    districtFullName(properties) || undefined,
  detail: countyName,
  keywords: (properties: FeatureProperties) =>
    [text(properties.NAME), countyName(properties)].filter(
      (value): value is string => Boolean(value),
    ),
};

export default function SchoolDistrictsAtlas() {
  const { focusMode } = useChrome();
  const { data, isLoading, isEmpty, isError, isStale, retry } =
    usePASchoolDistricts();
  const [selection, setSelection] = useState<Selection>();

  const handleSelect = useCallback(
    (properties: FeatureProperties | undefined) => {
      const name = text(properties?.NAME);
      if (!properties || !name) {
        setSelection(undefined);
        return;
      }
      setSelection({ name, properties });
      trackEvent('district_select', { name });
    },
    [],
  );

  // Place finder and shareable `?place=` links.
  const { onMapReady, focusBounds } = useMapFocus(11);
  const features = data?.data.borders.features;
  const placeOptions = useMemo(
    () => (features ? placeOptionsFromFeatures(features, districtOption) : []),
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
        trackEvent('district_select', { name: option.name });
    },
    [showPlace],
  );

  useSharedPlace({
    ready: Boolean(data) && !isLoading,
    selectedName: selection?.name,
    restore: showPlace,
  });

  const closePanel = useCallback(() => setSelection(undefined), []);

  const dataState = isLoading
    ? 'loading'
    : isError
      ? 'unavailable'
      : isEmpty
        ? 'empty'
        : data
          ? 'ready'
          : 'unavailable';

  return (
    <Layout
      title="Pennsylvania school districts map"
      description="Interactive map of all 500 Pennsylvania public school district boundaries, with county, intermediate unit, and career and technical school details."
      path="/pa/school-districts"
    >
      <main
        className="atlas"
        data-testid="pa-school-districts-map-container"
        data-data-state={dataState}
        data-feature-count={data?.data.borders.features.length ?? 0}
      >
        <h1 className="visually-hidden">Pennsylvania school districts</h1>

        <SchoolDistrictsMap
          data={data?.data}
          selectedName={selection?.name}
          onSelect={handleSelect}
          onReady={onMapReady}
        />

        {!focusMode && (
          <header className="topbar">
            <div className="topbar__row">
              <Brand subtitle="Pennsylvania school districts" />
              <p className="topbar__meta">
                {data && !isEmpty && (
                  <>
                    District boundaries: {data.source.vintage}
                    <span aria-hidden="true"> · </span>
                    <a
                      href={data.source.metadataUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      PASDA source
                    </a>
                  </>
                )}
                {isEmpty && !isError && 'No school districts are available.'}
              </p>
              <div className="topbar__tools">
                <PlaceFinder
                  options={placeOptions}
                  onSelect={handleFind}
                  collapsible
                />
                <Toolbar />
              </div>
            </div>
            <SettingsPanel />
            {isStale && data && (
              <p className="banner banner--warning">
                These boundaries are from {formatVintage(data.source.vintage)},
                more than {STALE_AFTER_MONTHS} months ago. Verify current
                boundaries with your district.
              </p>
            )}
            <MapStatus
              isLoading={isLoading}
              error={isError}
              onRetry={retry}
              loadingLabel="Loading school district map"
              readyLabel="School district map ready"
              errorLabel="School district map data is unavailable."
            />
          </header>
        )}

        {focusMode && (
          <>
            <ProjectorCaption
              place={
                selection ? districtFullName(selection.properties) : undefined
              }
            />
            <RestoreControlsButton />
          </>
        )}

        {!focusMode && selection && (
          <PlacePanel
            eyebrow="School district"
            name={districtFullName(selection.properties)}
            facts={districtFacts(selection.properties)}
            wikiQuery={`${districtFullName(selection.properties)} Pennsylvania`}
            onClose={closePanel}
          />
        )}

        <FeedbackDialog />
        <AboutDialog
          sources={
            <>
              <p>
                District boundaries are the{' '}
                {data ? formatVintage(data.source.vintage) : 'published'}{' '}
                Pennsylvania School Districts dataset from PennDOT, distributed
                by{' '}
                <a
                  href={
                    data?.source.metadataUrl ?? 'https://www.pasda.psu.edu/'
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  PASDA
                </a>
                . {data?.source.disclaimer}
              </p>
              <p>
                Boundaries are for reference only. Confirm enrollment
                eligibility with the school district.
              </p>
            </>
          }
        />
      </main>
    </Layout>
  );
}
