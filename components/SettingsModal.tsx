import React from 'react';
import { useSettings, TextSize, TextCase } from '../contexts/SettingsContext';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings, resetToDefaults } = useSettings();
  if (!isOpen) return null;

  const textSizeOptions: Array<{
    value: TextSize;
    label: string;
    description: string;
  }> = [
    { value: 'small', label: 'Small', description: 'Compact text' },
    { value: 'medium', label: 'Medium', description: 'Default size' },
    { value: 'large', label: 'Large', description: 'Easy to read' },
  ];
  const textCaseOptions: Array<{
    value: TextCase;
    label: string;
    description: string;
  }> = [
    { value: 'regular', label: 'Regular', description: 'Normal case' },
    { value: 'upper', label: 'UPPERCASE', description: 'All capitals' },
  ];
  const opacityOptions = Array.from({ length: 10 }, (_, index) => {
    const value = (index + 1) / 10;
    return { value, label: `${(index + 1) * 10}%` };
  });
  const borderThicknessOptions = [
    { value: 0, label: '0px', description: 'No border' },
    { value: 1, label: '1px', description: 'Very thin' },
    { value: 2, label: '2px', description: 'Thin (default)' },
    { value: 3, label: '3px', description: 'Medium' },
    { value: 4, label: '4px', description: 'Thick' },
  ];

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="settings-modal-header">
          <h3 className="settings-modal-title" id="settings-modal-title">
            ⚙️ Settings
          </h3>
          <button
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>
        <div className="settings-modal-content">
          <div className="settings-section">
            <div className="settings-section-title">🏷️ Map Labels</div>
            <div className="settings-options">
              <button
                className={`settings-option ${settings.showLabels ? 'active' : ''}`}
                onClick={() =>
                  updateSettings({ showLabels: !settings.showLabels })
                }
              >
                <div className="settings-option-label">
                  {settings.showLabels ? '👁️' : '🚫'} Show Labels
                </div>
                <div className="settings-option-description">
                  {settings.showLabels
                    ? 'Country and place labels are visible on the map'
                    : 'Hide all text labels for a cleaner map view'}
                </div>
              </button>
            </div>
          </div>

          <OptionSection title="📝 Text Size">
            {textSizeOptions.map((option) => (
              <OptionButton
                key={option.value}
                active={settings.textSize === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateSettings({ textSize: option.value })}
              />
            ))}
          </OptionSection>

          <OptionSection title="🔤 Text Case">
            {textCaseOptions.map((option) => (
              <OptionButton
                key={option.value}
                active={settings.textCase === option.value}
                label={option.label}
                description={option.description}
                onClick={() => updateSettings({ textCase: option.value })}
              />
            ))}
          </OptionSection>

          <div className="settings-section">
            <div className="settings-section-title">
              🎨 Country Color Opacity
            </div>
            <div className="settings-opacity-grid">
              {opacityOptions.map((option) => (
                <button
                  key={option.value}
                  className={`settings-opacity-option ${
                    settings.countryOpacity === option.value ? 'active' : ''
                  }`}
                  onClick={() =>
                    updateSettings({ countryOpacity: option.value })
                  }
                  style={{
                    backgroundColor: `rgba(139, 69, 19, ${option.value})`,
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <OptionSection title="📏 Border Thickness">
            {borderThicknessOptions.map((option) => (
              <OptionButton
                key={option.value}
                active={settings.borderThickness === option.value}
                label={option.label}
                description={option.description}
                onClick={() =>
                  updateSettings({ borderThickness: option.value })
                }
              />
            ))}
          </OptionSection>

          <div className="settings-actions">
            <button className="settings-reset-button" onClick={resetToDefaults}>
              🔄 Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-title">{title}</div>
      <div className="settings-options">{children}</div>
    </div>
  );
}

function OptionButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`settings-option ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="settings-option-label">{label}</div>
      <div className="settings-option-description">{description}</div>
    </button>
  );
}
