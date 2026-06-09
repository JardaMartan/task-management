import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Spinner, Card, CardSection } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import {
  sendEmailReply,
  improveAiDraft,
  correctGrammar,
  proofreadDraft,
  setAiReplyDraft,
  setAiProofreadResult,
  setActiveSignatureId,
} from '../store/slices/emailSlice';
import RichTextEditor from './RichTextEditor';
import ComposerToolbar from './ComposerToolbar';
import TemplatePicker from './TemplatePicker';

// ─── Tone options ─────────────────────────────────────────────────────────────
const TONE_OPTIONS = [
  { value: 'professional', labelKey: 'email.reply.tone.professional' },
  { value: 'friendly',     labelKey: 'email.reply.tone.friendly'     },
  { value: 'formal',       labelKey: 'email.reply.tone.formal'       },
  { value: 'empathetic',   labelKey: 'email.reply.tone.empathetic'   },
  { value: 'concise',      labelKey: 'email.reply.tone.concise'      },
];

const SENTIMENT_TONE_MAP = {
  urgent:   'empathetic',
  negative: 'empathetic',
  positive: 'professional',
  neutral:  'professional',
};

const UNDO_SECONDS = 5;

// ─── Proofread issues panel ───────────────────────────────────────────────────
const ProofreadPanel = ({ result, onApplyAll, onDismiss }) => {
  const { t } = useI18n();
  if (!result) return null;
  const { issues = [], correctedHtml } = result;
  return (
    <div className="proofread-panel" role="region" aria-label={t('email.reply.proofread.panelLabel')}>
      <div className="proofread-panel__header">
        <span className="proofread-panel__title">
          {issues.length > 0
            ? t('email.reply.proofread.found').replace('{n}', issues.length)
            : t('email.reply.proofread.noIssues')}
        </span>
        <div className="proofread-panel__actions">
          {correctedHtml && issues.length > 0 && (
            <Button ariaLabel={t('email.reply.proofread.applyAll')} size={28} color="green" onClick={onApplyAll}>
              {t('email.reply.proofread.applyAll')}
            </Button>
          )}
          <Button ariaLabel={t('email.reply.proofread.dismiss')} size={28} color="none" onClick={onDismiss}>
            {t('email.reply.proofread.dismiss')}
          </Button>
        </div>
      </div>
      {issues.length > 0 && (
        <ul className="proofread-panel__list">
          {issues.map((issue, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={i} className="proofread-panel__issue">
              <span className={`proofread-panel__issue-type proofread-panel__issue-type--${issue.type || 'grammar'}`}>
                {t(`email.reply.proofread.type.${issue.type}`) || issue.type}
              </span>
              <span className="proofread-panel__issue-original">{issue.original}</span>
              <span className="proofread-panel__issue-arrow" aria-hidden="true">→</span>
              <span className="proofread-panel__issue-suggestion">{issue.suggestion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
ProofreadPanel.propTypes = {
  result: PropTypes.shape({ issues: PropTypes.array, correctedHtml: PropTypes.string }),
  onApplyAll: PropTypes.func.isRequired,
  onDismiss: PropTypes.func.isRequired,
};
ProofreadPanel.defaultProps = { result: null };

// ─── Signature preview block ─────────────────────────────────────────────────

/**
 * Replace {{placeholder}} tokens in signature HTML with real agent values.
 * Supported: {{agentName}}, {{agentEmail}}, {{agentFirstName}}, {{agentLastName}}
 */
const resolvePlaceholders = (html, agentVars) => {
  if (!html || !agentVars) return html;
  return html
    .replace(/\{\{agentName\}\}/g,      agentVars.agentName      || '')
    .replace(/\{\{agentFirstName\}\}/g, agentVars.agentFirstName || '')
    .replace(/\{\{agentLastName\}\}/g,  agentVars.agentLastName  || '');
};

const SignatureBlock = ({ signatures, activeSignatureId, onChangeId, agentVars }) => {
  const { t } = useI18n();
  if (!signatures || signatures.length === 0) return null;
  const activeSig = signatures.find((s) => s.id === activeSignatureId);
  return (
    <div className="reply-composer__signature-block">
      <div className="reply-composer__signature-divider">
        <span aria-hidden="true">—</span>
        <select
          className="reply-composer__signature-select"
          value={activeSignatureId || ''}
          onChange={(e) => onChangeId(e.target.value || null)}
          aria-label={t('email.reply.signatureLabel')}
        >
          <option value="">{t('email.reply.noSignature')}</option>
          {signatures.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>
      {activeSig && (
        // eslint-disable-next-line react/no-danger
        <div className="reply-composer__signature-content" dangerouslySetInnerHTML={{ __html: resolvePlaceholders(activeSig.html, agentVars) }} />
      )}
    </div>
  );
};
SignatureBlock.propTypes = {
  signatures: PropTypes.array,
  activeSignatureId: PropTypes.string,
  onChangeId: PropTypes.func.isRequired,
  agentVars: PropTypes.shape({
    agentName: PropTypes.string,
    agentFirstName: PropTypes.string,
    agentLastName: PropTypes.string,
  }),
};
SignatureBlock.defaultProps = { signatures: [], activeSignatureId: null, agentVars: {} };

// ─── Main ReplyComposer ───────────────────────────────────────────────────────
// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─── Main ReplyComposer ───────────────────────────────────────────────────────
const ReplyComposer = ({ interactionId, callAssociatedDetails, darkMode, outboundMode, initialTo, initialSubject, onCancel }) => {
  const { t, locale } = useI18n();
  const dispatch = useDispatch();
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Selectors ──
  const aiReplyDraft        = useSelector((state) => state.email.aiReplyDraft);
  const isSending           = useSelector((state) => state.email.isSending);
  const sendResult          = useSelector((state) => state.email.sendResult);
  const activeEmail         = useSelector((state) => state.email.activeEmail);
  const templates           = useSelector((state) => state.email.templates);
  const allSignatures       = useSelector((state) => state.email.signatures);
  const activeSignatureId   = useSelector((state) => state.email.activeSignatureId);
  const widgetAgent         = useSelector((state) => state.widget.agent);
  const widgetAgentName     = useSelector((state) => state.widget.agentName);

  // Build agent variable map for signature placeholder resolution.
  const agentVars = React.useMemo(() => {
    const name  = widgetAgent?.agentName || widgetAgentName || '';
    const parts = name.trim().split(/\s+/);
    return {
      agentName:      name,
      agentFirstName: parts[0] || '',
      agentLastName:  parts.length > 1 ? parts[parts.length - 1] : '',
    };
  }, [widgetAgent, widgetAgentName]);

  // Filter signatures by current UI locale; fall back to 'en' if none match.
  const signatures = React.useMemo(() => {
    const hasLocale = allSignatures.some((s) => s.locale);
    if (!hasLocale) return allSignatures;
    const lang = (locale || 'en').split('-')[0].toLowerCase();
    const matching = allSignatures.filter((s) => (s.locale || 'en') === lang);
    return matching.length > 0 ? matching : allSignatures.filter((s) => (s.locale || 'en') === 'en');
  }, [allSignatures, locale]);

  // Auto-select the default signature for the locale when the list changes.
  useEffect(() => {
    if (!signatures.length) return;
    const alreadyValid = signatures.some((s) => s.id === activeSignatureId);
    if (alreadyValid) return;
    const def = signatures.find((s) => s.isDefault) || signatures[0];
    if (def) dispatch(setActiveSignatureId(def.id));
  }, [signatures, activeSignatureId, dispatch]);
  const aiConfig            = useSelector((state) => state.widget?.emailConfig?.aiProvider);
  const isFetchingAiDraft   = useSelector((state) => state.email.isFetchingAiDraft);
  const aiEnrichment        = useSelector((state) => state.email.aiEnrichment);
  const aiProofreadResult   = useSelector((state) => state.email.aiProofreadResult);
  const isCorrectingGrammar = useSelector((state) => state.email.isCorrectingGrammar);

  // ── Local UI state ──
  const [selectedTone,       setSelectedTone]       = useState('professional');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isNote,             setIsNote]             = useState(false);
  const [undoState,          setUndoState]          = useState(null);
  const [attachments,        setAttachments]        = useState([]);
  const [outboundTo,         setOutboundTo]         = useState(initialTo || '');
  const [outboundSubject,    setOutboundSubject]    = useState(initialSubject || '');
  const undoTimerRef = useRef(null);

  // In outbound mode: clear leftover draft from previous email session on mount
  useEffect(() => {
    if (outboundMode) {
      dispatch(setAiReplyDraft(''));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // In outbound mode: auto-dismiss after a successful send
  useEffect(() => {
    if (outboundMode && sendResult?.success) {
      const timer = setTimeout(() => {
        dispatch(setAiReplyDraft(''));
        onCancel?.();
      }, 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [outboundMode, sendResult, onCancel, dispatch]);

  // Auto-select tone from detected customer sentiment
  useEffect(() => {
    const suggested = SENTIMENT_TONE_MAP[aiEnrichment?.sentiment];
    if (suggested) setSelectedTone(suggested);
  }, [aiEnrichment?.sentiment]);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  // Strip HTML tags to determine if composer is empty
  const isDraftEmpty = !aiReplyDraft.replace(/<[^>]+>/g, '').trim();
  const isAiBusy     = isFetchingAiDraft || isCorrectingGrammar;
  // Extra guard for outbound mode: To and Subject must also be filled
  const isOutboundIncomplete = outboundMode && (!outboundTo.trim() || !outboundSubject.trim());

  const dispatchSend = (payload) => dispatch(sendEmailReply(payload));

  // ── Send / Undo ──
  const handleSend = () => {
    if (isDraftEmpty) return;
    if (!outboundMode && !activeEmail) return;
    if (isOutboundIncomplete) return;

    const bodyText = editorRef.current?.editor?.getText?.() ||
      aiReplyDraft.replace(/<[^>]+>/g, '').trim();
    const activeSig = signatures?.find((s) => s.id === activeSignatureId);
    const sigHtml = activeSig ? `<p>—</p>${resolvePlaceholders(activeSig.html, agentVars)}` : '';

    const payload = outboundMode ? {
      toAddress:   outboundTo.trim(),
      subject:     outboundSubject.trim(),
      replyText:   bodyText,
      replyHtml:   aiReplyDraft + sigHtml,
      threadId:    null,
      inReplyTo:   null,
      references:  null,
      interactionId: null,
      isNote:      false,
      attachments: attachments.map((a) => a.file),
    } : (() => {
      // When replying to a sent message, reply to the original recipient (To:),
      // not back to ourselves (From:).
      const isSent = Array.isArray(activeEmail.labelIds) && activeEmail.labelIds.includes('SENT');
      const replyTo = isSent ? activeEmail.to : activeEmail.from;
      return {
        toAddress: replyTo,
        subject: activeEmail.subject?.startsWith('Re:')
          ? activeEmail.subject
          : `Re: ${activeEmail.subject}`,
        replyText: bodyText,
        replyHtml: aiReplyDraft + sigHtml,
        threadId: activeEmail.threadId,
        inReplyTo: activeEmail.messageId,
        references: activeEmail.references
          ? `${activeEmail.references} ${activeEmail.messageId}`
          : activeEmail.messageId,
        interactionId,
        isNote,
        attachments: attachments.map((a) => a.file),
      };
    })();

    let remaining = UNDO_SECONDS;
    setUndoState({ remainingSeconds: remaining, payload });

    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        setUndoState(null);
        undoTimerRef.current = null;
        setAttachments([]);
        dispatch(setAiReplyDraft(''));
        dispatchSend(payload);
      } else {
        setUndoState({ remainingSeconds: remaining, payload });
        undoTimerRef.current = setTimeout(tick, 1000);
      }
    };
    undoTimerRef.current = setTimeout(tick, 1000);
  };

  const handleUndoSend = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoState(null);
  };

  const handleEditorKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Attachment handlers ──
  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ file: f, name: f.name, size: f.size, type: f.type })),
    ]);
    // Reset input so the same file can be re-added after removal
    e.target.value = '';
  };

  const handleRemoveAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // ── AI actions ──
  const handleFixGrammar = () => {
    if (isDraftEmpty) return;
    dispatch(correctGrammar(aiReplyDraft, locale));
  };

  const handleProofread = () => {
    if (isDraftEmpty) return;
    dispatch(proofreadDraft(aiReplyDraft, locale));
  };

  const handleApplyProofread = () => {
    if (aiProofreadResult?.correctedHtml) {
      dispatch(setAiReplyDraft(aiProofreadResult.correctedHtml));
    }
    dispatch(setAiProofreadResult(null));
  };

  const handleToneAdjust = (tone) => {
    setSelectedTone(tone);
    if (!isDraftEmpty) {
      dispatch(improveAiDraft(aiReplyDraft, `Rewrite in a ${tone} tone`, locale));
    }
  };

  // Momentum Card intercepts Space/Enter keypresses globally and calls
  // preventDefault(), which breaks typing in native <input> and <textarea>
  // elements rendered inside it.  Stop propagation before it reaches the Card.
  const handleCardKeyDown = (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      e.stopPropagation();
    }
  };

  return (
    <Card
      className={`reply-composer${isNote ? ' reply-composer--note' : ''}${outboundMode ? ' reply-composer--outbound' : ''}${darkMode ? ' md--dark' : ''}`}
      onKeyDown={handleCardKeyDown}
    >
      <CardSection full>

        {/* ── Header ── */}
        <div className="reply-composer__header">
          <span className="md-h4">
            {outboundMode
              ? t('email.outbound.title')
              : isNote ? t('email.reply.note.active') : t('email.reply.title')}
          </span>
          <div className="reply-composer__header-actions">
            {!outboundMode && (
              <Button
                ariaLabel={isNote ? t('email.reply.note.active') : t('email.reply.note.toggle')}
                size={28}
                color={isNote ? 'orange' : 'none'}
                onClick={() => setIsNote((v) => !v)}
              >
                {isNote ? t('email.reply.note.active') : t('email.reply.note.toggle')}
              </Button>
            )}
            {templates.length > 0 && (
              <Button
                ariaLabel={t('email.reply.template')}
                size={28}
                color="none"
                onClick={() => setShowTemplatePicker((v) => !v)}
              >
                {t('email.reply.template')}
              </Button>
            )}
            {outboundMode && onCancel && (
              <button
                type="button"
                className="reply-composer__outbound-close"
                onClick={() => { dispatch(setAiReplyDraft('')); onCancel(); }}
                aria-label={t('common.close')}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Template picker flyout ── */}
        {showTemplatePicker && (
          <TemplatePicker onClose={() => setShowTemplatePicker(false)} />
        )}

        {/* ── Note hint ── */}
        {isNote && (
          <div className="reply-composer__note-hint" role="note">
            {t('email.reply.note.hint')}
          </div>
        )}

        {/* ── Outbound To / Subject fields ── */}
        {outboundMode && (
          <div className="reply-composer__outbound-fields">
            <div className="reply-composer__field-row">
              <label className="reply-composer__field-label" htmlFor="rc-outbound-to">
                {t('email.to')}
              </label>
              <input
                id="rc-outbound-to"
                type="email"
                className="reply-composer__field-input"
                value={outboundTo}
                onChange={(e) => setOutboundTo(e.target.value)}
                placeholder="customer@example.com"
                disabled={isSending || !!undoState}
              />
            </div>
            <div className="reply-composer__field-row">
              <label className="reply-composer__field-label" htmlFor="rc-outbound-subject">
                {t('email.subject')}
              </label>
              <input
                id="rc-outbound-subject"
                type="text"
                className="reply-composer__field-input"
                value={outboundSubject}
                onChange={(e) => setOutboundSubject(e.target.value)}
                placeholder={t('email.outbound.subjectPlaceholder')}
                disabled={isSending || !!undoState}
              />
            </div>
          </div>
        )}

        {/* ── To line (reply mode only) ── */}
        {!outboundMode && activeEmail && !isNote && (
          <div className="reply-composer__to-line">
            <span className="reply-composer__to-label">{t('email.to')}:</span>
            <span className="reply-composer__to-value">
              {Array.isArray(activeEmail.labelIds) && activeEmail.labelIds.includes('SENT')
                ? activeEmail.to
                : activeEmail.from}
            </span>
          </div>
        )}

        {/* ── AI correction action bar ── */}
        {aiConfig && !isNote && (
          <div className="reply-composer__ai-action-bar" role="toolbar" aria-label={t('email.reply.aiActionBar')}>
            <button
              type="button"
              className={`reply-composer__ai-action-btn${(isDraftEmpty || isAiBusy) ? ' reply-composer__ai-action-btn--disabled' : ''}`}
              onClick={handleFixGrammar}
              disabled={isDraftEmpty || isAiBusy}
              title={t('email.reply.fixGrammar')}
            >
              {isCorrectingGrammar ? <Spinner size={12} /> : <span aria-hidden="true">✓</span>}
              {t('email.reply.fixGrammar')}
            </button>

            <div className="reply-composer__tone-row">
              <span className="reply-composer__tone-label">{t('email.reply.toneLabel')}:</span>
              <select
                className="reply-composer__tone-select"
                value={selectedTone}
                onChange={(e) => handleToneAdjust(e.target.value)}
                disabled={isAiBusy}
                aria-label={t('email.reply.toneLabel')}
              >
                {TONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className={`reply-composer__ai-action-btn${(isDraftEmpty || isAiBusy) ? ' reply-composer__ai-action-btn--disabled' : ''}`}
              onClick={handleProofread}
              disabled={isDraftEmpty || isAiBusy}
              title={t('email.reply.proofreadLabel')}
            >
              <span aria-hidden="true">🔍</span>
              {t('email.reply.proofreadLabel')}
            </button>
          </div>
        )}

        {/* ── Formatting toolbar (not for internal notes) ── */}
        {!isNote && (
          <ComposerToolbar editor={editorRef.current?.editor} onAttachClick={handleAttachClick} />
        )}

        {/* ── AI shimmer while generating ── */}
        {isFetchingAiDraft ? (
          <div className="reply-composer__shimmer" role="status" aria-label={t('email.reply.generating')} />
        ) : (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div onKeyDown={handleEditorKeyDown}>
            <RichTextEditor
              ref={editorRef}
              content={aiReplyDraft}
              onChange={(html) => dispatch(setAiReplyDraft(html))}
              placeholder={t('email.reply.placeholder')}
              disabled={isSending || !!undoState}
              className={isNote ? 'rte-editor--note' : ''}
            />
          </div>
        )}

        {/* ── Proofread results ── */}
        {aiProofreadResult && (
          <ProofreadPanel
            result={aiProofreadResult}
            onApplyAll={handleApplyProofread}
            onDismiss={() => dispatch(setAiProofreadResult(null))}
          />
        )}

        {/* ── Signature block ── */}
        {!isNote && (
          <SignatureBlock
            signatures={signatures}
            activeSignatureId={activeSignatureId}
            onChangeId={(id) => dispatch(setActiveSignatureId(id))}
            agentVars={agentVars}
          />
        )}

        {/* ── Attachments ── */}
        {!isNote && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
              aria-label={t('email.reply.attachLabel')}
            />
            {attachments.length > 0 && (
              <div className="reply-composer__attachments">
                {attachments.map((att, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} className="reply-composer__attachment-item">
                    <span className="reply-composer__attachment-name" title={att.name}>{att.name}</span>
                    <span className="reply-composer__attachment-size">{formatFileSize(att.size)}</span>
                    <button
                      type="button"
                      className="reply-composer__attachment-remove"
                      onClick={() => handleRemoveAttachment(i)}
                      aria-label={t('email.reply.removeAttachment')}
                      title={t('email.reply.removeAttachment')}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Undo-send toast ── */}
        {undoState && (
          <div className="reply-composer__undo-toast" role="status" aria-live="polite">
            <span>{t('email.reply.undoHint').replace('{n}', undoState.remainingSeconds)}</span>
            <Button ariaLabel={t('email.reply.undo')} size={28} color="orange" onClick={handleUndoSend}>
              {t('email.reply.undo')}
            </Button>
          </div>
        )}

        {/* ── Footer ── */}
        <div className="reply-composer__footer">
          {sendResult && !undoState && (
            <span className={`reply-composer__send-result${sendResult.success ? ' reply-composer__send-result--success' : ' reply-composer__send-result--error'}`}>
              {sendResult.timeout
                ? t('email.send.timeout')
                : sendResult.success
                ? t('email.send.success')
                : sendResult.error
                ? (t(sendResult.error) || t('email.send.failed'))
                : t('email.send.failed')}
            </span>
          )}
          <Button
            ariaLabel={isNote ? t('email.reply.note.save') : t('email.reply.send')}
            size={36}
            color={isNote ? 'orange' : 'blue'}
            onClick={handleSend}
            disabled={isSending || isFetchingAiDraft || isDraftEmpty || !!undoState || isOutboundIncomplete}
            title={t('email.reply.shortcuts')}
          >
            {isSending ? (
              <>
                <Spinner size={16} />
                <span>{t('email.reply.sending')}</span>
              </>
            ) : isNote ? (
              t('email.reply.note.save')
            ) : (
              t('email.reply.send')
            )}
          </Button>
        </div>

      </CardSection>
    </Card>
  );
};

ReplyComposer.propTypes = {
  interactionId: PropTypes.string,
  callAssociatedDetails: PropTypes.object,
  darkMode: PropTypes.bool,
  outboundMode: PropTypes.bool,
  initialTo: PropTypes.string,
  initialSubject: PropTypes.string,
  onCancel: PropTypes.func,
};

ReplyComposer.defaultProps = {
  interactionId: null,
  callAssociatedDetails: null,
  darkMode: false,
  outboundMode: false,
  initialTo: '',
  initialSubject: '',
  onCancel: null,
};

export default ReplyComposer;
