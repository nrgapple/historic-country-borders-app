import { useId } from 'react';
import { useSettings } from '../atlas/hooks';
import { COLOUR_BY, COLOUR_BY_LABELS } from './colourBy';

const HINTS = {
  default: 'Neighbouring districts never share a colour',
  football: 'PIAA football class, 1A to 6A',
  piaa: 'The 12 PIAA districts that run playoffs',
  enrollment: 'Students in grades 9–11, PIAA’s count',
} as const;

/** The PA settings field "Colour districts by" (src/pa/colourBy.ts). */
export default function ColourByField() {
  const { settings, updateSettings } = useSettings();
  const groupId = useId();
  const hintId = useId();
  return (
    <fieldset className="field">
      <legend className="field__label" id={groupId}>
        Colour districts by
      </legend>
      <div
        className="segmented pa-colour-by"
        role="radiogroup"
        aria-labelledby={groupId}
        aria-describedby={hintId}
      >
        {COLOUR_BY.map((mode) => (
          <label key={mode} className="segmented__option">
            <input
              type="radio"
              name="pa-colour-by"
              value={mode}
              checked={settings.paColourBy === mode}
              onChange={() => updateSettings({ paColourBy: mode })}
            />
            <span>{COLOUR_BY_LABELS[mode]}</span>
          </label>
        ))}
      </div>
      <p className="field__hint" id={hintId}>
        {HINTS[settings.paColourBy]}
      </p>
    </fieldset>
  );
}
