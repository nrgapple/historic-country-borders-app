import React, { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from './Layout';
import Toolbar, { Brand, RestoreControlsButton } from './Toolbar';
import PlacePanel, { PlaceFact } from './PlacePanel';
import SettingsPanel from './SettingsPanel';
import AboutDialog from './AboutDialog';
import FeedbackDialog from './FeedbackDialog';
import MapStatus from './MapStatus';
import type { FeatureProperties } from './map/MapCanvas';
import { useChrome } from '../contexts/ChromeContext';
import {
  STALE_AFTER_MONTHS,
  usePASchoolDistricts,
} from '../hooks/usePASchoolDistricts';
import { trackEvent } from '../lib/analytics';
import paValidation from '../data/pa-school-districts-validation.json';

const SchoolDistrictsMap = dynamic(() => import('./map/SchoolDistrictsMap'), {
  ssr: false,
  loading: () => <div className="map-canvas map-canvas--pending" />,
});

/** Official spellings the source stores in capitals, e.g. "Central IU 10". */
const ACRONYMS: Record<string, string> = {
  arin: 'ARIN',
  avts: 'AVTS',
  blast: 'BLaST',
  ctc: 'CTC',
  iu: 'IU',
  pa: 'PA',
  sd: 'SD',
};
const MINOR_WORDS = new Set(['and', 'for', 'of', 'the']);

/** "PHILADELPHIA IU 26" → "Philadelphia IU 26"; "MCKEAN" → "McKean". */
export const titleCase = (value: string) =>
  value.toLowerCase().replace(/[a-z]+/g, (word, offset: number) => {
    if (ACRONYMS[word]) return ACRONYMS[word];
    if (offset > 0 && MINOR_WORDS.has(word)) return word;
    if (/^mc[a-z]/.test(word))
      return `Mc${word[2].toUpperCase()}${word.slice(3)}`;
    return word[0].toUpperCase() + word.slice(1);
  });

const text = (value: unknown) =>
  typeof value === 'string' && value.trim() && value.trim() !== 'NULL'
    ? value.trim()
    : undefined;

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
  if (aun)
    facts.push({ label: 'Administrative unit number (AUN)', value: aun });
  return facts;
};

/** "Pen Argyl Area SD" → "Pen Argyl Area School District". */
export const districtFullName = (properties: FeatureProperties) => {
  const full = text(properties.SCHOOL_DIS) ?? text(properties.NAME) ?? '';
  return full.replace(/\bSD$/, 'School District');
};

const formatVintage = (vintage: string, month: 'long' | 'short' = 'long') => {
  const match = /^(\d{4})-(\d{2})$/.exec(vintage);
  if (!match) return vintage;
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1),
  ).toLocaleDateString('en-US', {
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });
};

const DISTRICT_COUNT = paValidation.districtCount;

const SHORTCUTS = [
  {
    keys: ['←', '↑', '→', '↓'],
    action: 'Pan the map (when the map is focused)',
  },
  { keys: ['+', '−'], action: 'Zoom in or out (when the map is focused)' },
  { keys: ['Esc'], action: 'Close the details panel' },
];

interface Selection {
  name: string;
  properties: FeatureProperties;
}

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
        />

        {!focusMode && (
          <header className="topbar">
            <div className="topbar__row">
              <Brand
                subtitle="Pennsylvania school districts"
                compactTitle="PA school districts"
                compactDetail={
                  data && !isEmpty
                    ? `Boundaries ${formatVintage(data.source.vintage, 'short')}`
                    : undefined
                }
              />
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
              <Toolbar />
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
              loadingLabel={`Loading ${DISTRICT_COUNT} district boundaries`}
              readyLabel="School district map ready"
              errorLabel="School district map data is unavailable."
            />
          </header>
        )}

        {focusMode && <RestoreControlsButton />}

        {!focusMode && selection && (
          <PlacePanel
            eyebrow="School district"
            name={districtFullName(selection.properties)}
            facts={districtFacts(selection.properties)}
            wikiQuery={`${districtFullName(selection.properties)} Pennsylvania`}
            onClose={closePanel}
          />
        )}

        <FeedbackDialog
          corrections={
            <>
              To correct a district boundary, contact PennDOT, which publishes
              the boundaries through{' '}
              <a
                href={data?.source.metadataUrl ?? 'https://www.pasda.psu.edu/'}
                target="_blank"
                rel="noreferrer"
              >
                PASDA
              </a>
              . For enrollment questions, contact the school district.
            </>
          }
        />
        <AboutDialog
          intro={
            <>
              <p className="dialog__lede">
                This map shows the boundaries of Pennsylvania&rsquo;s{' '}
                {DISTRICT_COUNT} public school districts. Select a district to
                see its county, intermediate unit, and career and technical
                school.
              </p>
              <p className="about__caveat">
                Boundaries are for reference only. To confirm which school a
                home is assigned to, contact the school district.
              </p>
            </>
          }
          shortcuts={SHORTCUTS}
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
            </>
          }
        />
      </main>
    </Layout>
  );
}
