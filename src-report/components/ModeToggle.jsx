import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { changeMode, refresh } from '../store/slices/activitySlice';
import PillToggle from './PillToggle';
import RangeControl from './RangeControl';

export default function ModeToggle() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const mode = useSelector((s) => s.activity.mode);

  return (
    <div className="toggle-group">
      <PillToggle
        label={t('controls.mode')}
        ariaLabel={t('controls.mode')}
        value={mode}
        onChange={(v) => dispatch(changeMode(v))}
        options={[
          { value: 'historical', label: t('controls.historical') },
          { value: 'live', label: t('controls.live'), dot: true },
        ]}
      />

      <RangeControl />

      {mode === 'historical' && (
        <button type="button" className="pill-btn" onClick={() => dispatch(refresh())}>
          {t('controls.refresh')}
        </button>
      )}
    </div>
  );
}
