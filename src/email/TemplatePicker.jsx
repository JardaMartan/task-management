import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { applyTemplate } from '../store/slices/emailSlice';

/**
 * Template picker flyout.
 * Groups templates by category, shows a live-preview pane, and injects the
 * selected template (with customer/agent variable substitution) into the
 * Redux aiReplyDraft via the `applyTemplate` thunk.
 */
const TemplatePicker = ({ onClose }) => {
  const { t, locale } = useI18n();
  const dispatch = useDispatch();
  const templates = useSelector((state) => state.email.templates);

  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);

  // When templates have a locale field, show only those matching the UI locale
  // (fall back to 'en' if no match exists for the current locale).
  const localeTemplates = useMemo(() => {
    const hasLocale = templates.some((tpl) => tpl.locale);
    if (!hasLocale) return templates;
    const lang = (locale || 'en').split('-')[0].toLowerCase();
    const matching = templates.filter((tpl) => (tpl.locale || 'en') === lang);
    return matching.length > 0 ? matching : templates.filter((tpl) => (tpl.locale || 'en') === 'en');
  }, [templates, locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localeTemplates;
    return localeTemplates.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        (tpl.category || '').toLowerCase().includes(q)
    );
  }, [localeTemplates, search]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((tpl) => {
      const cat = tpl.category || 'general';
      if (!map[cat]) map[cat] = [];
      map[cat].push(tpl);
    });
    return map;
  }, [filtered]);

  const handleInsert = (tpl) => {
    dispatch(applyTemplate(tpl.id));
    onClose();
  };

  // Category label with i18n fallback to raw key
  const catLabel = (cat) =>
    t(`email.composer.templateCategory.${cat}`) || cat.charAt(0).toUpperCase() + cat.slice(1);

  return (
    <div className="template-picker" role="dialog" aria-modal="true" aria-label={t('email.composer.templatePicker.title')}>
      {/* ── Header ── */}
      <div className="template-picker__header">
        <span className="template-picker__title md-h4">{t('email.composer.templatePicker.title')}</span>
        <button
          type="button"
          className="template-picker__close"
          onClick={onClose}
          aria-label={t('common.close')}
        >
          ✕
        </button>
      </div>

      {/* ── Search ── */}
      <div className="template-picker__search-row">
        <input
          className="template-picker__search md-input"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('email.composer.templatePicker.search')}
          aria-label={t('email.composer.templatePicker.search')}
        />
      </div>

      {/* ── Body (list + preview) ── */}
      <div className="template-picker__body">

        {/* Left: template list */}
        <div className="template-picker__list" role="listbox" aria-label={t('email.composer.templatePicker.title')}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="template-picker__group">
              <div className="template-picker__group-label">{catLabel(cat)}</div>
              {items.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`template-picker__item${preview?.id === tpl.id ? ' template-picker__item--active' : ''}`}
                  role="option"
                  aria-selected={preview?.id === tpl.id}
                  tabIndex={0}
                  onClick={() => setPreview(tpl)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPreview(tpl)}
                >
                  <span className="template-picker__item-name">{tpl.name}</span>
                  {tpl.variables?.length > 0 && (
                    <span className="template-picker__item-vars">
                      {tpl.variables.slice(0, 3).map((v) => (
                        <span key={v} className="template-picker__var-chip">{`{{${v}}}`}</span>
                      ))}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="template-picker__empty">{t('email.composer.templatePicker.empty')}</div>
          )}
        </div>

        {/* Right: preview pane */}
        {preview ? (
          <div className="template-picker__preview">
            <div className="template-picker__preview-name">{preview.name}</div>
            {preview.subject && (
              <div className="template-picker__preview-subject">
                <strong>{t('email.subject')}:</strong> {preview.subject}
              </div>
            )}
            {/* eslint-disable-next-line react/no-danger */}
            <div className="template-picker__preview-body" dangerouslySetInnerHTML={{ __html: preview.body }} />
            {preview.variables?.length > 0 && (
              <div className="template-picker__preview-vars">
                <span className="template-picker__preview-vars-label">{t('email.composer.templatePicker.vars')}:</span>
                {preview.variables.map((v) => (
                  <span key={v} className="template-picker__var-chip">{`{{${v}}}`}</span>
                ))}
              </div>
            )}
            <div className="template-picker__preview-footer">
              <Button
                ariaLabel={t('email.composer.templatePicker.insert')}
                color="blue"
                size={28}
                onClick={() => handleInsert(preview)}
              >
                {t('email.composer.templatePicker.insert')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="template-picker__preview template-picker__preview--hint">
            <span className="template-picker__hint">{t('email.composer.templatePicker.selectHint')}</span>
          </div>
        )}

      </div>
    </div>
  );
};

TemplatePicker.propTypes = {
  onClose: PropTypes.func.isRequired,
};

export default TemplatePicker;
