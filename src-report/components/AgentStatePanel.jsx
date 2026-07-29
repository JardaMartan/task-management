import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';
import { formatClock, formatDuration } from '../format';
import { fallbackBreakdown, breakdownTotals } from '../stateModel';
import StateDistribution from './StateDistribution';

/**
 * Agent shift + state summary. Uses the authoritative Webex CC state breakdown
 * (engaged, wrap-up, available, idle-by-reason, ringing) when available; falls
 * back to engaged + wrap-up derived from our interaction events otherwise. The
 * time-aligned state lane itself is rendered inside the activity timeline (so it
 * shares the tasks' zoom); this panel shows the shift KPIs + distribution bar.
 */
export default function AgentStatePanel({ overview, agentState, live }) {
  const { t } = useI18n();
  const occupiedMs = overview?.busyMs || 0;
  const wrapupMs = overview?.totalWrapupMs || 0;

  const hasState = Array.isArray(agentState?.breakdown) && agentState.breakdown.length > 0;
  const breakdown = hasState ? agentState.breakdown : fallbackBreakdown(occupiedMs, wrapupMs);
  const totals = breakdownTotals(breakdown);
  const login = agentState?.loginMs || null;

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

      {!hasState && <div className="statepanel__note">{t('state.sourceNote')}</div>}
    </section>
  );
}

AgentStatePanel.propTypes = {
  overview: PropTypes.object,
  agentState: PropTypes.object,
  live: PropTypes.bool,
};
