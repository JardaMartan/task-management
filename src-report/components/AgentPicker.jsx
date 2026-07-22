import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { selectAgent } from '../store/slices/activitySlice';
import SearchableSelect from './SearchableSelect';

export default function AgentPicker() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const agents = useSelector((s) => s.activity.agents);
  const selectedAgentId = useSelector((s) => s.activity.selectedAgentId);

  return (
    <SearchableSelect
      label={t('controls.agent')}
      value={selectedAgentId || ''}
      options={agents}
      onChange={(id) => id && dispatch(selectAgent(id))}
      placeholder={t('controls.searchPlaceholder')}
      noResultsText={t('controls.noResults')}
    />
  );
}
