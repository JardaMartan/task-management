import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setViewMode } from '../store/slices/reskillSlice';

/** Segmented pill control (Momentum look, matching the Agent Activity widget)
 * switching the centre column between the per-skill grid and the profile-centric
 * assignment view. */
const ViewModeToggle = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const viewMode = useSelector((s) => s.reskill.viewMode);

  const options = [
    { value: 'grid', label: t('view.grid') },
    { value: 'profiles', label: t('view.profiles') },
  ];

  return (
    <div className="reskill-pill-seg" role="tablist" aria-label={t('view.label')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={viewMode === o.value}
          className={`reskill-pill-seg__btn${viewMode === o.value ? ' is-active' : ''}`}
          onClick={() => { if (viewMode !== o.value) dispatch(setViewMode(o.value)); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};

export default ViewModeToggle;
