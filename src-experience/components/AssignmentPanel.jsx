import React, { useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { toggleAssignment, setAssignment } from '../store/slices/experienceSlice';
import ToggleSwitch from './ToggleSwitch';

/**
 * Per-item team-assignment panel: a searchable list of the supervisor's teams,
 * each with a toggle. Multiple teams can be assigned to the same item, and any
 * team can carry several items — a many-to-many relationship. `kind` is
 * 'template' or 'signature'; `itemId` is the currently-edited item.
 */
export default function AssignmentPanel({ kind, itemId }) {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const teams = useSelector((s) => s.experience.teams);
  const assignmentsKey = kind === 'signature' ? 'signatureAssignments' : 'templateAssignments';
  const assigned = useSelector((s) => s.experience.config[assignmentsKey][itemId] || []);
  const [query, setQuery] = useState('');

  const assignedSet = useMemo(() => new Set(assigned), [assigned]);
  const q = query.trim().toLowerCase();
  const filtered = q ? teams.filter((tm) => (tm.name || '').toLowerCase().includes(q)) : teams;

  if (!itemId) return null;

  const allIds = teams.map((tm) => tm.id);

  return (
    <div className="exp-assign">
      <div className="exp-assign__head">
        <div>
          <div className="exp-section-title">{t('matrix.title')}</div>
          <div className="exp-assign__sub">{t('matrix.subtitle')}</div>
        </div>
        <span className="exp-assign__count">
          {t('matrix.assignedCount', { count: assigned.length, total: teams.length })}
        </span>
      </div>

      {teams.length === 0 ? (
        <div className="exp-empty">{t('matrix.noTeams')}</div>
      ) : (
        <>
          <div className="exp-assign__toolbar">
            <input
              className="exp-input exp-assign__search"
              type="text"
              value={query}
              placeholder={t('matrix.searchPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="exp-linkbtn"
              onClick={() => dispatch(setAssignment({ kind, itemId, teamIds: allIds }))}
            >
              {t('matrix.selectAll')}
            </button>
            <button
              type="button"
              className="exp-linkbtn"
              onClick={() => dispatch(setAssignment({ kind, itemId, teamIds: [] }))}
            >
              {t('matrix.clear')}
            </button>
          </div>

          <ul className="exp-assign__list">
            {filtered.map((tm) => (
              <li key={tm.id} className="exp-assign__row">
                <span className="exp-assign__team" title={tm.name}>{tm.name}</span>
                <ToggleSwitch
                  checked={assignedSet.has(tm.id)}
                  ariaLabel={tm.name}
                  onChange={() => dispatch(toggleAssignment({ kind, itemId, teamId: tm.id }))}
                />
              </li>
            ))}
            {filtered.length === 0 && <li className="exp-assign__row exp-muted">—</li>}
          </ul>
        </>
      )}
    </div>
  );
}
