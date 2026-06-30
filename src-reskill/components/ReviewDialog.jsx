import React from 'react';
import { useSelector } from 'react-redux';
import { Button } from '@momentum-ui/react';
import { useI18n } from '../i18n/I18nContext';
import { SKILL_TYPES } from '../mock/mockData';
import { stagedChangeRows, stagedProfileRows } from '../selectors';

const fmtValue = (type, value, t) => {
  if (value === undefined || value === null || value === '') return t('review.none');
  if (type === SKILL_TYPES.BOOLEAN) return value ? t('review.on') : t('review.off');
  return String(value);
};

/** Modal listing every staged change as an agent / skill / from → to row. */
const ReviewDialog = ({ onClose }) => {
  const { t } = useI18n();
  const viewMode = useSelector((s) => s.reskill.viewMode);
  const draft = useSelector((s) => s.reskill.draft);
  const profileDraft = useSelector((s) => s.reskill.profileDraft);
  const agents = useSelector((s) => s.reskill.agents);
  const skills = useSelector((s) => s.reskill.skills);
  const skillProfiles = useSelector((s) => s.reskill.skillProfiles);

  // Modes are mutually exclusive — review only the active mode's staged changes.
  const isProfiles = viewMode === 'profiles';
  const rows = React.useMemo(
    () => (isProfiles ? [] : stagedChangeRows(draft, agents, skills)),
    [isProfiles, draft, agents, skills],
  );
  const profileRows = React.useMemo(
    () => (isProfiles ? stagedProfileRows(profileDraft, agents, skillProfiles) : []),
    [isProfiles, profileDraft, agents, skillProfiles],
  );
  const isEmpty = rows.length === 0 && profileRows.length === 0;

  return (
    <div className="reskill-overlay" onClick={onClose} role="presentation">
      <div
        className="reskill-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('review.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reskill-dialog__head">
          <h3 className="reskill-dialog__title">{t('review.title')}</h3>
          <button type="button" className="reskill-iconbtn" onClick={onClose} aria-label={t('review.close')}>
            ✕
          </button>
        </div>
        <div className="reskill-dialog__body">
          {isEmpty ? (
            <div className="reskill-empty">{t('review.empty')}</div>
          ) : (
            <>
              {profileRows.length > 0 && (
                <table className="reskill-review-table">
                  <thead>
                    <tr>
                      <th>{t('review.agent')}</th>
                      <th>{t('review.profile')}</th>
                      <th>{t('review.from')}</th>
                      <th>{t('review.to')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profileRows.map((r) => (
                      <tr key={`p-${r.agentId}`}>
                        <td>{r.agentName}</td>
                        <td>{t('review.profileReassign')}</td>
                        <td className="reskill-val--from">{r.fromName || t('review.none')}</td>
                        <td className="reskill-val--to">{r.toName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {rows.length > 0 && (
                <table className="reskill-review-table">
                  <thead>
                    <tr>
                      <th>{t('review.agent')}</th>
                      <th>{t('review.skill')}</th>
                      <th>{t('review.from')}</th>
                      <th>{t('review.to')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.agentId}-${r.skillId}`}>
                        <td>{r.agentName}</td>
                        <td>{r.skillName}</td>
                        <td className="reskill-val--from">{fmtValue(r.type, r.from, t)}</td>
                        <td className="reskill-val--to">{fmtValue(r.type, r.to, t)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
        <div className="reskill-dialog__foot">
          <Button color="default" onClick={onClose}>
            {t('review.close')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReviewDialog;
