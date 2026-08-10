import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import {
  addSignature, updateSignatureVariant, removeSignatureVariant,
  deleteSignature, selectSignature, setActiveLanguage,
} from '../store/slices/experienceSlice';
import AssignmentPanel from './AssignmentPanel';
import RichHtmlEditor from './RichHtmlEditor';
import { SIGNATURE_PLACEHOLDERS } from '../constants';

const genId = () => `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// A signature's display name in the active language, falling back to any flavor.
function displayName(sig, lang) {
  const v = sig?.variants || {};
  return v[lang]?.name || Object.values(v).find((x) => x?.name)?.name || '';
}

export default function SignatureManager() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const signatures = useSelector((s) => s.experience.config.signatures);
  const languages = useSelector((s) => s.experience.config.languages || []);
  const activeLanguage = useSelector((s) => s.experience.activeLanguage);
  const selectedId = useSelector((s) => s.experience.selectedSignatureId);
  const assignments = useSelector((s) => s.experience.config.signatureAssignments);
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? signatures.filter((sig) => displayName(sig, activeLanguage).toLowerCase().includes(q))
    : signatures;
  const selected = useMemo(() => signatures.find((sig) => sig.id === selectedId) || null, [signatures, selectedId]);
  const variant = selected?.variants?.[activeLanguage] || null;
  const hasFlavor = Boolean(variant);

  const onAdd = () => {
    dispatch(addSignature({
      id: genId(),
      variants: {
        [activeLanguage]: {
          name: t('signatures.newName'),
          html: '<p style="font-size:12px;color:#545454">Kind regards,<br><strong>{{agentName}}</strong></p>',
        },
      },
    }));
  };

  const patchVariant = (p) => selected && dispatch(updateSignatureVariant({ id: selected.id, lang: activeLanguage, patch: p }));

  return (
    <div className="exp-manager">
      {/* ── list ── */}
      <div className="exp-col exp-col--list">
        <div className="exp-panel-head">
          <div className="exp-panel-head__row">
            <span className="exp-section-title">{t('signatures.listTitle')}</span>
            <button type="button" className="exp-btn exp-btn--primary exp-btn--sm" onClick={onAdd}>
              + {t('signatures.add')}
            </button>
          </div>
        </div>
        <div className="exp-col__pad">
          <input
            className="exp-input"
            type="text"
            value={query}
            placeholder={t('signatures.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
          {signatures.length === 0 ? (
            <div className="exp-empty">{t('signatures.empty')}</div>
          ) : (
            <ul className="exp-list">
              {filtered.map((sig) => {
                const name = displayName(sig, activeLanguage);
                const missingActive = !sig.variants?.[activeLanguage];
                return (
                  <li
                    key={sig.id}
                    className={`exp-list__item${sig.id === selectedId ? ' is-active' : ''}`}
                    onClick={() => dispatch(selectSignature(sig.id))}
                  >
                    <div className={`exp-list__name${missingActive ? ' is-missing' : ''}`}>
                      {name || t('signatures.untitled')}
                      {missingActive && <span className="exp-list__missing"> · {t('templates.missingHere')}</span>}
                    </div>
                    <div className="exp-list__meta">
                      <span className="exp-langdots">
                        {languages.map((code) => (
                          <span
                            key={code}
                            className={`exp-langdot${sig.variants?.[code] ? ' is-present' : ' is-absent'}${code === activeLanguage ? ' is-active' : ''}`}
                            title={code.toUpperCase()}
                          >
                            {code.toUpperCase()}
                          </span>
                        ))}
                      </span>
                      <span className="exp-list__count">
                        {t('signatures.assignedTo', { count: (assignments[sig.id] || []).length })}
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
          <div className="exp-empty exp-empty--center">{t('signatures.empty')}</div>
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
              <div className="exp-note exp-note--accent">{t('signatures.missingFlavor', { lang: activeLanguage.toUpperCase() })}</div>
            )}

            <div className="exp-field">
              <label className="exp-label">{t('signatures.nameLabel')}</label>
              <input
                className="exp-input"
                type="text"
                value={variant?.name || ''}
                placeholder={t('signatures.namePlaceholder')}
                onChange={(e) => patchVariant({ name: e.target.value })}
              />
            </div>
            <div className="exp-field">
              <label className="exp-label">{t('signatures.htmlLabel')}</label>
              <RichHtmlEditor
                value={variant?.html || ''}
                placeholder={hasFlavor ? '' : t('signatures.emptyBodyPlaceholder')}
                variables={SIGNATURE_PLACEHOLDERS}
                onChange={(html) => patchVariant({ html })}
              />
            </div>
            <div className="exp-editor-actions">
              {hasFlavor && (
                <button
                  type="button"
                  className="exp-btn exp-btn--sm"
                  onClick={() => dispatch(removeSignatureVariant({ id: selected.id, lang: activeLanguage }))}
                >
                  {t('signatures.removeVersion', { lang: activeLanguage.toUpperCase() })}
                </button>
              )}
              <button
                type="button"
                className="exp-btn exp-btn--danger exp-btn--sm"
                onClick={() => {
                  // eslint-disable-next-line no-alert
                  if (globalThis.confirm?.(t('signatures.deleteConfirm')) ?? true) {
                    dispatch(deleteSignature(selected.id));
                  }
                }}
              >
                {t('signatures.delete')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── assignment ── */}
      <div className="exp-col exp-col--assign">
        {selected && <AssignmentPanel kind="signature" itemId={selected.id} />}
      </div>
    </div>
  );
}
