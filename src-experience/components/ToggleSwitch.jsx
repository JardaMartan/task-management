import React from 'react';

/**
 * Momentum-style toggle switch (pill track + sliding knob). `tone` selects the
 * "on" colour: 'accent' (blue) or 'on' (green).
 */
export default function ToggleSwitch({
  checked, onChange, disabled = false, label, tone = 'accent', ariaLabel,
}) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={`exp-switchctl exp-switchctl--${tone}${disabled ? ' is-disabled' : ''}`}>
      <input
        type="checkbox"
        className="exp-switchctl__input"
        checked={Boolean(checked)}
        disabled={disabled}
        aria-label={ariaLabel || label}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="exp-switchctl__track">
        <span className="exp-switchctl__knob" />
      </span>
      {label && <span className="exp-switchctl__label">{label}</span>}
    </label>
  );
}
