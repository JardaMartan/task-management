import React from 'react';

/**
 * Compact segmented pill toggle. `options` = [{ value, label, dot }]. `dot`
 * (optional) renders a small status dot before the label (e.g. Live).
 */
export default function PillToggle({ label, value, options, onChange, ariaLabel }) {
  return (
    <div className="pill-ctl">
      {label && <span className="pill-ctl__label">{label}</span>}
      <div className="pill-seg" role="tablist" aria-label={ariaLabel || label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={value === o.value}
            className={`pill-seg__btn ${value === o.value ? 'is-active' : ''}`}
            onClick={() => { if (value !== o.value) onChange(o.value); }}
          >
            {o.dot && <span className={`pill-seg__dot ${value === o.value ? 'is-on' : ''}`} />}
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
