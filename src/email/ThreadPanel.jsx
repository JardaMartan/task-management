import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Badge, Button, Card, CardSection } from '@momentum-ui/react';
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
  const interactionThreadId = useSelector((state) => state.email.interactionThreadId);
  const draftsByThreadId = useSelector((state) => state.email.draftsByThreadId);
  // The scalar working draft fields belong to the active thread (populated by
  // swapThreadDraftContext when activeEmail changes).  ThreadPanel needs these
  // to show the draft badge on the currently selected thread.
  const activeAiReplyDraft = useSelector((state) => state.email.aiReplyDraft);
  const activeEmailTouched = useSelector((state) => state.email.emailTouched);
  const activeGmailDraftId = useSelector((state) => state.email.gmailDraftId);

  const interactionRef = useRef(null);

  // True when the thread has an in-progress or saved draft.
  // Sources, in priority order:
  //   1. The visible thread list metadata (hasDraft) set by fetchCustomerThreads
  //      and kept in sync with the composer/Gmail draft state.
  //   2. The per-thread draft cache (draftsByThreadId), which is primed when
  //      a thread is opened or when drafts are pre-fetched.
  //   3. The active thread's scalar working draft fields (aiReplyDraft,
  //      emailTouched, gmailDraftId).
  const hasThreadDraft = (threadId) => {
    if (!threadId) return false;
    const meta = customerThreads?.find((t) => t.threadId === threadId);
    if (meta?.hasDraft) return true;

    const isActive = threadId === activeEmail?.threadId;
    const cached = draftsByThreadId?.[threadId];
    const body = isActive
      ? (activeAiReplyDraft ?? cached?.aiReplyDraft ?? '')
      : (cached?.aiReplyDraft ?? '');
    const touched = isActive
      ? (activeEmailTouched ?? cached?.emailTouched ?? false)
      : (cached?.emailTouched ?? false);
    const hasText = String(body || '').replace(/<[^>]+>/g, '').trim().length > 0;
    const hasGmailDraft = isActive
      ? Boolean(activeGmailDraftId || cached?.gmailDraftId)
      : Boolean(cached?.gmailDraftId);
    return hasText || touched || hasGmailDraft;
  };

  const handleSelectThread = (threadId) => {
    if (threadId && threadId !== activeEmail?.threadId) {
      console.log('[ThreadPanel] selecting thread', threadId, 'from', activeEmail?.threadId);
      if (isDemoMode) {
        dispatch(fetchMockEmailThread(threadId, locale));
      } else {
        dispatch(fetchEmailThread(threadId));
      }
    }
  };

  const handleJumpToInteraction = () => {
    if (!interactionThreadId) return;
    if (interactionThreadId === activeEmail?.threadId) return;
    console.log('[ThreadPanel] jumping to interaction thread', interactionThreadId);
    if (isDemoMode) {
      dispatch(fetchMockEmailThread(interactionThreadId, locale));
    } else {
      dispatch(fetchEmailThread(interactionThreadId));
    }
  };

  // Auto-scroll the interaction thread into view whenever it changes or the list is first built.
  useEffect(() => {
    if (interactionRef.current) {
      interactionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [interactionThreadId]);

  // Build a unified chronological list from customerThreads metadata.
  // fetchEmailThread now updates the customerThreads entry for any thread that
  // is fully loaded, so active and inactive entries share the same metadata
  // source and the list stays stable when the user selects a thread.
  const allThreads = (customerThreads || []).map((th) => ({
    ...th,
    isActive: th.threadId === activeEmail?.threadId,
  }));

  // Sort newest first.  Keep stable ordering for equal timestamps by threadId.
  allThreads.sort((a, b) => {
    const ta = new Date(a.date);
    const tb = new Date(b.date);
    const diff = (isNaN(ta) || isNaN(tb)) ? 0 : tb - ta;
    if (diff !== 0) return diff;
    return String(b.threadId).localeCompare(String(a.threadId));
  });

  // Apply quick-filters from the analytics bar
  const filteredThreads = allThreads.filter((th) => {
    const sk = th.isActive ? 'active' : (th.statusKey || 'resolved');
    if (activeFilters.status && sk !== activeFilters.status) return false;
    if (activeFilters.topic && (th.topicKey || null) !== activeFilters.topic) return false;
    return true;
  });

  const canJumpToInteraction = interactionThreadId && activeEmail?.threadId !== interactionThreadId;

  return (
    <Card className={`thread-panel${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        <div className="thread-panel__title-row">
          <span className="md-h4">{t('email.thread.title') || 'Email Threads'}</span>
          {canJumpToInteraction && (
            <Button
              className="thread-panel__jump-btn"
              size={28}
              onClick={handleJumpToInteraction}
              aria-label={t('email.thread.jumpToInteraction') || 'Jump to interaction thread'}
              title={t('email.thread.jumpToInteraction') || 'Jump to interaction thread'}
            >
              {t('email.thread.jumpToInteraction')}
            </Button>
          )}
        </div>

        <ul className="thread-list" role="listbox" aria-label={t('email.thread.title') || 'Email Threads'}>
          {filteredThreads.map((th) => {
            const displayFrom = extractDisplayName(th.from);
            const displayDate = formatThreadDate(th.date);
            const displaySubject = th.subject || t('email.thread.noSubject') || '(no subject)';
            const isInteractionThread = th.threadId === interactionThreadId;
            const hasDraft = hasThreadDraft(th.threadId);

            return (
              <li
                key={th.threadId}
                ref={isInteractionThread ? interactionRef : null}
                className={`thread-list__item${th.isActive ? ' thread-list__item--active' : ' thread-list__item--other'}${isInteractionThread ? ' thread-list__item--interaction' : ''}${hasDraft ? ' thread-list__item--draft' : ''}`}
                role="option"
                aria-selected={th.isActive}
                tabIndex={0}
                onClick={() => !th.isActive && handleSelectThread(th.threadId)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && !th.isActive && handleSelectThread(th.threadId)
                }
              >
                <div className="thread-list__item-head">
                  <span className="thread-list__from" title={th.from}>
                    {displayFrom}
                    {isInteractionThread && (
                      <Badge
                        className="thread-list__interaction-badge"
                        color="blue"
                        aria-label={t('email.thread.currentInteraction') || 'Current interaction'}
                        title={t('email.thread.currentInteraction') || 'Current interaction'}
                      >
                        {t('email.thread.currentInteraction')}
                      </Badge>
                    )}
                    {hasDraft && (
                      <span
                        className="thread-list__draft-badge"
                        aria-label={t('email.thread.draft') || 'Draft'}
                        title={t('email.thread.draft') || 'Draft'}
                      >
                        {t('email.thread.draft') || 'draft'}
                      </span>
                    )}
                  </span>
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

