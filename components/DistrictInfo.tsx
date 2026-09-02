import React, { useMemo } from 'react';
import { useCountryInfo } from '../hooks/useCountryInfo';

export interface DistrictInfoData {
  districtName: string;
  properties?: Record<string, unknown>;
}

interface DistrictInfoProps {
  info: DistrictInfoData | undefined;
  onClose?: () => void;
}

const noData = 'Not Found';

export default function DistrictInfo({ info, onClose }: DistrictInfoProps) {
  const { districtName = '', properties } = info ?? {};
  const { info: description, title, isLoading } = useCountryInfo(districtName);
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );
  const descriptionClass = `country-info-description${
    isLoading ? ' loading' : empty ? ' empty' : ''
  }`;

  if (!districtName) return null;

  const displayFields: Record<string, string> = {
    SCHOOL_NAM: 'School District',
    SCHOOL_DIS: 'Full Name',
    CTY_NAME: 'County',
    IU_NAME: 'Intermediate Unit',
    IU_NUM: 'IU Number',
    AUN_NUM: 'AUN Number',
    AVTS: 'Career/Technical School',
  };
  const relevantFields = properties
    ? Object.keys(displayFields).filter(
        (key) =>
          properties[key] != null &&
          properties[key] !== '' &&
          properties[key] !== 0,
      )
    : [];
  const propertiesSection = relevantFields.length ? (
    <div
      style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #ccc',
      }}
    >
      <h4 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>
        District Information
      </h4>
      <dl style={{ margin: 0 }}>
        {relevantFields.map((key) => (
          <div key={key} style={{ marginBottom: '0.5rem' }}>
            <dt style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {displayFields[key]}:
            </dt>
            <dd style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
              {String(properties?.[key])}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  ) : null;

  return (
    <div className="country-info">
      <div className="country-info-header">
        <div className="country-info-title">{title || districtName}</div>
        <button
          className="country-info-close"
          onClick={onClose}
          aria-label="Close district information"
        >
          ×
        </button>
      </div>
      <div className={descriptionClass}>
        {isLoading ? (
          <>📚 Loading information...</>
        ) : empty ? (
          <>
            📖 No Wikipedia information available
            <br />
            for this district 😔
            {propertiesSection}
          </>
        ) : (
          <>
            {description}
            {propertiesSection}
          </>
        )}
      </div>
    </div>
  );
}
