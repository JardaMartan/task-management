import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setActiveLanguage, addLanguage } from '../store/slices/experienceSlice';

// Endonym for a language code (e.g. 'de' → 'Deutsch'); falls back to the code.
export function languageLabel(code) {
  try {
    const dn = new Intl.DisplayNames([code], { type: 'language' });
    const name = dn.of(code);
    if (name && name.toLowerCase() !== code.toLowerCase()) {
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
  } catch (_e) { /* ignore */ }
  return String(code || '').toUpperCase();
}

/**
 * First-level language selector for the template set. The chosen language drives
 * which flavor of every template is shown. New languages can be added on the fly.
 */
export default function LanguageBar() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const languages = useSelector((s) => s.experience.config.languages || []);
  const activeLanguage = useSelector((s) => s.experience.activeLanguage);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const commit = () => {
    const code = draft.trim().toLowerCase();
    if (/^[a-z]{2,5}(-[a-z0-9]{2,8})?$/.test(code)) dispatch(addLanguage(code));
    setDraft('');
    setAdding(false);
  };

  return (
    <div className="exp-langbar">
      <span className="exp-langbar__label">{t('templates.language')}</span>
      <div className="exp-pill-seg" role="tablist" aria-label={t('templates.language')}>
        {languages.map((code) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={activeLanguage === code}
            title={languageLabel(code)}
            className={`exp-pill-seg__btn${activeLanguage === code ? ' is-active' : ''}`}
            onClick={() => dispatch(setActiveLanguage(code))}
          >
            {languageLabel(code)}
          </button>
        ))}
      </div>
      {adding ? (
        <span className="exp-langbar__add">
          <input
            className="exp-input exp-langbar__input"
            autoFocus
            value={draft}
            placeholder={t('templates.languageCode')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'Escape') { setDraft(''); setAdding(false); }
            }}
          />
          <button type="button" className="exp-btn exp-btn--sm exp-btn--primary" onClick={commit}>
            {t('common.add')}
          </button>
          <button type="button" className="exp-btn exp-btn--sm" onClick={() => { setDraft(''); setAdding(false); }}>
            {t('common.cancel')}
          </button>
        </span>
      ) : (
        <button type="button" className="exp-btn exp-btn--sm exp-langbar__addbtn" onClick={() => setAdding(true)}>
          + {t('templates.addLanguage')}
        </button>
      )}
    </div>
  );
}
