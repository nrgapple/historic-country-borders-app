import React from 'react';
import Link from 'next/link';
import Icon, { BrandMark, IconName } from './Icon';
import { Overlay, useChrome } from '../contexts/ChromeContext';

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <Link href="/" className="brand" aria-label="Historic Borders home">
      <BrandMark />
      <span className="brand__text">
        <span className="brand__name">Historic Borders</span>
        {subtitle && <span className="brand__subtitle">{subtitle}</span>}
      </span>
    </Link>
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
        aria-label="Hide controls"
        title="Hide controls"
        onClick={toggleFocusMode}
      >
        <Icon name="expand" />
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
