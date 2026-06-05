import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Badge, Spinner, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import {
  refreshAiEnrichment,
  setAiReplyDraft,
} from '../store/slices/emailSlice';

const SENTIMENT_COLORS = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
  urgent: 'orange',
};

// Fixed quick-start chip starters; agent can edit before sending
const REPLY_CHIP_KEYS = ['confirm', 'info', 'escalate'];

const AiPanel = ({ darkMode, onSeedReply }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const aiEnrichment = useSelector((state) => state.email.aiEnrichment);
  const isFetchingEmail = useSelector((state) => state.email.isFetchingEmail);
  const aiConfig = useSelector((state) => state.widget?.emailConfig?.aiProvider);

  const handleRefresh = () => {
    dispatch(refreshAiEnrichment());
  };

  const handleUseSuggested = () => {
    if (aiEnrichment?.suggestedReply) {
      dispatch(setAiReplyDraft(aiEnrichment.suggestedReply));
      if (onSeedReply) onSeedReply(aiEnrichment.suggestedReply);
    }
  };

  const handleChip = (chipText) => {
    dispatch(setAiReplyDraft(chipText));
    if (onSeedReply) onSeedReply(chipText);
  };

  const { summary, category, sentiment, confidence, suggestedReply, source } = aiEnrichment || {};
  const confidencePct = confidence != null ? `${Math.round(confidence * 100)}%` : null;
  const sentimentColor = SENTIMENT_COLORS[sentiment] || 'default';

  return (
    <Card className={`ai-panel${darkMode ? ' md--dark' : ''}`}>
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
                {isFetchingEmail ? <Spinner size={16} /> : t('email.ai.refresh')}
              </Button>
            )}
          </div>
        </div>

        {summary && (
          <div className="reading-pane__summary" role="note">
            <span className="reading-pane__summary-label">{t('email.ai.summary')}</span>
            <p className="reading-pane__summary-text">{summary}</p>
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

        {suggestedReply && (
          <div className="ai-panel__suggested">
            <div className="ai-panel__suggested-label">{t('email.ai.suggestedReply')}</div>
            <p className="ai-panel__suggested-text">{suggestedReply}</p>
            <Button
              ariaLabel={t('email.ai.useReply')}
              size={28}
              color="green"
              onClick={handleUseSuggested}
            >
              {t('email.ai.useReply')}
            </Button>
          </div>
        )}

        {/* Quick-start reply chips — seed composer with a starter the agent edits */}
        <div className="ai-panel__chips">
          <span className="ai-panel__chips-label">{t('email.ai.chips.label')}</span>
          <div className="ai-panel__chips-row">
            {REPLY_CHIP_KEYS.map((key) => (
              <Button
                key={key}
                ariaLabel={t(`email.ai.chips.${key}`)}
                size={28}
                color="none"
                onClick={() => handleChip(t(`email.ai.chips.${key}`))}
                className="ai-panel__chip-btn"
              >
                {t(`email.ai.chips.${key}`)}
              </Button>
            ))}
          </div>
        </div>
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
