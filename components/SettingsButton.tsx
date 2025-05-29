import React, { useState, useRef, useEffect } from 'react';
import ReactGA4 from 'react-ga4';
import SettingsModal from './SettingsModal';
import { useAppStateValue } from '../hooks/useState';

export default function SettingsButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const hide = useAppStateValue('hide');
  const modalOpenTimeRef = useRef<number | null>(null);
  const settingsInteractionCountRef = useRef(0);

  const handleToggleModal = () => {
    const newState = !isModalOpen;
    setIsModalOpen(newState);
    
    if (newState) {
      // Track modal opening
      modalOpenTimeRef.current = Date.now();
      settingsInteractionCountRef.current = 0;
      
      ReactGA4.event({
        category: 'Settings',
        action: 'settings_opened',
        label: 'settings_modal',
        value: 1,
      });

      // Track time of day when settings are accessed
      const hour = new Date().getHours();
      const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      ReactGA4.event({
        category: 'Settings',
        action: 'settings_opened_time',
        label: timeOfDay,
        value: hour,
      });
    } else {
      handleCloseModal();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    
    // Calculate session duration
    const sessionDuration = modalOpenTimeRef.current ? Date.now() - modalOpenTimeRef.current : 0;
    
    ReactGA4.event({
      category: 'Settings',
      action: 'settings_closed',
      label: 'settings_modal',
      value: 1,
    });

    // Track session metrics
    if (sessionDuration > 0) {
      ReactGA4.event({
        category: 'Settings',
        action: 'modal_session_duration',
        label: `${Math.round(sessionDuration / 1000)}s`,
        value: Math.round(sessionDuration / 1000),
      });

      // Track engagement level based on session duration
      const engagementLevel = sessionDuration < 3000 ? 'quick' : 
                             sessionDuration < 10000 ? 'moderate' : 'engaged';
      ReactGA4.event({
        category: 'Settings',
        action: 'settings_engagement',
        label: engagementLevel,
        value: Math.round(sessionDuration / 1000),
      });
    }

    // Track interaction count during session
    ReactGA4.event({
      category: 'Settings',
      action: 'modal_interactions',
      label: `${settingsInteractionCountRef.current}_interactions`,
      value: settingsInteractionCountRef.current,
    });

    // Reset tracking refs
    modalOpenTimeRef.current = null;
    settingsInteractionCountRef.current = 0;
  };

  // Track settings interaction (called from modal)
  useEffect(() => {
    if (isModalOpen) {
      const incrementInteractionCount = () => {
        settingsInteractionCountRef.current += 1;
      };

      // Listen for any clicks within the modal area
      const modalElement = document.querySelector('.settings-modal');
      if (modalElement) {
        modalElement.addEventListener('click', incrementInteractionCount);
        return () => {
          modalElement.removeEventListener('click', incrementInteractionCount);
        };
      }
    }
  }, [isModalOpen]);

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