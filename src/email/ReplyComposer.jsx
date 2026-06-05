import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { Button, Input, Spinner, Card, CardSection, Select, SelectOption, Label } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import {
  sendEmailReply,
  generateAiReply,
  improveAiDraft,
  setAiReplyDraft,
} from '../store/slices/emailSlice';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'empathetic', label: 'Empathetic' },
];

// Maps sentiment → default tone to auto-pre-select
const SENTIMENT_TONE_MAP = {
  urgent: 'empathetic',
  negative: 'empathetic',
  positive: 'professional',
  neutral: 'professional',
};

const UNDO_SECONDS = 5;

const ReplyComposer = ({ interactionId, callAssociatedDetails, darkMode }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  const aiReplyDraft = useSelector((state) => state.email.aiReplyDraft);
  const isSending = useSelector((state) => state.email.isSending);
  const sendResult = useSelector((state) => state.email.sendResult);
  const activeEmail = useSelector((state) => state.email.activeEmail);
  const templates = useSelector((state) => state.email.templates);
  const aiConfig = useSelector((state) => state.widget?.emailConfig?.aiProvider);
  const isFetchingAiDraft = useSelector((state) => state.email.isFetchingAiDraft);
  const aiEnrichment = useSelector((state) => state.email.aiEnrichment);

  const [aiInstruction, setAiInstruction] = useState('');
  const [selectedTone, setSelectedTone] = useState('professional');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [isNote, setIsNote] = useState(false);
  const [undoState, setUndoState] = useState(null); // { remainingSeconds, payload }
  const undoTimerRef = useRef(null);

  // Auto-select tone based on detected customer sentiment
  useEffect(() => {
    const suggestedTone = SENTIMENT_TONE_MAP[aiEnrichment?.sentiment];
    if (suggestedTone) setSelectedTone(suggestedTone);
  }, [aiEnrichment?.sentiment]);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const handleDraftChange = (e) => {
    dispatch(setAiReplyDraft(e.target.value));
  };

  const dispatchSend = (payload) => {
    dispatch(sendEmailReply(payload));
  };

  const handleSend = () => {
    if (!aiReplyDraft.trim() || !activeEmail) return;

    const payload = {
      toAddress: activeEmail.from,
      subject: activeEmail.subject?.startsWith('Re:')
        ? activeEmail.subject
        : `Re: ${activeEmail.subject}`,
      replyText: aiReplyDraft,
      replyHtml: `<p>${aiReplyDraft.replace(/\n/g, '<br>')}</p>`,
      threadId: activeEmail.threadId,
      inReplyTo: activeEmail.messageId,
      references: activeEmail.references
        ? `${activeEmail.references} ${activeEmail.messageId}`
        : activeEmail.messageId,
      interactionId,
      isNote,
    };

    // Start undo-send countdown; actual dispatch fires after UNDO_SECONDS
    let remaining = UNDO_SECONDS;
    setUndoState({ remainingSeconds: remaining, payload });

    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        setUndoState(null);
        undoTimerRef.current = null;
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

  const handleTextareaKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };


  const handleAiGenerate = () => {
    dispatch(generateAiReply(aiInstruction, selectedTone));
  };

  const handlePolish = () => {
    if (!aiReplyDraft.trim()) return;
    dispatch(improveAiDraft(aiReplyDraft, aiInstruction || 'Make it more professional and concise.'));
  };

  const handleTemplateSelect = (selected) => {
    const templateId = Array.isArray(selected) ? selected[0]?.value : selected;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl?.body) dispatch(setAiReplyDraft(tpl.body));
  };

  return (
    <Card className={`reply-composer${isNote ? ' reply-composer--note' : ''}${darkMode ? ' md--dark' : ''}`}>
      <CardSection full>
        {/* Header row: title + note-mode toggle + template picker */}
        <div className="reply-composer__header">
          <span className="md-h4">
            {isNote ? t('email.reply.note.active') : t('email.reply.title')}
          </span>
          <div className="reply-composer__header-actions">
            <Button
              ariaLabel={isNote ? t('email.reply.note.active') : t('email.reply.note.toggle')}
              size={28}
              color={isNote ? 'orange' : 'none'}
              onClick={() => setIsNote((v) => !v)}
            >
              {isNote ? t('email.reply.note.active') : t('email.reply.note.toggle')}
            </Button>
            {templates.length > 0 && (
              <Select
                defaultValue={t('email.reply.template')}
                onSelect={handleTemplateSelect}
              >
                {templates.map((tpl) => (
                  <SelectOption key={tpl.id} value={tpl.id} label={tpl.name} />
                ))}
              </Select>
            )}
          </div>
        </div>

        {/* Internal note hint */}
        {isNote && (
          <div className="reply-composer__note-hint" role="note">
            {t('email.reply.note.hint')}
          </div>
        )}

        {/* To line — locked read-only field */}
        {activeEmail?.from && !isNote && (
          <div className="reply-composer__to-line">
            <span className="reply-composer__to-label">{t('email.to')}:</span>
            <span className="reply-composer__to-value">{activeEmail.from}</span>
          </div>
        )}

        <Label
          htmlFor="reply-textarea"
          label={t('email.reply.placeholder')}
          className="reply-composer__textarea-label"
        />

        {/* AI shimmer replaces textarea while generating */}
        {isFetchingAiDraft ? (
          <div
            className="reply-composer__shimmer"
            role="status"
            aria-label={t('email.reply.generating')}
          />
        ) : (
          <textarea
            id="reply-textarea"
            className={`reply-composer__textarea md-input${isNote ? ' reply-composer__textarea--note' : ''}`}
            value={aiReplyDraft}
            onChange={handleDraftChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder={t('email.reply.placeholder')}
            rows={8}
            disabled={isSending || !!undoState}
            aria-label={t('email.reply.title')}
            title={t('email.reply.shortcuts')}
          />
        )}

        {aiConfig && (
          <div className="reply-composer__ai-section">
            <Button
              ariaLabel={t('email.reply.aiOptions')}
              size={28}
              color="none"
              onClick={() => setShowAiPanel((v) => !v)}
            >
              {t('email.reply.aiOptions')}
            </Button>

            {showAiPanel && (
              <div className="reply-composer__ai-controls">
                <Input
                  name="ai-instruction"
                  label={t('email.reply.instruction')}
                  value={aiInstruction}
                  onChange={(e) => setAiInstruction(e.target.value)}
                  placeholder={t('email.reply.instructionPlaceholder')}
                  inputSize="small-5"
                />
                <Select
                  defaultValue={TONE_OPTIONS.find((o) => o.value === selectedTone)?.label || TONE_OPTIONS[0].label}
                  onSelect={(selected) => {
                    const val = Array.isArray(selected) ? selected[0]?.value : selected;
                    if (val) setSelectedTone(val);
                  }}
                >
                  {TONE_OPTIONS.map((opt) => (
                    <SelectOption key={opt.value} value={opt.value} label={opt.label} />
                  ))}
                </Select>
                <Button
                  ariaLabel={t('email.reply.generate')}
                  size={28}
                  color="blue"
                  onClick={handleAiGenerate}
                >
                  {t('email.reply.generate')}
                </Button>
                <Button
                  ariaLabel={t('email.reply.polish')}
                  size={28}
                  color="none"
                  onClick={handlePolish}
                  disabled={!aiReplyDraft.trim()}
                >
                  {t('email.reply.polish')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Undo-send toast */}
        {undoState && (
          <div className="reply-composer__undo-toast" role="status" aria-live="polite">
            <span>
              {t('email.reply.undoHint').replace('{n}', undoState.remainingSeconds)}
            </span>
            <Button
              ariaLabel={t('email.reply.undo')}
              size={28}
              color="orange"
              onClick={handleUndoSend}
            >
              {t('email.reply.undo')}
            </Button>
          </div>
        )}

        <div className="reply-composer__footer">
          {sendResult && !undoState && (
            <span
              className={`reply-composer__send-result${
                sendResult.success
                  ? ' reply-composer__send-result--success'
                  : ' reply-composer__send-result--error'
              }`}
            >
              {sendResult.timeout
                ? t('email.send.timeout')
                : sendResult.success
                ? t('email.send.success')
                : t('email.send.failed')}
            </span>
          )}
          <Button
            ariaLabel={isNote ? t('email.reply.note.save') : t('email.reply.send')}
            size={36}
            color={isNote ? 'orange' : 'blue'}
            onClick={handleSend}
            disabled={isSending || isFetchingAiDraft || !aiReplyDraft.trim() || !!undoState}
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
  interactionId: PropTypes.string.isRequired,
  callAssociatedDetails: PropTypes.object,
  darkMode: PropTypes.bool,
};

ReplyComposer.defaultProps = {
  callAssociatedDetails: null,
  darkMode: false,
};

export default ReplyComposer;
