import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { resetCurrentMode, applyChanges } from '../store/slices/reskillSlice';
import { stagedSummary, profileSummary } from '../selectors';

/**
 * Footer toolbar: staged-change summary, reset, review, and Apply. All actions
 * are scoped to the active view's draft — the grid and profile modes are
 * mutually exclusive, so only the current mode's staged changes count. Live
 * profile reassignments are persisted to Webex CC; demo/grid edits commit
 * locally (see applyReskillChanges).
 */
const ReskillToolbar = ({ onReview }) => {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const viewMode = useSelector((s) => s.reskill.viewMode);
  const draft = useSelector((s) => s.reskill.draft);
  const profileDraft = useSelector((s) => s.reskill.profileDraft);
  const isDemo = useSelector((s) => s.reskill.isDemo);
  const applying = useSelector((s) => s.reskill.applying);
  const applyResult = useSelector((s) => s.reskill.applyResult);

  const { changes, agents } = React.useMemo(
    () => (viewMode === 'profiles' ? profileSummary(profileDraft) : stagedSummary(draft)),
    [viewMode, draft, profileDraft],
  );
  const hasChanges = changes > 0;

  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const onApply = () => {
    // Live changes are consequential — confirm via an in-page dialog first.
    if (isDemo) {
      dispatch(applyChanges());
      return;
    }
    setConfirmOpen(true);
  };

  const confirmApply = () => {
    setConfirmOpen(false);
    dispatch(applyChanges());
  };

  // Result message after an apply attempt.
  let resultMsg = null;
  let resultTone = '';
  if (applyResult) {
    if (applyResult.error || applyResult.applied === false) {
      resultMsg = t('toolbar.applyFailed');
      resultTone = ' reskill-footer__result--error';
    } else if (applyResult.failed > 0) {
      resultMsg = t('toolbar.applyPartial', { count: applyResult.count, failed: applyResult.failed });
      resultTone = ' reskill-footer__result--warn';
    } else if (applyResult.localOnly) {
      resultMsg = t('toolbar.appliedLocal', { count: applyResult.count });
      resultTone = ' reskill-footer__result--warn';
    } else {
      resultMsg = t('toolbar.applied', { count: applyResult.count });
      resultTone = ' reskill-footer__result--ok';
    }
  }

  return (
    <div className="reskill-footer">
      <div>
        <div className="reskill-footer__pending">
          {hasChanges
            ? t('toolbar.pendingCount', { count: changes, agents })
            : t('toolbar.none')}
        </div>
        {resultMsg
          ? <div className={`reskill-footer__result${resultTone}`}>{resultMsg}</div>
          : <div className="reskill-footer__note">{t(isDemo ? 'toolbar.noteDemo' : 'toolbar.noteLive')}</div>}
      </div>

      <span className="reskill-footer__spacer" />

      <div className="reskill-footer__actions">
        <Button
          color="default"
          disabled={!hasChanges || applying}
          onClick={() => dispatch(resetCurrentMode())}
        >
          {t('toolbar.reset')}
        </Button>
        <Button
          color="default"
          disabled={!hasChanges || applying}
          onClick={onReview}
        >
          {t('toolbar.review')}
        </Button>
        <Button
          color="blue"
          disabled={!hasChanges || applying}
          onClick={onApply}
        >
          {applying ? t('toolbar.applying') : t('toolbar.apply')}
        </Button>
      </div>

      {confirmOpen && (
        <div className="reskill-overlay" onClick={() => setConfirmOpen(false)} role="presentation">
          <div
            className="reskill-dialog reskill-dialog--confirm"
            role="alertdialog"
            aria-modal="true"
            aria-label={t('toolbar.confirmTitle')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="reskill-dialog__head">
              <h3 className="reskill-dialog__title">{t('toolbar.confirmTitle')}</h3>
              <button
                type="button"
                className="reskill-iconbtn"
                onClick={() => setConfirmOpen(false)}
                aria-label={t('common.cancel')}
              >
                ✕
              </button>
            </div>
            <div className="reskill-dialog__body">
              <p className="reskill-confirm-text">
                {t('toolbar.confirmApply', { count: changes, agents })}
              </p>
            </div>
            <div className="reskill-dialog__foot">
              <Button color="default" onClick={() => setConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button color="blue" onClick={confirmApply}>
                {t('toolbar.apply')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReskillToolbar;
