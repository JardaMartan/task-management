import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setPromptTeam, updatePrompt, resetPrompt } from '../store/slices/experienceSlice';
import { DEFAULT_PROMPT_TEAM } from '../constants';
import SearchableSelect from './SearchableSelect';

export default function PromptEditor() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const teams = useSelector((s) => s.experience.teams);
  const promptTeamId = useSelector((s) => s.experience.promptTeamId);
  const prompts = useSelector((s) => s.experience.config.proofreadPrompts);

  const isDefault = promptTeamId === DEFAULT_PROMPT_TEAM;
  const hasOverride = !isDefault && Object.prototype.hasOwnProperty.call(prompts.teams || {}, promptTeamId);
  const value = isDefault
    ? (prompts.default || '')
    : (hasOverride ? prompts.teams[promptTeamId] : (prompts.default || ''));

  const teamName = teams.find((tm) => tm.id === promptTeamId)?.name || '';

  return (
    <div className="exp-prompt">
      <div className="exp-col exp-col--wide">
        <div className="exp-panel-head">
          <div className="exp-panel-head__row">
            <span className="exp-section-title">{t('prompt.title')}</span>
          </div>
          <div className="exp-panel-head__sub">{t('prompt.subtitle')}</div>
        </div>

        <div className="exp-col__pad">
          <div className="exp-field-row exp-prompt__scope">
            <div className="exp-field exp-field--grow">
              <label className="exp-label">{t('prompt.scopeLabel')}</label>
              <SearchableSelect
                value={promptTeamId}
                options={teams}
                firstOption={{ id: DEFAULT_PROMPT_TEAM, label: t('prompt.orgDefault') }}
                placeholder={t('prompt.selectTeam')}
                searchPlaceholder={t('matrix.searchPlaceholder')}
                ariaLabel={t('prompt.scopeLabel')}
                onChange={(id) => dispatch(setPromptTeam(id))}
              />
            </div>
            <div className="exp-prompt__scope-actions">
              {isDefault && (
                <button
                  type="button"
                  className="exp-btn exp-btn--sm"
                  onClick={() => dispatch(resetPrompt(DEFAULT_PROMPT_TEAM))}
                >
                  {t('prompt.resetToDefault')}
                </button>
              )}
              {!isDefault && hasOverride && (
                <button
                  type="button"
                  className="exp-btn exp-btn--sm"
                  onClick={() => dispatch(resetPrompt(promptTeamId))}
                >
                  {t('prompt.removeOverride')}
                </button>
              )}
            </div>
          </div>

          {!isDefault && (
            <div className={`exp-note${hasOverride ? ' exp-note--accent' : ''}`}>
              {hasOverride
                ? t('prompt.hasOverride')
                : t('prompt.usingDefault')}
            </div>
          )}

          <div className="exp-field">
            <label className="exp-label">
              {isDefault ? t('prompt.orgDefault') : t('prompt.teamOverride', { team: teamName })}
            </label>
            <textarea
              className="exp-input exp-textarea exp-textarea--tall exp-code"
              value={value}
              spellCheck={false}
              onChange={(e) => dispatch(updatePrompt({ teamId: promptTeamId, text: e.target.value }))}
            />
          </div>

          <div className="exp-note exp-note--muted">{t('prompt.placeholdersNote')}</div>
        </div>
      </div>
    </div>
  );
}
