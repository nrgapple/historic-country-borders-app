import React, { useState } from 'react';
import ReactGA4 from 'react-ga4';
import SettingsModal from './SettingsModal';
import { useAppStateValue } from '../hooks/useState';

export default function SettingsButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hide = useAppStateValue('hide');

  const handleToggleModal = () => {
    const newState = !isModalOpen;
    setIsModalOpen(newState);
    
    ReactGA4.event({
      category: 'Settings',
      action: newState ? 'settings_opened' : 'settings_closed',
      label: 'settings_modal',
      value: 1,
    });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_closed',
      label: 'settings_modal',
      value: 1,
    });
  };

  // Hide settings button when UI is hidden
  if (hide) return null;

  return (
    <>
      <div className="settings-button">
        <button
          className="settings-button-trigger"
          onClick={handleToggleModal}
          aria-label="Open settings"
          title="Settings"
        >
          <span className="settings-button-icon">⚙️</span>
        </button>
      </div>
      
      <SettingsModal isOpen={isModalOpen} onClose={handleCloseModal} />
    </>
  );
} 