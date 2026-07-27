import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';

// Format a signed millisecond duration as H:MM:SS (or M:SS under an hour).
const pad = (n) => String(n).padStart(2, '0');
const formatRemaining = (ms) => {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/**
 * SLA expiration countdown for the active email task.
 *
 * Reads `email.slaExpiresAt` (epoch ms, sourced from the reportable Global
 * Variable via the Search API) and ticks locally once per second. Colour state:
 *   ok       – more than the configured threshold remains  (green)
 *   imminent – within `slaThresholdMinutes` of expiry       (amber)
 *   expired  – past due                                     (red)
 * Renders nothing when no SLA is known for the task.
 */
const SlaCountdown = ({ darkMode }) => {
  const { t } = useI18n();
  const slaExpiresAt = useSelector((state) => state.email.slaExpiresAt);
  const thresholdMin = useSelector(
    (state) => state.widget?.emailConfig?.slaThresholdMinutes ?? 15
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!slaExpiresAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [slaExpiresAt]);

  if (!slaExpiresAt) return null;

  const remaining = slaExpiresAt - now;
  const expired = remaining <= 0;
  const imminent = !expired && remaining <= thresholdMin * 60_000;
  const level = expired ? 'expired' : imminent ? 'imminent' : 'ok';

  return (
    <span
      className={`email-sla email-sla--${level}${darkMode ? ' md--dark' : ''}`}
      role="timer"
      aria-live="polite"
      title={`${t('email.sla.title')}: ${new Date(slaExpiresAt).toLocaleString()}`}
    >
      <Icon name="recents_12" className="email-sla__icon" />
      <span className="email-sla__label">
        {expired ? t('email.sla.expired') : t('email.sla.remaining')}
      </span>
      <span className="email-sla__time">
        {expired ? `-${formatRemaining(remaining)}` : formatRemaining(remaining)}
      </span>
    </span>
  );
};

SlaCountdown.propTypes = {
  darkMode: PropTypes.bool,
};

SlaCountdown.defaultProps = {
  darkMode: false,
};

export default SlaCountdown;
