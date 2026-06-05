import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { Spinner, Alert } from '@momentum-ui/react';
import { initEmailTask, resetEmail, setMockEmailData } from '../store/slices/emailSlice';
import { useI18n } from '../i18n/I18nContext';
import EmailTaskHeader from './EmailTaskHeader';
import EmailAnalyticsBar from './EmailAnalyticsBar';
import ThreadPanel from './ThreadPanel';
import EmailReadingPane from './EmailReadingPane';
import AiPanel from './AiPanel';
import ReplyComposer from './ReplyComposer';
import WrapUpDialog from './WrapUpDialog';
import './email.css';

const EmailWidget = ({ interactionId, callAssociatedDetails, darkMode, mockMode }) => {
  const dispatch = useDispatch();
  const { t } = useI18n();
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const { isFetchingEmail, isFetchingToken, error, activeEmail, wrapUp } = useSelector(
    (state) => state.email
  );

  useEffect(() => {
    if (mockMode) {
      dispatch(setMockEmailData());
      return () => { dispatch(resetEmail()); };
    }
    if (interactionId) {
      dispatch(initEmailTask(interactionId, callAssociatedDetails));
    }
    return () => {
      dispatch(resetEmail());
    };
  }, [interactionId, mockMode]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isFetchingToken || isFetchingEmail) {
    return (
      <div className="email-widget__state-center">
        <Spinner />
        <span className="md-h4" style={{ marginTop: 12, color: 'var(--md-color-gray-60)' }}>
          {t('email.loading')}
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="email-widget__state-center">
        <Alert type="error" message={t(error) || error} />
      </div>
    );
  }

  if (!activeEmail) {
    return (
      <div className="email-widget__state-center">
        <span className="md-h4" style={{ color: 'var(--md-color-gray-60)' }}>
          {t('email.noTask')}
        </span>
      </div>
    );
  }

  return (
    <div className={`email-widget widget-shell${darkMode ? ' md--dark' : ''}`}>
      <div className={`analytics-collapse${analyticsOpen ? ' analytics-collapse--open' : ' analytics-collapse--closed'}${darkMode ? ' analytics-collapse--dark' : ''}`}>
        <button
          className="analytics-collapse__toggle"
          onClick={() => setAnalyticsOpen((o) => !o)}
          aria-expanded={analyticsOpen}
        >
          <span className="analytics-collapse__label">{t('analytics.customerAnalytics')}</span>
          <span className="analytics-collapse__chevron">{analyticsOpen ? '▲' : '▼'}</span>
        </button>
        {analyticsOpen && <EmailAnalyticsBar darkMode={darkMode} />}
      </div>
      <EmailTaskHeader darkMode={darkMode} />
      <div className="email-widget__body email-widget__body--3col widget-body">
        <aside className="email-widget__col email-widget__col--threads widget-panel" aria-label="Thread list">
          <ThreadPanel darkMode={darkMode} />
        </aside>
        <main className="email-widget__col email-widget__col--center widget-panel">
          <EmailReadingPane darkMode={darkMode} />
          <ReplyComposer
            interactionId={interactionId}
            callAssociatedDetails={callAssociatedDetails}
            darkMode={darkMode}
          />
        </main>
        <aside className="email-widget__col email-widget__col--rail" aria-label="AI assist">
          <AiPanel darkMode={darkMode} />
        </aside>
      </div>
      {wrapUp.submitted === false && (
        <WrapUpDialog interactionId={interactionId} darkMode={darkMode} />
      )}
    </div>
  );
};

EmailWidget.propTypes = {
  interactionId: PropTypes.string.isRequired,
  callAssociatedDetails: PropTypes.object,
  darkMode: PropTypes.bool,
  mockMode: PropTypes.bool,
};

EmailWidget.defaultProps = {
  callAssociatedDetails: null,
  darkMode: false,
  mockMode: false,
};

export default EmailWidget;
