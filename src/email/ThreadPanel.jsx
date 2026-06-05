import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Button, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { setActiveEmail, fetchEmailThread } from '../store/slices/emailSlice';

/**
 * Left-column thread list. Shows messages of the active thread (newest first)
 * plus a collapsed list of "other threads" for the same customer. Clicking a
 * message updates `activeEmail`; the center reading pane renders the body.
 */
const ThreadPanel = ({ darkMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const thread = useSelector((state) => state.email.thread);
  const activeEmail = useSelector((state) => state.email.activeEmail);
  const customerThreads = useSelector((state) => state.email.customerThreads);
  const [otherOpen, setOtherOpen] = React.useState(false);

  const reversed = thread ? [...thread].reverse() : [];

  const handleSelect = (msg) => {
    dispatch(setActiveEmail(msg));
  };

  const handleSelectThread = (threadId) => {
    if (threadId && threadId !== activeEmail?.threadId) {
      dispatch(fetchEmailThread(threadId));
    }
  };

  return (
    <Card className={`thread-panel${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <div className="thread-panel__title-row">
          <span className="md-h4">{t('email.thread.title') || 'Thread'}</span>
          <Badge color="default">{reversed.length}</Badge>
        </div>

        <ul className="thread-list" role="listbox" aria-label="Thread messages">
          {reversed.map((msg, idx) => {
            const isActive = msg.messageId === activeEmail?.messageId;
            const isNewest = idx === 0;
            return (
              <li
                key={msg.messageId}
                className={`thread-list__item${isActive ? ' thread-list__item--active' : ''}${isNewest ? ' thread-list__item--newest' : ''}`}
                role="option"
                aria-selected={isActive}
                tabIndex={0}
                onClick={() => handleSelect(msg)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(msg);
                  }
                }}
              >
                <div className="thread-list__item-head">
                  <span className="thread-list__from">{msg.from}</span>
                  <span className="thread-list__date">{msg.date}</span>
                </div>
                {msg.snippet && (
                  <div className="thread-list__snippet">{msg.snippet}</div>
                )}
                {msg.attachments?.length > 0 && (
                  <div className="thread-list__meta">
                    📎 {msg.attachments.length}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {customerThreads && customerThreads.length > 0 && (
          <div className="thread-panel__other">
            <Button
              size={28}
              color="none"
              onClick={() => setOtherOpen((v) => !v)}
              ariaLabel="Toggle other threads"
            >
              {otherOpen ? '▾' : '▸'} {t('email.customer.threads') || 'Other threads'} ({customerThreads.length})
            </Button>
            {otherOpen && (
              <ul className="thread-list thread-list--other" role="listbox">
                {customerThreads.map((th) => {
                  const isActive = th.threadId === activeEmail?.threadId;
                  return (
                    <li
                      key={th.threadId}
                      className={`thread-list__item thread-list__item--other${isActive ? ' thread-list__item--active' : ''}`}
                      onClick={() => handleSelectThread(th.threadId)}
                      role="option"
                      aria-selected={isActive}
                      tabIndex={0}
                    >
                      <div className="thread-list__snippet">
                        {th.snippet || th.threadId}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </CardSection>
    </Card>
  );
};

ThreadPanel.propTypes = { darkMode: PropTypes.bool };
ThreadPanel.defaultProps = { darkMode: false };

export default ThreadPanel;
