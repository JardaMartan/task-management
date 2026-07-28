import React from 'react';

/**
 * Momentum-style toggle switch (pill track + sliding knob). Replaces native
 * checkboxes for on/off controls. `tone` selects the "on" colour:
 *   - 'accent' (default) → blue, used for UI filter toggles
 *   - 'on'               → green, used for boolean skill values
 */
export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  tone = 'accent',
  ariaLabel,
}) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={`reskill-switchctl reskill-switchctl--${tone}${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        className="reskill-switchctl__input"
        checked={Boolean(checked)}
        disabled={disabled}
        aria-label={ariaLabel || label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="reskill-switchctl__track">
        <span className="reskill-switchctl__knob" />
      </span>
      {label && <span className="reskill-switchctl__label">{label}</span>}
    </label>
  );
}
