import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Badge, Card, CardSection, Icon } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';

const SENTIMENT_COLORS = {
  positive: 'green',
  neutral: 'blue',
  negative: 'red',
  urgent: 'orange',
};

// Maps sentiment → left-border accent class on the header card
const SENTIMENT_ACCENT = {
  negative: 'email-header--accent-red',
  urgent: 'email-header--accent-orange',
  positive: 'email-header--accent-green',
};

const EmailTaskHeader = ({ darkMode }) => {
  const { t } = useI18n();
  const activeEmail = useSelector((state) => state.email.activeEmail);
  const aiEnrichment = useSelector((state) => state.email.aiEnrichment);
  const thread = useSelector((state) => state.email.thread);

  if (!activeEmail) return null;

  const { subject, from, to, cc, date } = activeEmail;
  const { category, sentiment } = aiEnrichment || {};
  const sentimentColor = SENTIMENT_COLORS[sentiment] || 'default';
  const accentClass = SENTIMENT_ACCENT[sentiment] || '';
  const messageCount = thread?.length ?? 1;

  return (
    <Card className={`email-header${accentClass ? ` ${accentClass}` : ''}${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <div className="email-header__subject-row">
          <h2 className="md-h2 email-header__subject">{subject || t('email.subject')}</h2>
          <div className="email-header__badges">
            {messageCount > 1 && (
              <Badge color="default" title={`${messageCount} messages`}>{messageCount}</Badge>
            )}
            {category && (
              <Badge color="blue">{category}</Badge>
            )}
            {sentiment && (
              <Badge color={sentimentColor}>
                {t(`email.sentiment.${sentiment}`) || sentiment}
              </Badge>
            )}
          </div>
        </div>
        <div className="email-header__meta">
          <span className="email-header__field">
            <Icon name="email_12" className="email-header__field-icon" />
            <strong>{t('email.from')}: </strong>{from}
          </span>
          <span className="email-header__field">
            <strong>{t('email.to')}: </strong>{to}
          </span>
          {cc && (
            <span className="email-header__field">
              <strong>{t('email.cc')}: </strong>{cc}
            </span>
          )}
          <span className="email-header__field">
            <Icon name="recents_12" className="email-header__field-icon" />
            {date}
          </span>
        </div>
      </CardSection>
    </Card>
  );
};

EmailTaskHeader.propTypes = {
  darkMode: PropTypes.bool,
};

EmailTaskHeader.defaultProps = {
  darkMode: false,
};

export default EmailTaskHeader;
