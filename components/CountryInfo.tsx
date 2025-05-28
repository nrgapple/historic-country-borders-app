import React, { useMemo } from 'react';
import { useCountryInfo } from '../hooks/useCountryInfo';
import { useInfoProvider } from '../contexts/InfoProviderContext';

export interface CountryInfoData {
  place: string;
}

interface CountryInfoProps {
  info: CountryInfoData | undefined;
  year?: string;
  onClose?: () => void;
}

const noData = 'Not Found';

export default function CountryInfo({ info, year, onClose }: CountryInfoProps) {
  const { place = '' } = info ?? {};
  const { provider } = useInfoProvider();
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

  // Don't render if no country is selected
  if (!place) {
    return null;
  }

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
    </div>
  );
} 