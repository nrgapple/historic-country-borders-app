import React from 'react';
import Icon from './Icon';

interface MapStatusProps {
  isLoading: boolean;
  error?: Error;
  onRetry: () => void;
  loadingLabel: string;
  readyLabel: string;
  errorLabel?: string;
}

/** Progress bar, error banner, and screen-reader announcements for map data. */
export default function MapStatus({
  isLoading,
  error,
  onRetry,
  loadingLabel,
  readyLabel,
  errorLabel = 'Map data could not be loaded.',
}: MapStatusProps) {
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
