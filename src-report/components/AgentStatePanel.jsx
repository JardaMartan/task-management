import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration } from '../format';
import { fallbackBreakdown, breakdownTotals } from '../stateModel';
import StateDistribution from './StateDistribution';
import StateTimeline from './StateTimeline';

/**
 * Agent shift + state panel. Uses the authoritative Webex CC state breakdown
 * (engaged, wrap-up, available, idle-by-reason, ringing) when available; falls
 * back to engaged + wrap-up derived from our interaction events otherwise.
 */
export default function AgentStatePanel({ overview, agentState, live }) {
  const { t } = useI18n();
  const occupiedMs = overview?.busyMs || 0;
  const wrapupMs = overview?.totalWrapupMs || 0;

  const hasState = Array.isArray(agentState?.breakdown) && agentState.breakdown.length > 0;
  const breakdown = hasState ? agentState.breakdown : fallbackBreakdown(occupiedMs, wrapupMs);
  const totals = breakdownTotals(breakdown);
  const login = agentState?.loginMs || null;
  const segments = agentState?.segments || null;

  return (
    <section className="statepanel" aria-label={t('state.title')}>
      <div className="statepanel__head">
        <h3 className="statepanel__title">{t('state.title')}</h3>
        <div className="statepanel__summary">
          {login && <span className="statepanel__shift">{t('state.shiftSince', { time: formatClock(login) })}</span>}
          <span className="statepanel__kpi">{t('state.wrapup')}: <strong>{formatDuration(totals.wrapupMs || wrapupMs)}</strong></span>
          {hasState && <span className="statepanel__kpi">{t('state.idle')}: <strong>{formatDuration(totals.idleMs)}</strong></span>}
        </div>
      </div>

      <StateDistribution breakdown={breakdown} />

      {agentState && (agentState.loginMs || (segments && segments.length > 0)) && (
        <StateTimeline segments={segments} loginMs={agentState.loginMs} logoutMs={agentState.logoutMs} live={live} />
      )}

      {!hasState && <div className="statepanel__note">{t('state.sourceNote')}</div>}
    </section>
  );
}

AgentStatePanel.propTypes = {
  overview: PropTypes.object,
  agentState: PropTypes.object,
  live: PropTypes.bool,
};
