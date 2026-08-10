import React, { useMemo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Badge, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import SearchableSelect from '../ui/SearchableSelect';
import {
  refreshAiEnrichment,
  setPendingComposerInsert,
  applyTemplate,
  selectThreadAiSummaries,
} from '../store/slices/emailSlice';

const SENTIMENT_COLORS = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
  urgent: 'orange',
};

const AiPanel = ({ darkMode, onSeedReply }) => {
  const { t, locale } = useI18n();
  const dispatch = useDispatch();
  const aiEnrichment = useSelector((state) => state.email.aiEnrichment);
  const isFetchingEmail = useSelector((state) => state.email.isFetchingEmail);
  const aiConfig = useSelector((state) => state.widget?.emailConfig?.aiProvider);
  const templates = useSelector((state) => state.email.templates);
  const lastSentReply = useSelector((state) => state.email.lastSentReply);
  const aiReplyDraft = useSelector((state) => state.email.aiReplyDraft);
  const wrapUpStatus = useSelector((state) => state.email.wrapUpSummary.status);
  // Versioned AI summaries/replies for the open thread (newest first): the agent
  // re-generates them after each thread update, so show the latest and collapse
  // the older ones.
  const aiSummaryVersions = useSelector(selectThreadAiSummaries);
  const currentSummary = aiSummaryVersions[0]?.summary ?? aiEnrichment?.summary ?? null;
  const currentReply = aiSummaryVersions[0]?.suggestedReply ?? aiEnrichment?.suggestedReply ?? null;
  const olderSummaries = aiSummaryVersions.slice(1).filter((v) => v.summary);
  const olderReplies = aiSummaryVersions.slice(1).filter((v) => v.suggestedReply);

  const [suggestedUsed, setSuggestedUsed] = useState(false);
  const [summaryHistoryOpen, setSummaryHistoryOpen] = useState(false);
  const [replyHistoryOpen, setReplyHistoryOpen] = useState(false);
  // Reset the "used" state when a fresh suggested reply arrives.
  useEffect(() => { setSuggestedUsed(false); }, [currentReply]);

  const fmtVersionTime = (ts) => {
    try {
      return new Date(ts).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const handleRefresh = () => {
    dispatch(refreshAiEnrichment());
  };

  // Suggested reply and templates are inserted at the composer caret (not replacing the draft).
  // Any version can be used — markCurrent only drives the current button's "used" state.
  const handleUseReply = (replyText, { markCurrent = false } = {}) => {
    if (!replyText) return;
    dispatch(setPendingComposerInsert(replyText));
    if (markCurrent) setSuggestedUsed(true);
    if (onSeedReply) onSeedReply(replyText);
  };

  const handleInsertTemplate = (templateId) => {
    if (templateId) dispatch(applyTemplate(templateId));
  };

  // Show only templates matching the UI locale (fall back to 'en' when none match).
  const localeTemplates = useMemo(() => {
    const hasLocale = templates.some((tpl) => tpl.locale);
    if (!hasLocale) return templates;
    const lang = (locale || 'en').split('-')[0].toLowerCase();
    const matching = templates.filter((tpl) => (tpl.locale || 'en') === lang);
    return matching.length > 0 ? matching : templates.filter((tpl) => (tpl.locale || 'en') === 'en');
  }, [templates, locale]);

  const templateOptions = useMemo(
    () => localeTemplates.map((tpl) => ({ id: tpl.id, name: tpl.name })),
    [localeTemplates],
  );

  const { category, sentiment, confidence, source } = aiEnrichment || {};
  const confidencePct = confidence != null ? `${Math.round(confidence * 100)}%` : null;
  const sentimentColor = SENTIMENT_COLORS[sentiment] || 'default';

  // Momentum Card intercepts Space/Enter globally — stop it before the Card so
  // typing works in the searchable template dropdown's input.
  const handleCardKeyDown = (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      e.stopPropagation();
    }
  };

  return (
    <Card className={`ai-panel${darkMode ? ' md--dark' : ''}`} onKeyDown={handleCardKeyDown}>
      <CardSection full>
        <div className="ai-panel__header">
          <span className="md-h4">{t('email.ai.summary')}</span>
          <div className="ai-panel__header-actions">
            {source && (
              <Badge color="default">
                {source === 'cad' ? 'pre-analyzed' : 'AI'}
              </Badge>
            )}
            {aiConfig && (
              <Button
                ariaLabel={t('email.ai.refresh')}
                size={28}
                color="none"
                onClick={handleRefresh}
              >
                {isFetchingEmail ? <span className="widget-spinner widget-spinner--sm widget-spinner--inherit" /> : t('email.ai.refresh')}
              </Button>
            )}
          </div>
        </div>

        {currentSummary && (
          <div className="reading-pane__summary" role="note">
            <span className="reading-pane__summary-label">{t('email.ai.summary')}</span>
            <p className="reading-pane__summary-text">{currentSummary}</p>
            {olderSummaries.length > 0 && (
              <>
                <button
                  type="button"
                  className="ai-panel__history-toggle"
                  onClick={() => setSummaryHistoryOpen((o) => !o)}
                  aria-expanded={summaryHistoryOpen}
                >
                  {summaryHistoryOpen ? '▲' : '▼'} {t('email.ai.previousVersions')} ({olderSummaries.length})
                </button>
                {summaryHistoryOpen && (
                  <div className="ai-panel__history">
                    {olderSummaries.map((v) => (
                      <div key={v.id} className="ai-panel__history-item">
                        <span className="ai-panel__history-time">{fmtVersionTime(v.ts)}</span>
                        <p className="ai-panel__history-text">{v.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {(category || sentiment || confidencePct) && (
          <div className="ai-panel__meta">
            {category && (
              <span className="ai-panel__meta-item">
                <span className="ai-panel__meta-label">{t('email.ai.category')}: </span>
                <Badge color="blue">{category}</Badge>
              </span>
            )}
            {sentiment && (
              <span className="ai-panel__meta-item">
                <span className="ai-panel__meta-label">{t('email.ai.sentiment')}: </span>
                <Badge color={sentimentColor}>
                  {t(`email.sentiment.${sentiment}`) || sentiment}
                </Badge>
              </span>
            )}
            {confidencePct && (
              <span className="ai-panel__meta-item">
                <span className="ai-panel__meta-label">{t('email.ai.confidence')}: </span>
                <strong>{confidencePct}</strong>
              </span>
            )}
          </div>
        )}

        {currentReply && (
          <div className="ai-panel__suggested">
            <div className="ai-panel__suggested-label">{t('email.ai.suggestedReply')}</div>
            <p className="ai-panel__suggested-text">{currentReply}</p>
            <Button
              ariaLabel={t('email.ai.useReply')}
              size={28}
              color="green"
              disabled={suggestedUsed}
              onClick={() => handleUseReply(currentReply, { markCurrent: true })}
            >
              {suggestedUsed
                ? `✓ ${t('email.reply.proofread.coverage.added')}`
                : t('email.ai.useReply')}
            </Button>
            {olderReplies.length > 0 && (
              <>
                <button
                  type="button"
                  className="ai-panel__history-toggle"
                  onClick={() => setReplyHistoryOpen((o) => !o)}
                  aria-expanded={replyHistoryOpen}
                >
                  {replyHistoryOpen ? '▲' : '▼'} {t('email.ai.previousVersions')} ({olderReplies.length})
                </button>
                {replyHistoryOpen && (
                  <div className="ai-panel__history">
                    {olderReplies.map((v) => (
                      <div key={v.id} className="ai-panel__history-item">
                        <span className="ai-panel__history-time">{fmtVersionTime(v.ts)}</span>
                        <p className="ai-panel__history-text">{v.suggestedReply}</p>
                        <button
                          type="button"
                          className="ai-panel__history-use"
                          onClick={() => handleUseReply(v.suggestedReply)}
                        >
                          {t('email.ai.useReply')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Template selection — insert a template at the composer caret */}
        {templates.length > 0 && (
          <div className="ai-panel__templates">
            <span className="ai-panel__templates-label">{t('email.composer.templatePicker.title')}</span>
            <SearchableSelect
              value=""
              options={templateOptions}
              onChange={handleInsertTemplate}
              searchable
              placeholder={t('email.composer.templatePicker.search')}
              ariaLabel={t('email.composer.templatePicker.title')}
              emptyText={t('email.composer.templatePicker.empty')}
            />
          </div>
        )}
      </CardSection>
    </Card>
  );
};

AiPanel.propTypes = {
  darkMode: PropTypes.bool,
  onSeedReply: PropTypes.func,
};

AiPanel.defaultProps = {
  darkMode: false,
  onSeedReply: null,
};

export default AiPanel;
