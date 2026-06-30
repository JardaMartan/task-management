import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setViewMode } from '../store/slices/reskillSlice';

/** Segmented control switching the centre column between the per-skill grid and
 * the profile-centric assignment view. */
const ViewModeToggle = () => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const viewMode = useSelector((s) => s.reskill.viewMode);

  return (
    <div className="reskill-segmented" role="tablist" aria-label={t('view.label')}>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'grid'}
        className={`reskill-segmented__btn${viewMode === 'grid' ? ' reskill-segmented__btn--active' : ''}`}
        onClick={() => dispatch(setViewMode('grid'))}
      >
        {t('view.grid')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={viewMode === 'profiles'}
        className={`reskill-segmented__btn${viewMode === 'profiles' ? ' reskill-segmented__btn--active' : ''}`}
        onClick={() => dispatch(setViewMode('profiles'))}
      >
        {t('view.profiles')}
      </button>
    </div>
  );
};

export default ViewModeToggle;
