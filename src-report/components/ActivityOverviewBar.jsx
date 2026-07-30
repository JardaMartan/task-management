import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatDuration, formatPercent } from '../format';

const CHANNEL_COLORS = {
  email: '#0e7fc1', chat: '#1a7f37', voice: '#9854cb', telephony: '#9854cb',
  social: '#17a2b8', custom: '#e0559b', sms: '#f5a623', workitem: '#c1440e',
  unknown: '#97a4b1',
};

export default function ActivityOverviewBar({ overview, open = true, onToggle }) {
  const { t } = useI18n();
  if (!overview) return null;

  const cards = [
    { key: 'handled', label: t('overview.handled'), value: String(overview.handled) },
    { key: 'concurrencyAvg', label: t('overview.concurrencyAvg'), value: overview.avgConcurrency.toFixed(1) },
    { key: 'concurrencyMax', label: t('overview.concurrencyMax'), value: String(overview.maxConcurrency) },
    { key: 'ahtAvg', label: t('overview.ahtAvg'), value: formatDuration(overview.ahtMs) },
    { key: 'interruptions', label: t('overview.interruptions'), value: String(overview.totalInterruptions) },
    { key: 'focusTime', label: t('overview.focusTime'), value: formatDuration(overview.totalFocusMs) },
    { key: 'wrapup', label: t('overview.wrapup'), value: formatDuration(overview.totalWrapupMs) },
    { key: 'occupancy', label: t('overview.occupancy'), value: formatPercent(overview.occupancy) },
  ];

  const maxHandleAny = Math.max(1, ...overview.perChannel.map((c) => c.maxHandleMs || 0));
  const clampPct = (ms) => Math.max(0, Math.min(100, (ms / maxHandleAny) * 100));

  return (
    <section className={`overview ${open ? '' : 'overview--collapsed'}`} aria-label={t('overview.title')}>
      <div className="overview__bar">
        <button
          type="button"
          className="overview__toggle"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? t('overview.collapse') : t('overview.expand')}
          title={open ? t('overview.collapse') : t('overview.expand')}
        >
          <svg className={`overview__chevron ${open ? 'is-open' : ''}`} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 4.5 L6 7.5 L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="overview__bar-title">{t('overview.title')}</span>
        </button>
        {!open && (
          <span className="overview__summary">
            {cards.map((c) => (
              <span className="overview__summary-item" key={c.key} title={c.label}>
                <strong>{c.value}</strong> {c.label}
              </span>
            ))}
            {overview.perChannel.length > 0 && (
              <span className="overview__summary-chans">
                {overview.perChannel.map((c) => {
                  const color = CHANNEL_COLORS[c.channel] || CHANNEL_COLORS.unknown;
                  return (
                    <span
                      className="overview__summary-chan"
                      key={c.channel}
                      title={`${t(`channel.${c.channel}`) || c.channel}: ${c.count} · ${t('overview.chanHandle')} ${formatDuration(c.handleMs)} · ${t('overview.chanFocus')} ${formatDuration(c.focusMs)}`}
                    >
                      <span className="chan-row__dot" style={{ background: color }} />
                      {t(`channel.${c.channel}`) || c.channel}
                      <strong>{c.count}</strong>
                    </span>
                  );
                })}
              </span>
            )}
          </span>
        )}
      </div>

      {open && (
      <div className="overview__body">
      <div className="overview__cards">
        {cards.map((c) => (
          <div className="kpi" key={c.key}>
            <div className="kpi__value">{c.value}</div>
            <div className="kpi__label">{c.label}</div>
          </div>
        ))}
      </div>

      {overview.perChannel.length > 0 && (
        <div className="overview__channels">
          <div className="overview__channels-title">
            {t('overview.perChannel')} <span className="overview__hint">· {t('overview.handleSpread')}</span>
          </div>
          <div className="chan-table">
            <div className="chan-table__head">
              <span />
              <span />
              <span className="chan-table__num">{t('overview.chanCount')}</span>
              <span className="chan-table__num">{t('overview.chanHandle')}</span>
              <span className="chan-table__num">{t('overview.chanFocus')}</span>
              <span className="chan-table__num">{t('overview.chanWrapup')}</span>
              <span className="chan-table__num">{t('overview.chanAvgHandle')}</span>
              <span className="chan-table__num">{t('overview.chanAvgFocus')}</span>
            </div>
            {overview.perChannel.map((c) => {
              const color = CHANNEL_COLORS[c.channel] || CHANNEL_COLORS.unknown;
              const minP = clampPct(c.minHandleMs);
              const maxP = clampPct(c.maxHandleMs);
              const avgP = clampPct(c.avgHandleMs);
              return (
                <div className="chan-row" key={c.channel}>
                  <span className="chan-row__ch">
                    <span className="chan-row__dot" style={{ background: color }} />
                    <span className="chan-row__chname">{t(`channel.${c.channel}`) || c.channel}</span>
                  </span>
                  <span
                    className="chan-row__track chan-row__track--range"
                    title={`${t('overview.chanHandle')} — ${t('overview.rangeMin')} ${formatDuration(c.minHandleMs)} · ${t('overview.chanAvgHandle')} ${formatDuration(c.avgHandleMs)} · ${t('overview.rangeMax')} ${formatDuration(c.maxHandleMs)}`}
                  >
                    <span className="chan-range" style={{ left: `${minP}%`, width: `${Math.max(maxP - minP, 0.6)}%`, background: color }} />
                    <span className="chan-cap" style={{ left: `${minP}%`, background: color }} />
                    <span className="chan-cap" style={{ left: `${maxP}%`, background: color }} />
                    <span className="chan-avg" style={{ left: `${avgP}%`, background: color }} />
                  </span>
                  <span className="chan-table__num">{c.count}</span>
                  <span className="chan-table__num"><strong>{formatDuration(c.handleMs)}</strong></span>
                  <span className="chan-table__num chan-focus">{formatDuration(c.focusMs)}</span>
                  <span className="chan-table__num chan-wrap">{formatDuration(c.wrapupMs)}</span>
                  <span className="chan-table__num">{formatDuration(c.avgHandleMs)}</span>
                  <span className="chan-table__num chan-focus">{formatDuration(c.avgFocusMs)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
      )}
    </section>
  );
}

ActivityOverviewBar.propTypes = {
  overview: PropTypes.object,
  open: PropTypes.bool,
  onToggle: PropTypes.func,
};
