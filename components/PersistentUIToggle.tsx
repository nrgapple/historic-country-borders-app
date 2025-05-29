import React from 'react';
import ReactGA4 from 'react-ga4';

interface PersistentUIToggleProps {
  isUIHidden: boolean;
  onToggle: () => void;
}

export default function PersistentUIToggle({
  isUIHidden,
  onToggle,
}: PersistentUIToggleProps) {
  const handleToggle = () => {
    onToggle();
    ReactGA4.event('ui_visibility_toggle', {
      action: isUIHidden ? 'show_ui' : 'hide_ui',
      toggle_source: 'persistent_toggle_button',
      previous_state: isUIHidden ? 'hidden' : 'visible',
      new_state: isUIHidden ? 'visible' : 'hidden'
    });
  };

  return (
    <div className={`persistent-ui-toggle ${isUIHidden ? 'minimal' : 'full'}`}>
      <button
        className="persistent-ui-toggle-btn"
        onClick={handleToggle}
        aria-label={isUIHidden ? 'Show UI' : 'Hide UI'}
        title={isUIHidden ? 'Show UI' : 'Hide UI'}
      >
        <span className="persistent-ui-toggle-icon">🔭</span>
        {!isUIHidden && (
          <span className="persistent-ui-toggle-text">
            Hide UI
          </span>
        )}
      </button>
    </div>
  );
} 