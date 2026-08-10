import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { saveConfig, resetConfig } from '../store/slices/experienceSlice';
import { isDirty } from '../selectors';

export default function Toolbar() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const dirty = useSelector((s) => isDirty(s.experience));
  const saving = useSelector((s) => s.experience.saving);
  const saveResult = useSelector((s) => s.experience.saveResult);

  let resultMsg = null;
  let resultTone = '';
  if (saveResult) {
    if (saveResult.saved && saveResult.simulated) { resultMsg = t('toolbar.saveSimulated'); resultTone = 'ok'; }
    else if (saveResult.saved) { resultMsg = t('toolbar.saveOk'); resultTone = 'ok'; }
    else if (saveResult.error) { resultMsg = t('toolbar.saveError', { error: saveResult.error }); resultTone = 'err'; }
  }

  return (
    <div className="exp-toolbar">
      <span className={`exp-toolbar__status${dirty ? ' is-dirty' : ''}`}>
        <span className="exp-toolbar__dot" aria-hidden="true" />
        {dirty ? t('toolbar.unsaved') : t('toolbar.saved')}
      </span>
      {resultMsg && <span className={`exp-toolbar__result exp-toolbar__result--${resultTone}`}>{resultMsg}</span>}
      <span className="exp-toolbar__spacer" />
      <button
        type="button"
        className="exp-btn exp-btn--sm"
        disabled={!dirty || saving}
        onClick={() => dispatch(resetConfig())}
      >
        {t('toolbar.reset')}
      </button>
      <button
        type="button"
        className="exp-btn exp-btn--primary exp-btn--sm"
        disabled={!dirty || saving}
        onClick={() => dispatch(saveConfig())}
      >
        {saving ? t('toolbar.saving') : t('toolbar.save')}
      </button>
    </div>
  );
}
