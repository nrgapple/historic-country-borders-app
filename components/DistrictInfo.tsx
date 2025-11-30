import React, { useMemo } from 'react';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { useSettings } from '../contexts/SettingsContext';

export interface DistrictInfoData {
  districtName: string;
  properties?: Record<string, any>;
}

interface DistrictInfoProps {
  info: DistrictInfoData | undefined;
  onClose?: () => void;
}

const noData = 'Not Found';

export default function DistrictInfo({ info, onClose }: DistrictInfoProps) {
  const { districtName = '', properties } = info ?? {};
  const { settings } = useSettings();
  const provider = settings.infoProvider;
  
  // Try Wikipedia search with district name
  const { info: description, title: title, isLoading } = useCountryInfo(districtName, { provider });
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );

  // Determine description CSS class based on state
  const descriptionClass = useMemo(() => {
    let baseClass = 'country-info-description';
    if (isLoading) {
      baseClass += ' loading';
    } else if (empty) {
      baseClass += ' empty';
    }
    return baseClass;
  }, [isLoading, empty]);

  // Don't render if no district is selected
  if (!districtName) {
    return null;
  }

  // Format properties for display
  const formatProperties = () => {
    if (!properties) return null;

    const displayFields: Record<string, string> = {
      SCHOOL_NAM: 'School District',
      SCHOOL_DIS: 'Full Name',
      CTY_NAME: 'County',
      IU_NAME: 'Intermediate Unit',
      IU_NUM: 'IU Number',
      AUN_NUM: 'AUN Number',
      AVTS: 'Career/Technical School',
    };

    const relevantFields = Object.keys(displayFields).filter(key => 
      properties[key] != null && properties[key] !== '' && properties[key] !== 0
    );

    if (relevantFields.length === 0) return null;

    return (
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ccc' }}>
        <h4 style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>District Information</h4>
        <dl style={{ margin: 0 }}>
          {relevantFields.map((key) => (
            <div key={key} style={{ marginBottom: '0.5rem' }}>
              <dt style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {displayFields[key]}:
              </dt>
              <dd style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                {String(properties[key])}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  };

  const propertiesSection = formatProperties();

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
            📖 No Wikipedia information available<br />for this district 😔
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

