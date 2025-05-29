import { useAllowScroll } from '../hooks/useScrollLock';
import { useEffect, useMemo } from 'react';
import ReactGA4 from 'react-ga4';
import { useCompare } from '../contexts/CompareContext';
import { CoordTuple } from '../util/types';

export interface CompareInfo {
  position: CoordTuple;
  place: string;
  year: string;
}

interface ComparePopupProps {
  info: CompareInfo | undefined;
  onClose?: () => void;
  onCountryClick?: (countryName: string, year: string) => void;
}

export default function ComparePopup({ info, onClose, onCountryClick }: ComparePopupProps) {
  const { position, place = '', year = '' } = info ?? {};
  const { 
    compareState, 
    startCompare, 
    selectSecondCountry, 
    executeComparison, 
    cancelCompare,
    clearComparison 
  } = useCompare();

  // Allow scrolling on the popup description
  useAllowScroll('.compare-popup-content', !!place || !!compareState.currentComparison);

  // Track popup display events
  useEffect(() => {
    if ((place && position && compareState.isCompareMode) || compareState.currentComparison) {
      ReactGA4.event({
        category: 'AI Compare',
        action: 'popup_displayed',
        label: place ? `${place}_${year}` : 'historical_comparison',
        value: 1,
      });
    }
  }, [place, position, year, compareState.isCompareMode, compareState.currentComparison]);

  // Handle close with analytics
  const handleClose = () => {
    if (compareState.isCompareMode) {
      ReactGA4.event({
        category: 'AI Compare',
        action: 'popup_closed',
        label: compareState.country1 ? `${compareState.country1.name}_${compareState.country1.year}` : 'no_selection',
        value: 1,
      });
      
      cancelCompare();
    }
    onClose?.();
  };

  const handleStartCompare = () => {
    if (place && year) {
      startCompare(place, year);
    }
  };

  const handleSelectSecond = () => {
    if (place && year) {
      selectSecondCountry(place, year);
    }
  };

  const handleExecuteComparison = () => {
    executeComparison();
  };

  const handleClearComparison = () => {
    clearComparison();
  };

  const handleCountryClick = (countryName: string, year: string) => {
    if (onCountryClick) {
      ReactGA4.event({
        category: 'AI Compare',
        action: 'country_name_clicked',
        label: `${countryName}_${year}`,
        value: 1,
      });
      
      onCountryClick(countryName, year);
    }
  };

  // Don't render if not in compare mode or if no place and no current comparison
  if (!compareState.isCompareMode || (!place && !compareState.currentComparison)) {
    return null;
  }

  const renderCompareContent = () => {
    // Show comparison result
    if (compareState.currentComparison) {
      return (
        <div className="compare-popup-content">
          <div className="compare-result-header">
            <h4>
              <button 
                className="compare-country-link"
                onClick={() => handleCountryClick(compareState.country1?.name || '', compareState.country1?.year || '')}
                title={`Go to ${compareState.country1?.name} in ${compareState.country1?.year}`}
              >
                {compareState.country1?.name} ({compareState.country1?.year})
              </button>
              {' vs '}
              <button 
                className="compare-country-link"
                onClick={() => handleCountryClick(compareState.country2?.name || '', compareState.country2?.year || '')}
                title={`Go to ${compareState.country2?.name} in ${compareState.country2?.year}`}
              >
                {compareState.country2?.name} ({compareState.country2?.year})
              </button>
            </h4>
          </div>
          <div className="compare-result-content">
            {compareState.currentComparison}
          </div>
          <div className="compare-actions">
            <button className="compare-action-button secondary" onClick={handleClearComparison}>
              🔄 New Comparison
            </button>
          </div>
        </div>
      );
    }

    // Show loading state
    if (compareState.isLoading) {
      return (
        <div className="compare-popup-content">
          <div className="compare-loading">
            <div className="compare-loading-icon">🤖</div>
            <div className="compare-loading-text">
              Generating AI comparison between<br />
              <strong>{compareState.country1?.name} ({compareState.country1?.year})</strong><br />
              and<br />
              <strong>{compareState.country2?.name} ({compareState.country2?.year})</strong>
            </div>
          </div>
        </div>
      );
    }

    // Show selection UI for second country
    if (compareState.country1 && compareState.country2) {
      return (
        <div className="compare-popup-content">
          <div className="compare-selection">
            <div className="compare-countries">
              <div className="compare-country selected">
                <div className="compare-country-name">{compareState.country1.name}</div>
                <div className="compare-country-year">({compareState.country1.year})</div>
              </div>
              <div className="compare-vs">vs</div>
              <div className="compare-country selected">
                <div className="compare-country-name">{compareState.country2.name}</div>
                <div className="compare-country-year">({compareState.country2.year})</div>
              </div>
            </div>
            <div className="compare-actions">
              <button className="compare-action-button primary" onClick={handleExecuteComparison}>
                🤖 Start AI Comparison
              </button>
              <button className="compare-action-button secondary" onClick={cancelCompare}>
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Show selection UI for first country (waiting for second)
    if (compareState.country1) {
      const isSameCountryYear = compareState.country1.name === place && compareState.country1.year === year;
      
      return (
        <div className="compare-popup-content">
          <div className="compare-selection">
            <div className="compare-instruction">
              <div className="compare-step">Step 2: Select another country to compare</div>
            </div>
            <div className="compare-countries">
              <div className="compare-country selected">
                <div className="compare-country-name">{compareState.country1.name}</div>
                <div className="compare-country-year">({compareState.country1.year})</div>
              </div>
              <div className="compare-vs">vs</div>
              <div className={`compare-country ${isSameCountryYear ? 'same-country' : 'pending'}`}>
                <div className="compare-country-name">{place}</div>
                <div className="compare-country-year">({year})</div>
              </div>
            </div>
            
            {isSameCountryYear ? (
              <div className="compare-same-country-message">
                ⚠️ Cannot compare the same country and year. Please select a different country or year.
              </div>
            ) : (
              <div className="compare-actions">
                <button className="compare-action-button primary" onClick={handleSelectSecond}>
                  ✅ Select This Country
                </button>
                <button className="compare-action-button secondary" onClick={cancelCompare}>
                  ❌ Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Initial compare mode (no countries selected yet)
    return (
      <div className="compare-popup-content">
        <div className="compare-start">
          <div className="compare-title">🔀 AI Compare Mode</div>
          <div className="compare-description">
            Start comparing <strong>{place} ({year})</strong> with another country or territory.
          </div>
          <div className="compare-actions">
            <button className="compare-action-button primary" onClick={handleStartCompare}>
              🎯 Start Comparison
            </button>
            <button className="compare-action-button secondary" onClick={cancelCompare}>
              ❌ Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="compare-popup">
      <div className="compare-popup-header">
        <div className="compare-popup-title">
          {compareState.currentComparison ? '🔀 AI Comparison Result' : '🔀 AI Compare'}
        </div>
        <button className="compare-popup-close" onClick={handleClose} aria-label="Close compare popup">
          ✕
        </button>
      </div>
      {renderCompareContent()}
    </div>
  );
} 