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
    ReactGA4.event({
      category: 'UI',
      action: `${isUIHidden ? 'show' : 'hide'} UI from persistent toggle`,
      label: 'persistent-ui-toggle',
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