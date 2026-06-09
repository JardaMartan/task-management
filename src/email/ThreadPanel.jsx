import React from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { fetchEmailThread, fetchMockEmailThread } from '../store/slices/emailSlice';

// Format an RFC 2822 or ISO date string into a compact human-readable form.
const formatThreadDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isThisYear) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
};

// Extract display name from "First Last <email@domain>" or bare email.
const extractDisplayName = (from) => {
  if (!from) return '';
  const match = from.match(/^(.+?)\s*<[^>]+>$/);
  return match ? match[1].trim() : from;
};

/**
 * Left-column thread list. Shows all threads in chronological order (newest
 * first). The currently loaded thread is highlighted. Shows sender, subject,
 * date and message count for each entry.
 */
const ThreadPanel = ({ darkMode, isDemoMode, locale, activeFilters = {} }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const thread = useSelector((state) => state.email.thread);
  const activeEmail = useSelector((state) => state.email.activeEmail);
  const customerThreads = useSelector((state) => state.email.customerThreads);

  const handleSelectThread = (threadId) => {
    if (threadId && threadId !== activeEmail?.threadId) {
      if (isDemoMode) {
        dispatch(fetchMockEmailThread(threadId, locale));
      } else {
        dispatch(fetchEmailThread(threadId));
      }
    }
  };

  // Build a unified chronological list.
  // Active thread entry uses data from the already-loaded thread messages for
  // accuracy; other threads use metadata fetched from Gmail threads.get.
  const activeEntry = activeEmail
    ? {
        threadId: activeEmail.threadId,
        // Prefer subject from customerThreads metadata — Gmail auto-decodes RFC 2047
        // there, while format=full may return raw encoded-words that can appear garbled.
        subject: (customerThreads || []).find((t) => t.threadId === activeEmail.threadId)?.subject
          || activeEmail.subject
          || '',
        from: activeEmail.from || '',
        date: thread?.length ? thread[thread.length - 1]?.date || activeEmail.date : activeEmail.date,
        messageCount: thread?.length ?? 1,
        snippet: activeEmail.snippet || '',
        isActive: true,
      }
    : null;

  const otherThreads = (customerThreads || [])
    .filter((th) => th.threadId !== activeEmail?.threadId)
    .map((th) => ({ ...th, isActive: false }));

  const allThreads = [
    ...(activeEntry ? [activeEntry] : []),
    ...otherThreads,
  ];

  // Sort newest first.
  allThreads.sort((a, b) => {
    const ta = new Date(a.date);
    const tb = new Date(b.date);
    if (isNaN(ta) || isNaN(tb)) return 0;
    return tb - ta;
  });

  // Apply quick-filters from the analytics bar
  const filteredThreads = allThreads.filter((th) => {
    const sk = th.isActive ? 'active' : (th.statusKey || 'resolved');
    if (activeFilters.status && sk !== activeFilters.status) return false;
    if (activeFilters.topic && (th.topicKey || null) !== activeFilters.topic) return false;
    return true;
  });

  return (
    <Card className={`thread-panel${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <div className="thread-panel__title-row">
          <span className="md-h4">{t('email.thread.title') || 'Email Threads'}</span>
        </div>

        <ul className="thread-list" role="listbox" aria-label={t('email.thread.title') || 'Email Threads'}>
          {filteredThreads.map((th) => {
            const displayFrom = extractDisplayName(th.from);
            const displayDate = formatThreadDate(th.date);
            const displaySubject = th.subject || t('email.thread.noSubject') || '(no subject)';

            return (
              <li
                key={th.threadId}
                className={`thread-list__item${th.isActive ? ' thread-list__item--active' : ' thread-list__item--other'}`}
                role="option"
                aria-selected={th.isActive}
                tabIndex={0}
                onClick={() => !th.isActive && handleSelectThread(th.threadId)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && !th.isActive && handleSelectThread(th.threadId)
                }
              >
                <div className="thread-list__item-head">
                  <span className="thread-list__from" title={th.from}>{displayFrom}</span>
                  <span className="thread-list__date-badge">
                    {th.messageCount > 1 && (
                      <Badge color={th.isActive ? 'blue' : 'default'} title={`${th.messageCount} messages`}>
                        {th.messageCount}
                      </Badge>
                    )}
                    <span className="thread-list__date">{displayDate}</span>
                  </span>
                </div>
                <div className="thread-list__subject">{displaySubject}</div>
                {th.snippet && (
                  <div className="thread-list__snippet">{th.snippet}</div>
                )}
              </li>
            );
          })}
        </ul>
      </CardSection>
    </Card>
  );
};

ThreadPanel.propTypes = {
  isDemoMode: PropTypes.bool,
  locale: PropTypes.string,
  darkMode: PropTypes.bool,
  activeFilters: PropTypes.object,
};
ThreadPanel.defaultProps = { darkMode: false };

export default ThreadPanel;

