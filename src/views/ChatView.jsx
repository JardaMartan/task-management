import React from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';

const ChatView = ({ darkMode }) => {
  const { t } = useI18n();
  return (
    <div className={`view-placeholder${darkMode ? ' md--dark' : ''}`}>
      <div className="view-placeholder__icon" aria-hidden="true">💬</div>
      <h2 className="md-h2 view-placeholder__title">
        {t('chat.title') || 'Chat'}
      </h2>
      <p className="view-placeholder__text">
        {t('chat.placeholder') || 'Live chat support is coming soon. Active chat conversations will appear here.'}
      </p>
    </div>
  );
};

ChatView.propTypes = { darkMode: PropTypes.bool };
ChatView.defaultProps = { darkMode: false };

export default ChatView;
