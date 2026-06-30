import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setAgentStateFilter } from '../store/slices/reskillSlice';

/** Indicator bar shown when the agent-state donut filter is active. */
const AgentFilterChip = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const filter = useSelector((s) => s.reskill.agentStateFilter);
  if (!filter) return null;
  return (
    <div className="reskill-filter-bar">
      <span className="reskill-filter-bar__label">{t('matrix.stateFilter')}</span>
      <button
        type="button"
        className="reskill-filter-chip"
        onClick={() => dispatch(setAgentStateFilter(filter))}
      >
        {t(`analytics.state.${filter}`)} ×
      </button>
    </div>
  );
};

export default AgentFilterChip;
