import React from 'react';
import Icon, { BrandMark, type IconName } from './Icon';
import './Toolbar.css';
import { useChrome, type Overlay } from '../atlas/hooks';

interface BrandProps {
  subtitle?: string;
  /** Shown in place of the name and subtitle when the header is narrow. */
  compactTitle?: string;
  /** A second line under the compact title, such as the data vintage. */
  compactDetail?: string;
}

/**
 * The atlas title. It does not navigate: "/" opens a random year, which would
 * replace a lesson a teacher has prepared. About lists the other maps.
 */
export function Brand({
  subtitle = 'An atlas of the world through time',
  compactTitle,
  compactDetail,
}: BrandProps) {
  return (
    <div className="brand">
      <BrandMark />
      <span className="brand__text">
        <span className="brand__name">Historic Borders</span>
        {subtitle && <span className="brand__subtitle">{subtitle}</span>}
      </span>
      {compactTitle && (
        <span className="brand__compact">
          <span className="brand__compact-title">{compactTitle}</span>
          {compactDetail && (
            <span className="brand__compact-detail">
              <span className="visually-hidden">, </span>
              {compactDetail}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

const ITEMS: Array<{
  overlay: Exclude<Overlay, null>;
  icon: IconName;
  label: string;
}> = [
  { overlay: 'settings', icon: 'sliders', label: 'Map settings' },
  { overlay: 'about', icon: 'info', label: 'About this map' },
  { overlay: 'feedback', icon: 'message', label: 'Feedback' },
];

export default function Toolbar() {
  const { overlay, openOverlay, toggleFocusMode } = useChrome();

  return (
    <div className="toolbar" role="toolbar" aria-label="Map tools">
      {ITEMS.map((item) => (
        <button
          key={item.overlay}
          type="button"
          className="icon-button"
          data-overlay-trigger
          aria-label={item.label}
          aria-haspopup="dialog"
          aria-expanded={overlay === item.overlay}
          title={item.label}
          onClick={() => openOverlay(item.overlay)}
        >
          <Icon name={item.icon} />
        </button>
      ))}
      <button
        type="button"
        className="icon-button"
        aria-label="Present to class: hide controls"
        title="Present to class: hide controls"
        onClick={toggleFocusMode}
      >
        <Icon name="present" />
      </button>
    </div>
  );
}

/** Shown alone in focus mode so the visitor can bring the controls back. */
export function RestoreControlsButton() {
  const { toggleFocusMode } = useChrome();
  return (
    <button
      type="button"
      className="icon-button icon-button--floating restore-controls"
      aria-label="Show controls"
      title="Show controls"
      onClick={toggleFocusMode}
    >
      <Icon name="collapse" />
    </button>
  );
}
