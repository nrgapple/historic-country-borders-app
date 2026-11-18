import React, { useEffect, useState } from 'react';
import Icon from './Icon';

interface MapStatusProps {
  isLoading: boolean;
  error?: Error;
  onRetry: () => void;
  loadingLabel: string;
  readyLabel: string;
  errorLabel?: string;
}

/**
 * Progress bar, error banner, and screen-reader announcements for map data.
 * The first load also shows a centered message over the empty map: on a slow
 * school connection the thin bar alone looks like a blank page. Later loads,
 * such as a year change, keep the previous map on screen and use only the bar.
 */
export default function MapStatus({
  isLoading,
  error,
  onRetry,
  loadingLabel,
  readyLabel,
  errorLabel = 'Map data could not be loaded.',
}: MapStatusProps) {
  const [hasSettled, setHasSettled] = useState(!isLoading);

  useEffect(() => {
    if (!isLoading) setHasSettled(true);
  }, [isLoading]);

  const showOverlay = isLoading && !hasSettled && !error;

  return (
    <>
      <div
        className="progress"
        data-active={isLoading || undefined}
        aria-hidden="true"
      />
      <p className="visually-hidden" role="status" aria-live="polite">
        {error ? errorLabel : isLoading ? `${loadingLabel}…` : readyLabel}
      </p>
      {showOverlay && (
        <div
          className="map-loading"
          data-testid="map-loading"
          aria-hidden="true"
        >
          <p className="map-loading__message">{loadingLabel}…</p>
        </div>
      )}
      {error && (
        <div className="banner" role="alert">
          <span>{errorLabel}</span>
          <button type="button" className="text-button" onClick={onRetry}>
            <Icon name="refresh" size={15} />
            Try again
          </button>
        </div>
      )}
    </>
  );
}
