import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setActiveSection } from '../store/slices/experienceSlice';

// Section-level pill toggle (Email | Chat). Chat is scaffolded / disabled.
const SECTIONS = [
  { value: 'email', enabled: true },
  { value: 'chat', enabled: false },
];

export default function SectionNav() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const active = useSelector((s) => s.experience.activeSection);

  return (
    <div className="exp-pill-seg" role="tablist" aria-label={t('app.title')}>
      {SECTIONS.map((sec) => (
        <button
          key={sec.value}
          type="button"
          role="tab"
          aria-selected={active === sec.value}
          disabled={!sec.enabled}
          title={sec.enabled ? undefined : t('section.chatComingSoon')}
          className={`exp-pill-seg__btn${active === sec.value ? ' is-active' : ''}${sec.enabled ? '' : ' is-disabled'}`}
          onClick={() => sec.enabled && dispatch(setActiveSection(sec.value))}
        >
          {t(`section.${sec.value}`)}
        </button>
      ))}
    </div>
  );
}
