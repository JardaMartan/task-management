import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { selectTeam } from '../store/slices/activitySlice';
import SearchableSelect from './SearchableSelect';

export default function TeamPicker() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const teams = useSelector((s) => s.activity.teams);
  const selectedTeamId = useSelector((s) => s.activity.selectedTeamId);

  return (
    <SearchableSelect
      label={t('controls.team')}
      value={selectedTeamId || ''}
      options={teams}
      onChange={(id) => dispatch(selectTeam(id || null))}
      placeholder={t('controls.searchPlaceholder')}
      noResultsText={t('controls.noResults')}
      emptyOption={{ label: t('controls.teamAll') }}
      formatOption={(tm) => `${tm.name}${typeof tm.memberCount === 'number' ? ` (${tm.memberCount})` : ''}`}
    />
  );
}
