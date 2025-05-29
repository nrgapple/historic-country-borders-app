import React, { useMemo } from 'react';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { useSettings } from '../contexts/SettingsContext';
import { useCompare } from '../contexts/CompareContext';
import ReactGA4 from 'react-ga4';

export interface CountryInfoData {
  place: string;
}

interface CountryInfoProps {
  info: CountryInfoData | undefined;
  year?: string;
  onClose?: () => void;
  onStartCompare?: (countryName: string, year: string) => void;
}

const noData = 'Not Found';

export default function CountryInfo({ info, year, onClose, onStartCompare }: CountryInfoProps) {
  const { place = '' } = info ?? {};
  const { settings } = useSettings();
  const { compareState, startCompare } = useCompare();
  const provider = settings.infoProvider;
  const { info: description, title: title, isLoading } = useCountryInfo(place, { provider, year });
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

  // Don't render if no country is selected or if in compare mode
  if (!place || compareState.isCompareMode) {
    return null;
  }

  const handleStartCompare = () => {
    if (place && year) {
      // Track compare button click
      ReactGA4.event('ai_compare_initiate', {
        country_name: place,
        year: year,
        source: 'country_info_panel',
        action_type: 'compare_button_click'
      });

      startCompare(place, year);
      
      // Call the parent callback if provided
      onStartCompare?.(place, year);
    }
  };

  return (
    <div className="country-info">
      <div className="country-info-header">
        <div className="country-info-title">{title || place}</div>
        <button 
          className="country-info-close" 
          onClick={onClose}
          aria-label="Close country information"
        >
          ×
        </button>
      </div>
      <div className={descriptionClass}>
        {isLoading ? (
          <>📚 Loading information...</>
        ) : empty ? (
          <>📖 No information available<br />for this location 😔</>
        ) : (
          description
        )}
      </div>
      
      {/* AI Compare Button - only show if feature is enabled and not loading/empty */}
      {settings.aiCompareEnabled && !isLoading && !empty && place && year && (
        <div className="country-info-actions">
          <button 
            className="country-info-compare-button"
            onClick={handleStartCompare}
            title="Compare this country with another using AI"
          >
            🔀 Compare
          </button>
        </div>
      )}
    </div>
  );
} 