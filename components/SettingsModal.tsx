import React, { useState, useEffect } from 'react';
import { useSettings, TextSize, TextCase } from '../contexts/SettingsContext';
import { InfoProvider } from '../hooks/useCountryInfo';
import { useCompare, ComparisonItem } from '../contexts/CompareContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'settings' | 'history';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetToDefaults } = useSettings();
  const { history, showComparison } = useCompare();
  const [activeTab, setActiveTab] = useState<SettingsTab>('settings');

  // Load history when modal opens
  useEffect(() => {
    if (isOpen) {
      // History is automatically loaded in CompareProvider
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const textSizeOptions: { value: TextSize; label: string; description: string }[] = [
    { value: 'small', label: 'Small', description: 'Compact text' },
    { value: 'medium', label: 'Medium', description: 'Default size' },
    { value: 'large', label: 'Large', description: 'Easy to read' },
  ];

  const textCaseOptions: { value: TextCase; label: string; description: string }[] = [
    { value: 'regular', label: 'Regular', description: 'Normal case' },
    { value: 'upper', label: 'UPPERCASE', description: 'All capitals' },
  ];

  const infoProviderOptions: { value: InfoProvider; label: string; description: string; icon: string }[] = [
    { value: 'wikipedia', label: 'Wikipedia', description: 'Real-time Wikipedia content', icon: '📚' },
    { value: 'ai', label: 'AI (Beta)', description: 'AI-generated historical context', icon: '🤖' },
  ];

  const opacityOptions = [
    { value: 0.1, label: '10%' },
    { value: 0.2, label: '20%' },
    { value: 0.3, label: '30%' },
    { value: 0.4, label: '40%' },
    { value: 0.5, label: '50%' },
    { value: 0.6, label: '60%' },
    { value: 0.7, label: '70%' },
    { value: 0.8, label: '80%' },
    { value: 0.9, label: '90%' },
    { value: 1.0, label: '100%' },
  ];

  const handleHistoryItemClick = (comparison: ComparisonItem) => {
    showComparison(comparison);
    onClose();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div 
        className="settings-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h3 className="settings-modal-title" id="settings-modal-title">⚙️ Settings</h3>
          <button
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ Settings
          </button>
          <button
            className={`settings-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            📊 Compare History ({history.length})
          </button>
        </div>

        <div className="settings-modal-content">
          {activeTab === 'settings' ? (
            <>
              {/* Information Provider Setting */}
              <div className="settings-section">
                <div className="settings-section-title">🤖 Information Source</div>
                <div className="settings-options">
                  {infoProviderOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`settings-option ${
                        settings.infoProvider === option.value ? 'active' : ''
                      }`}
                      onClick={() => updateSettings({ infoProvider: option.value })}
                    >
                      <div className="settings-option-label">
                        {option.icon} {option.label}
                      </div>
                      <div className="settings-option-description">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Compare Feature Setting */}
              <div className="settings-section">
                <div className="settings-section-title">🔀 AI Compare Feature</div>
                <div className="settings-options">
                  <button
                    className={`settings-option ${settings.aiCompareEnabled ? 'active' : ''}`}
                    onClick={() => updateSettings({ aiCompareEnabled: !settings.aiCompareEnabled })}
                  >
                    <div className="settings-option-label">
                      {settings.aiCompareEnabled ? '✅' : '❌'} AI Compare Mode
                    </div>
                    <div className="settings-option-description">
                      {settings.aiCompareEnabled 
                        ? 'Compare countries side-by-side with AI analysis'
                        : 'Enable to compare countries/territories across time periods'
                      }
                    </div>
                  </button>
                </div>
              </div>

              {/* Text Size Setting */}
              <div className="settings-section">
                <div className="settings-section-title">📝 Text Size</div>
                <div className="settings-options">
                  {textSizeOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`settings-option ${
                        settings.textSize === option.value ? 'active' : ''
                      }`}
                      onClick={() => updateSettings({ textSize: option.value })}
                    >
                      <div className="settings-option-label">{option.label}</div>
                      <div className="settings-option-description">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Case Setting */}
              <div className="settings-section">
                <div className="settings-section-title">🔤 Text Case</div>
                <div className="settings-options">
                  {textCaseOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`settings-option ${
                        settings.textCase === option.value ? 'active' : ''
                      }`}
                      onClick={() => updateSettings({ textCase: option.value })}
                    >
                      <div className="settings-option-label">{option.label}</div>
                      <div className="settings-option-description">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Opacity Setting */}
              <div className="settings-section">
                <div className="settings-section-title">🎨 Country Color Opacity</div>
                <div className="settings-opacity-grid">
                  {opacityOptions.map((option) => (
                    <button
                      key={option.value}
                      className={`settings-opacity-option ${
                        settings.countryOpacity === option.value ? 'active' : ''
                      }`}
                      onClick={() => updateSettings({ countryOpacity: option.value })}
                      style={{
                        backgroundColor: `rgba(139, 69, 19, ${option.value})`,
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <div className="settings-actions">
                <button
                  className="settings-reset-button"
                  onClick={resetToDefaults}
                >
                  🔄 Reset to Defaults
                </button>
              </div>
            </>
          ) : (
            /* History Tab Content */
            <div className="compare-history">
              <div className="compare-history-header">
                <h4>Recent AI Comparisons</h4>
                <p>Click any comparison to view it again</p>
              </div>
              {history.length === 0 ? (
                <div className="compare-history-empty">
                  <p>No comparisons yet</p>
                  <p>Try comparing countries with the AI Compare feature!</p>
                </div>
              ) : (
                <div className="compare-history-list">
                  {history.map((comparison) => (
                    <button
                      key={comparison.id}
                      className="compare-history-item"
                      onClick={() => handleHistoryItemClick(comparison)}
                    >
                      <div className="compare-history-item-header">
                        <div className="compare-countries">
                          <span className="country1">
                            {comparison.country1.name} ({comparison.country1.year})
                          </span>
                          <span className="vs">vs</span>
                          <span className="country2">
                            {comparison.country2.name} ({comparison.country2.year})
                          </span>
                        </div>
                        <div className="compare-date">
                          {formatDate(comparison.createdAt)}
                        </div>
                      </div>
                      <div className="compare-preview">
                        {comparison.content.substring(0, 120)}...
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 