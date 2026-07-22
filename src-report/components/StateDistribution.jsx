import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatDuration } from '../format';
import { stateColor, breakdownTotals, stateLabelKey } from '../stateModel';

/**
 * Stacked state-distribution bar for a shift, driven by a breakdown array of
 * { code, name, ms } segments (Webex CC AAR, or event-derived fallback).
 * `compact` renders just the bar (team gutter).
 */
export default function StateDistribution({ breakdown = [], compact = false }) {
  const { t } = useI18n();
  const { total } = breakdownTotals(breakdown);
  const visible = breakdown.filter((s) => s.ms > 0);
  const label = (s) => s.name || t(stateLabelKey(s.code)) || s.code;

  return (
    <div className={`statebar ${compact ? 'statebar--compact' : ''}`}>
      <div className="statebar__track">
        {visible.map((s, i) => (
          <span
            key={`${s.code}-${i}`}
            className="statebar__seg"
            style={{ width: `${(s.ms / total) * 100}%`, background: stateColor(s.code) }}
            title={`${label(s)}: ${formatDuration(s.ms)}`}
          />
        ))}
      </div>
      {!compact && (
        <div className="statebar__legend">
          {visible.map((s, i) => (
            <span className="statebar__chip" key={`${s.code}-${i}`}>
              <span className="statebar__dot" style={{ background: stateColor(s.code) }} />
              {label(s)} <strong>{formatDuration(s.ms)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

StateDistribution.propTypes = {
  breakdown: PropTypes.array,
  compact: PropTypes.bool,
};
