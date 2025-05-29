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
      
      const hour = new Date().getHours();
      const timeOfDay = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      
      ReactGA4.event('settings_open', {
        time_of_day: timeOfDay,
        hour_of_day: hour,
        ui_element: 'settings_button'
      });
    } else {
      handleCloseModal();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    
    // Calculate session duration
    const sessionDuration = modalOpenTimeRef.current ? Date.now() - modalOpenTimeRef.current : 0;
    const sessionDurationSeconds = Math.round(sessionDuration / 1000);
    
    // Determine engagement level based on session duration and interactions
    const engagementLevel = sessionDuration < 3000 ? 'quick_look' : 
                           sessionDuration < 10000 ? 'moderate_engagement' : 'deep_engagement';
    
    ReactGA4.event('settings_close', {
      session_duration_ms: sessionDuration,
      session_duration_seconds: sessionDurationSeconds,
      interaction_count: settingsInteractionCountRef.current,
      engagement_level: engagementLevel,
      session_quality: settingsInteractionCountRef.current === 0 ? 'no_interaction' : 
                      settingsInteractionCountRef.current < 3 ? 'low_interaction' : 'high_interaction'
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