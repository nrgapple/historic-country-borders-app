import React, { useEffect, useId, useRef } from 'react';
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

export default function Toolbar({ overflow = false }: { overflow?: boolean }) {
  const { overlay, openOverlay, toggleFocusMode } = useChrome();
  const overflowId = useId();
  const more = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflow) return;
    const closeWhenWide = () => {
      if (
        popover.current?.hasAttribute('data-open') &&
        !more.current?.offsetWidth
      )
        popover.current.hidePopover();
    };
    window.addEventListener('resize', closeWhenWide);
    return () => window.removeEventListener('resize', closeWhenWide);
  }, [overflow]);

  const tools = (inOverflow = false) => (
    <>
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
          onClick={() => {
            if (inOverflow) popover.current?.hidePopover();
            openOverlay(item.overlay);
          }}
        >
          <Icon name={item.icon} />
          {inOverflow && item.label}
        </button>
      ))}
      <button
        type="button"
        className="icon-button"
        aria-label="Present to class: hide controls"
        title="Present to class: hide controls"
        onClick={() => {
          if (inOverflow) popover.current?.hidePopover();
          toggleFocusMode();
        }}
      >
        <Icon name="present" />
        {inOverflow && 'Present to class'}
      </button>
    </>
  );

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Map tools">
        {tools()}
      </div>
      {overflow && (
        <>
          <button
            ref={more}
            type="button"
            className="icon-button toolbar__more"
            popoverTarget={overflowId}
            aria-label="More map tools"
            title="More map tools"
          >
            <Icon name="more" />
          </button>
          <div
            className="toolbar__overflow"
            id={overflowId}
            ref={popover}
            popover="auto"
            onBeforeToggle={(event) =>
              event.currentTarget.toggleAttribute(
                'data-open',
                event.newState === 'open',
              )
            }
            role="group"
            aria-label="Map tools"
          >
            {tools(true)}
          </div>
        </>
      )}
    </>
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
