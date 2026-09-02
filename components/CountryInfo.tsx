import React, { useMemo } from 'react';
import { useCountryInfo } from '../hooks/useCountryInfo';

export interface CountryInfoData {
  place: string;
}

interface CountryInfoProps {
  info: CountryInfoData | undefined;
  onClose?: () => void;
}

const noData = 'Not Found';

export default function CountryInfo({ info, onClose }: CountryInfoProps) {
  const { place = '' } = info ?? {};
  const { info: description, title, isLoading } = useCountryInfo(place);
  const empty = useMemo(
    () => !description || description.trim() === '' || description === noData,
    [description],
  );
  const descriptionClass = `country-info-description${
    isLoading ? ' loading' : empty ? ' empty' : ''
  }`;

  if (!place) return null;

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
          <>
            📖 No Wikipedia information available
            <br />
            for this location 😔
          </>
        ) : (
          description
        )}
      </div>
    </div>
  );
}
