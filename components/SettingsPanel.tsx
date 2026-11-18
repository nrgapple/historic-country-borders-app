import React, { useId } from 'react';
import Dialog from './Dialog';
import { TextSize, useSettings } from '../contexts/SettingsContext';
import { useChrome } from '../contexts/ChromeContext';

const TEXT_SIZES: Array<{ value: TextSize; label: string }> = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="field field--inline">
      <div>
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        {description && <p className="field__hint">{description}</p>}
      </div>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="field">
      <div className="field__row">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <output className="field__value" htmlFor={id}>
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export default function SettingsPanel() {
  const { settings, updateSettings, resetToDefaults } = useSettings();
  const { overlay, closeOverlay } = useChrome();
  const sizeGroupId = useId();

  return (
    <Dialog
      open={overlay === 'settings'}
      onClose={closeOverlay}
      title="Map settings"
      modal={false}
      className="settings-panel"
    >
      <Switch
        label="Labels"
        description="Territory and city names"
        checked={settings.showLabels}
        onChange={(showLabels) => updateSettings({ showLabels })}
      />

      <fieldset className="field" disabled={!settings.showLabels}>
        <legend className="field__label" id={sizeGroupId}>
          Label size
        </legend>
        <div
          className="segmented"
          role="radiogroup"
          aria-labelledby={sizeGroupId}
        >
          {TEXT_SIZES.map((option) => (
            <label key={option.value} className="segmented__option">
              <input
                type="radio"
                name="label-size"
                value={option.value}
                checked={settings.textSize === option.value}
                onChange={() => updateSettings({ textSize: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Switch
        label="Uppercase labels"
        checked={settings.textCase === 'upper'}
        onChange={(upper) =>
          updateSettings({ textCase: upper ? 'upper' : 'regular' })
        }
      />

      <Range
        label="Fill opacity"
        value={settings.countryOpacity}
        min={0.1}
        max={1}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(countryOpacity) => updateSettings({ countryOpacity })}
      />

      <Range
        label="Border width"
        value={settings.borderThickness}
        min={0}
        max={4}
        step={0.5}
        format={(value) => (value === 0 ? 'Hidden' : `${value}`)}
        onChange={(borderThickness) => updateSettings({ borderThickness })}
      />

      <div className="dialog__actions">
        <button type="button" className="text-button" onClick={resetToDefaults}>
          Reset to defaults
        </button>
      </div>
    </Dialog>
  );
}
