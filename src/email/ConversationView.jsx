import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { setActiveEmail } from '../store/slices/emailSlice';
import EmailViewer from './EmailViewer';
import AttachmentList from './AttachmentList';

/**
 * ConversationView — renders all messages in the current thread as a stacked
 * accordion. The `activeEmail` message is auto-expanded on mount and whenever
 * it changes (e.g. on cross-tab navigation). Clicking any message header
 * toggles its body and updates `activeEmail` so the ReplyComposer targets it.
 */
const ConversationView = ({ darkMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const thread = useSelector((state) => state.email.thread);
  const activeEmail = useSelector((state) => state.email.activeEmail);

  // Local UI state: which message IDs are currently expanded
  const [expandedIds, setExpandedIds] = useState(() =>
    activeEmail?.messageId ? new Set([activeEmail.messageId]) : new Set()
  );

  // When the thread changes (e.g. selecting a different thread from the left panel),
  // reset expansion state so only the new activeEmail is expanded.
  const threadId = activeEmail?.threadId;
  useEffect(() => {
    if (activeEmail?.messageId) {
      setExpandedIds(new Set([activeEmail.messageId]));
    }
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Within the same thread, auto-expand when activeEmail changes (reply target)
  useEffect(() => {
    if (activeEmail?.messageId) {
      setExpandedIds((prev) => new Set([...prev, activeEmail.messageId]));
    }
  }, [activeEmail?.messageId]);

  if (!thread || thread.length === 0) return null;

  // Newest message first — matches Apple Mail / Gmail convention
  const sorted = [...thread].sort((a, b) => {
    const ta = new Date(a.date);
    const tb = new Date(b.date);
    // Fall back to array order if dates don't parse
    if (isNaN(ta) || isNaN(tb)) return 0;
    return tb - ta;
  });

  const toggleExpand = (msg) => {
    const id = msg.messageId;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Update reply target when expanding a different message
        if (id !== activeEmail?.messageId) {
          dispatch(setActiveEmail(msg));
        }
      }
      return next;
    });
  };

  return (
    <div className={`conv-view${darkMode ? ' conv-view--dark' : ''}`}>
      {sorted.map((msg, idx) => {
        const isExpanded = expandedIds.has(msg.messageId);
        const isActive = msg.messageId === activeEmail?.messageId;
        const isNewest = idx === 0;

        // Show display name only (strip <email@> part)
        const fromDisplay = msg.from?.replace(/<[^>]+>/, '').trim() || msg.from || '';

        return (
          <div
            key={msg.messageId}
            className={[
              'msg-card',
              isExpanded ? 'msg-card--expanded' : '',
              isActive ? 'msg-card--active' : '',
              isNewest ? 'msg-card--newest' : '',
            ].filter(Boolean).join(' ')}
          >
            {/* ── Clickable header ── */}
            <div
              className="msg-card__header"
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              onClick={() => toggleExpand(msg)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleExpand(msg)}
            >
              <div className="msg-card__header-left">
                <span className="msg-card__from">{fromDisplay}</span>
                {!isExpanded && msg.snippet && (
                  <span className="msg-card__snippet">{msg.snippet}</span>
                )}
              </div>
              <div className="msg-card__header-right">
                <span className="msg-card__date">{msg.date}</span>
                <span className="msg-card__chevron" aria-hidden="true">
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>
            </div>

            {/* ── Expandable body ── */}
            {isExpanded && (
              <div className="msg-card__body">
                <div className="msg-card__meta">
                  {msg.to && (
                    <span className="msg-card__meta-row">
                      <span className="msg-card__meta-label">{t('email.to') || 'To'}: </span>
                      <span className="msg-card__meta-value">{msg.to}</span>
                    </span>
                  )}
                  {msg.cc && (
                    <span className="msg-card__meta-row">
                      <span className="msg-card__meta-label">{t('email.cc') || 'Cc'}: </span>
                      <span className="msg-card__meta-value">{msg.cc}</span>
                    </span>
                  )}
                </div>
                <EmailViewer
                  bodyHtml={msg.bodyHtml}
                  bodyText={msg.bodyText}
                  darkMode={darkMode}
                />
                {msg.attachments?.length > 0 && (
                  <AttachmentList
                    messageId={msg.messageId}
                    attachments={msg.attachments}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

ConversationView.propTypes = { darkMode: PropTypes.bool };
ConversationView.defaultProps = { darkMode: false };

export default ConversationView;
