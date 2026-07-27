import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import SearchableSelect from '../ui/SearchableSelect';
import { fetchChannelQueues, requeueTask } from '../store/slices/settingsSlice';

const CHANNEL = 'email';

/**
 * Watches the active email task's SLA and, for an UNTOUCHED task whose SLA has
 * reached the configured trigger point, either:
 *   • auto: shows an interruptible countdown, then requeues (vteamTransfer), or
 *   • offer: prompts the agent to confirm / pick a channel-specific queue.
 * Fires at most once per interaction; aborts immediately if the agent starts
 * working (email becomes "touched"). Mounted at the Customer360 level so it
 * keeps monitoring regardless of the active tab. Email-only for now.
 */
const SlaRequeueController = ({ darkMode, interactionId }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();

  const slaExpiresAt = useSelector((s) => s.email.slaExpiresAt);
  const emailTouched = useSelector((s) => s.email.emailTouched);
  const sla = useSelector((s) => s.settings.sla);
  const thresholdMin = useSelector((s) => s.widget?.emailConfig?.slaThresholdMinutes ?? 15);
  const channelQueues = useSelector((s) => s.settings.channelQueues?.[CHANNEL] || []);

  const [phase, setPhase] = useState('idle');        // 'idle' | 'countdown' | 'offer'
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [queue, setQueue] = useState(null);          // { vteamId, vteamType, name }
  const handledRef = useRef(null);                   // interactionId already handled
  const timerRef = useRef(null);

  const clearTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const doRequeue = (q) => {
    clearTimer();
    setPhase('idle');
    if (q?.vteamId && interactionId) {
      dispatch(requeueTask({
        interactionId,
        vteamId: q.vteamId,
        vteamType: q.vteamType,
        wrapUp: sla.wrapUp || null,
      }));
    }
  };

  // Reset per-interaction state when the task changes.
  useEffect(() => {
    handledRef.current = null;
    clearTimer();
    setPhase('idle');
    setQueue(null);
  }, [interactionId]);

  // If the agent starts working, abort any pending auto/offer and don't re-trigger.
  useEffect(() => {
    if (emailTouched && phase !== 'idle') {
      clearTimer();
      setPhase('idle');
      handledRef.current = interactionId;
    }
  }, [emailTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // SLA monitor.
  useEffect(() => {
    if (!slaExpiresAt || !interactionId) return undefined;
    if (sla.action === 'none' || emailTouched) return undefined;
    if (handledRef.current === interactionId) return undefined;

    const thresholdMs = (thresholdMin || 0) * 60_000;
    const triggerAt = sla.triggerOn === 'expired' ? slaExpiresAt : slaExpiresAt - thresholdMs;

    const check = () => {
      if (handledRef.current === interactionId) return;
      if (Date.now() < triggerAt) return;
      handledRef.current = interactionId; // fire once
      const q = sla.queues?.[CHANNEL] || null;
      if (sla.action === 'auto') {
        if (!q?.vteamId) { console.warn('[SLA] auto requeue skipped — no email queue configured'); return; }
        setQueue(q);
        setSecondsLeft(sla.autoCountdownSec || 15);
        setPhase('countdown');
      } else if (sla.action === 'offer') {
        setQueue(q);
        dispatch(fetchChannelQueues(CHANNEL));
        setPhase('offer');
      }
    };

    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [slaExpiresAt, interactionId, sla, emailTouched, thresholdMin, dispatch]);

  // Drive the auto countdown.
  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    clearTimer();
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearTimer(); doRequeue(queue); return 0; }
        return s - 1;
      });
    }, 1000);
    return clearTimer;
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'idle') return null;

  if (phase === 'countdown') {
    return (
      <div className={`sla-requeue-toast${darkMode ? ' md--dark' : ''}`} role="alert">
        <span className="sla-requeue-toast__text">
          {t('sla.requeue.autoCountdown', { seconds: secondsLeft, queue: queue?.name || '' })}
        </span>
        <button type="button" className="sla-requeue-toast__cancel" onClick={() => { clearTimer(); setPhase('idle'); }}>
          {t('sla.requeue.cancel')}
        </button>
      </div>
    );
  }

  // Offer dialog.
  const queueOptions = (() => {
    const base = channelQueues.map((x) => ({ id: x.id, name: x.name }));
    if (queue?.vteamId && !base.some((o) => o.id === queue.vteamId)) {
      base.unshift({ id: queue.vteamId, name: queue.name });
    }
    return base;
  })();
  return (
    <div className="sla-requeue-overlay">
      <div className={`sla-requeue-dialog${darkMode ? ' md--dark' : ''}`} role="dialog" aria-modal="true">
        <h3 className="sla-requeue-dialog__title">{t('sla.requeue.offerTitle')}</h3>
        <p className="sla-requeue-dialog__msg">{t('sla.requeue.offerMsg')}</p>
        <label className="sla-requeue-dialog__label" htmlFor="sla-requeue-queue">{t('sla.requeue.queueLabel')}</label>
        <SearchableSelect
          value={queue?.vteamId || ''}
          options={queueOptions}
          ariaLabel={t('sla.requeue.queueLabel')}
          placeholder={t('sla.requeue.selectQueue')}
          emptyText={t('sla.requeue.selectQueue')}
          onChange={(id) => {
            const item = channelQueues.find((x) => x.id === id);
            if (item) setQueue({ vteamId: item.id, vteamType: item.type || 'inboundqueue', name: item.name });
          }}
        />
        <div className="sla-requeue-dialog__actions">
          <button type="button" className="sla-requeue-btn sla-requeue-btn--ghost" onClick={() => setPhase('idle')}>
            {t('sla.requeue.dismiss')}
          </button>
          <button
            type="button"
            className="sla-requeue-btn sla-requeue-btn--primary"
            disabled={!queue?.vteamId}
            onClick={() => doRequeue(queue)}
          >
            {t('sla.requeue.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

SlaRequeueController.propTypes = {
  darkMode: PropTypes.bool,
  interactionId: PropTypes.string,
};

SlaRequeueController.defaultProps = {
  darkMode: false,
  interactionId: null,
};

export default SlaRequeueController;
