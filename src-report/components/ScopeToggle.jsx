import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { changeScope } from '../store/slices/activitySlice';
import PillToggle from './PillToggle';

export default function ScopeToggle() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const scope = useSelector((s) => s.activity.scope);

  return (
    <PillToggle
      label={t('controls.scope')}
      ariaLabel={t('controls.scope')}
      value={scope}
      onChange={(v) => dispatch(changeScope(v))}
      options={[
        { value: 'agent', label: t('controls.agentScope') },
        { value: 'team', label: t('controls.teamScope') },
      ]}
    />
  );
}
