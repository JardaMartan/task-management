import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setActiveSubtab } from '../store/slices/experienceSlice';
import { EMAIL_SUBTABS } from '../constants';

// Sub-section pill toggle (Templates | Signatures | Proof-reading prompt).
export default function SubTabNav() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const active = useSelector((s) => s.experience.activeSubtab);

  return (
    <div className="exp-pill-seg" role="tablist" aria-label={t('subtab.templates')}>
      {EMAIL_SUBTABS.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          className={`exp-pill-seg__btn${active === tab ? ' is-active' : ''}`}
          onClick={() => dispatch(setActiveSubtab(tab))}
        >
          {t(`subtab.${tab}`)}
        </button>
      ))}
    </div>
  );
}
