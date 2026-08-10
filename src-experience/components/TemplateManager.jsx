import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import {
  addTemplate, updateTemplateMeta, updateTemplateVariant, removeTemplateVariant,
  deleteTemplate, selectTemplate, setActiveLanguage,
} from '../store/slices/experienceSlice';
import AssignmentPanel from './AssignmentPanel';
import RichHtmlEditor from './RichHtmlEditor';
import { TEMPLATE_PLACEHOLDERS } from '../constants';

const genId = () => `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const CATEGORIES = ['greeting', 'follow-up', 'apology', 'resolution', 'billing', 'general'];

// A template's display name in the active language, falling back to any flavor.
function displayName(tpl, lang) {
  const v = tpl?.variants || {};
  return v[lang]?.name || Object.values(v).find((x) => x?.name)?.name || '';
}

export default function TemplateManager() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const templates = useSelector((s) => s.experience.config.templates);
  const languages = useSelector((s) => s.experience.config.languages || []);
  const activeLanguage = useSelector((s) => s.experience.activeLanguage);
  const selectedId = useSelector((s) => s.experience.selectedTemplateId);
  const assignments = useSelector((s) => s.experience.config.templateAssignments);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? templates.filter((tpl) => displayName(tpl, activeLanguage).toLowerCase().includes(q))
    : templates;
  const selected = useMemo(() => templates.find((tpl) => tpl.id === selectedId) || null, [templates, selectedId]);
  const variant = selected?.variants?.[activeLanguage] || null;
  const hasFlavor = Boolean(variant);

  const onAdd = () => {
    dispatch(addTemplate({
      id: genId(),
      category: 'general',
      variables: [],
      variants: {
        [activeLanguage]: { name: t('templates.newName'), subject: 'Re: {{subject}}', body: '<p></p>' },
      },
    }));
  };

  const patchVariant = (p) => selected && dispatch(updateTemplateVariant({ id: selected.id, lang: activeLanguage, patch: p }));
  const patchMeta = (p) => selected && dispatch(updateTemplateMeta({ id: selected.id, patch: p }));

  return (
    <div className="exp-tpl">
      <div className="exp-manager">
        {/* ── list ── */}
        <div className="exp-col exp-col--list">
          <div className="exp-panel-head">
            <div className="exp-panel-head__row">
              <span className="exp-section-title">{t('templates.listTitle')}</span>
              <button type="button" className="exp-btn exp-btn--primary exp-btn--sm" onClick={onAdd}>
                + {t('templates.add')}
              </button>
            </div>
          </div>
          <div className="exp-col__pad">
            <input
              className="exp-input"
              type="text"
              value={query}
              placeholder={t('templates.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
            {templates.length === 0 ? (
              <div className="exp-empty">{t('templates.empty')}</div>
            ) : (
              <ul className="exp-list">
                {filtered.map((tpl) => {
                  const name = displayName(tpl, activeLanguage);
                  const missingActive = !tpl.variants?.[activeLanguage];
                  return (
                    <li
                      key={tpl.id}
                      className={`exp-list__item${tpl.id === selectedId ? ' is-active' : ''}`}
                      onClick={() => dispatch(selectTemplate(tpl.id))}
                    >
                      <div className={`exp-list__name${missingActive ? ' is-missing' : ''}`}>
                        {name || t('templates.untitled')}
                        {missingActive && <span className="exp-list__missing"> · {t('templates.missingHere')}</span>}
                      </div>
                      <div className="exp-list__meta">
                        <span className="exp-langdots">
                          {languages.map((code) => (
                            <span
                              key={code}
                              className={`exp-langdot${tpl.variants?.[code] ? ' is-present' : ' is-absent'}${code === activeLanguage ? ' is-active' : ''}`}
                              title={code.toUpperCase()}
                            >
                              {code.toUpperCase()}
                            </span>
                          ))}
                        </span>
                        <span className="exp-list__count">
                          {t('templates.assignedTo', { count: (assignments[tpl.id] || []).length })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── editor ── */}
        <div className="exp-col exp-col--editor">
          {!selected ? (
            <div className="exp-empty exp-empty--center">{t('templates.empty')}</div>
          ) : (
            <div className="exp-col__pad">
              <div className="exp-tpl__langs">
                {languages.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`exp-langchip${selected.variants?.[code] ? ' is-present' : ' is-absent'}${code === activeLanguage ? ' is-active' : ''}`}
                    onClick={() => dispatch(setActiveLanguage(code))}
                    title={code.toUpperCase()}
                  >
                    {code.toUpperCase()}
                  </button>
                ))}
              </div>

              {!hasFlavor && (
                <div className="exp-note exp-note--accent">{t('templates.missingFlavor', { lang: activeLanguage.toUpperCase() })}</div>
              )}

              <div className="exp-field">
                <label className="exp-label">{t('templates.nameLabel')}</label>
                <input
                  className="exp-input"
                  type="text"
                  value={variant?.name || ''}
                  placeholder={t('templates.namePlaceholder')}
                  onChange={(e) => patchVariant({ name: e.target.value })}
                />
              </div>
              <div className="exp-field">
                <label className="exp-label">{t('templates.categoryLabel')}</label>
                <select className="exp-input" value={selected.category || 'general'} onChange={(e) => patchMeta({ category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="exp-field">
                <label className="exp-label">{t('templates.subjectLabel')}</label>
                <input
                  className="exp-input"
                  type="text"
                  value={variant?.subject || ''}
                  placeholder={t('templates.subjectPlaceholder')}
                  onChange={(e) => patchVariant({ subject: e.target.value })}
                />
              </div>
              <div className="exp-field">
                <label className="exp-label">{t('templates.bodyLabel')}</label>
                <RichHtmlEditor
                  value={variant?.body || ''}
                  placeholder={hasFlavor ? '' : t('templates.emptyBodyPlaceholder')}
                  variables={TEMPLATE_PLACEHOLDERS}
                  onChange={(html) => patchVariant({ body: html })}
                />
              </div>
              <div className="exp-editor-actions">
                {hasFlavor && (
                  <button
                    type="button"
                    className="exp-btn exp-btn--sm"
                    onClick={() => dispatch(removeTemplateVariant({ id: selected.id, lang: activeLanguage }))}
                  >
                    {t('templates.removeVersion', { lang: activeLanguage.toUpperCase() })}
                  </button>
                )}
                <button
                  type="button"
                  className="exp-btn exp-btn--danger exp-btn--sm"
                  onClick={() => {
                    // eslint-disable-next-line no-alert
                    if (globalThis.confirm?.(t('templates.deleteConfirm')) ?? true) {
                      dispatch(deleteTemplate(selected.id));
                    }
                  }}
                >
                  {t('templates.delete')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── assignment ── */}
        <div className="exp-col exp-col--assign">
          {selected && <AssignmentPanel kind="template" itemId={selected.id} />}
        </div>
      </div>
    </div>
  );
}
