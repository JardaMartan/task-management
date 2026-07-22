import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '../i18n/I18nContext';
import { changeRange, applyCustomRange, resolveRange } from '../store/slices/activitySlice';

// ── inline SVG icons (no icon-font dependency) ──────────────────────────────
const CalIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M5 1a1 1 0 0 1 1 1v1h4V2a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1V2a1 1 0 0 1 1-1zM3 7v6h10V7H3z" />
  </svg>
);
const ChevronDown = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M4.24 6.24a1 1 0 0 1 1.42 0L8 8.59l2.34-2.35a1 1 0 1 1 1.42 1.42l-3.05 3.05a1 1 0 0 1-1.42 0L4.24 7.66a1 1 0 0 1 0-1.42z" /></svg>
);
const ChevronLeft = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M10.3 3.3a1 1 0 0 1 0 1.4L7 8l3.3 3.3a1 1 0 0 1-1.4 1.4l-4-4a1 1 0 0 1 0-1.4l4-4a1 1 0 0 1 1.4 0z" /></svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M5.7 3.3a1 1 0 0 0 0 1.4L9 8l-3.3 3.3a1 1 0 1 0 1.4 1.4l4-4a1 1 0 0 0 0-1.4l-4-4a1 1 0 0 0-1.4 0z" /></svg>
);

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const PRESETS = ['1h', '8h', '24h', 'today', 'yesterday', '7d', 'week', '30d'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const endOfDay = (ms) => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime(); };
const mmddyyyy = (ms) => {
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
};
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  const dim = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= dim; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
const addMonth = ({ year, month }, delta) => {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * Range control matching the Momentum date-range-picker pattern: a preset
 * sidebar plus a two-month calendar for custom [from, to] selection. Selecting
 * any option re-scopes the active-agents roster too.
 */
export default function RangeControl() {
  const { t } = useI18n();
  const dispatch = useDispatch();
  const rangeKey = useSelector((s) => s.activity.rangeKey);
  const customFrom = useSelector((s) => s.activity.customFrom);
  const customTo = useSelector((s) => s.activity.customTo);

  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [popStyle, setPopStyle] = useState(null);
  const resolved = useMemo(() => resolveRange(rangeKey, customFrom, customTo), [rangeKey, customFrom, customTo]);

  const [sel, setSel] = useState({ start: null, end: null }); // start-of-day ms
  const [view, setView] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  // Position the (wide) popover with fixed coordinates so it is not clipped by
  // the report's overflow:auto, and stays within the viewport.
  const POP_W = 600;
  const computePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let left = rect.right - POP_W;
    const maxLeft = window.innerWidth - POP_W - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    setPopStyle({ position: 'fixed', top: Math.round(rect.bottom + 6), left: Math.round(left), width: POP_W, right: 'auto' });
  };

  useEffect(() => {
    if (!open) return undefined;
    setSel({ start: startOfDay(resolved.fromMs), end: startOfDay(resolved.toMs) });
    const d = new Date(resolved.fromMs);
    setView({ year: d.getFullYear(), month: d.getMonth() });
    computePos();
    const onDoc = (e) => {
      const path = (e.composedPath && e.composedPath()) || [];
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(e.target))) return;
      setOpen(false);
    };
    const onWin = () => computePos();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onWin);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('resize', onWin); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const labels = {
    '1h': t('controls.range1h'), '8h': t('controls.range8h'), '24h': t('controls.range24h'),
    today: t('controls.rangeToday'), yesterday: t('controls.rangeYesterday'), '2d': t('controls.range2d'),
    '7d': t('controls.range7d'), week: t('controls.rangeWeek'), '30d': t('controls.range30d'),
    custom: t('controls.rangeCustom'),
  };
  const triggerLabel = labels[rangeKey] || labels['8h'];

  // Selecting a preset updates the data + calendar highlight but keeps the picker
  // open so the range can be tweaked; it closes on an outside click.
  const pickPreset = (k) => {
    dispatch(changeRange(k));
    const r = resolveRange(k);
    setSel({ start: startOfDay(r.fromMs), end: startOfDay(r.toMs) });
    const d = new Date(r.fromMs);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const todaySod = startOfDay(Date.now());
  const onDayClick = (day) => {
    if (!day) return;
    const ms = startOfDay(day.getTime());
    if (ms > todaySod) return; // no future
    setSel((cur) => {
      if (!cur.start || (cur.start && cur.end)) return { start: ms, end: null };
      if (ms < cur.start) return { start: ms, end: null };
      dispatch(applyCustomRange({ fromMs: cur.start, toMs: Math.min(endOfDay(ms), endOfDay(Date.now())) }));
      return { start: cur.start, end: ms };
    });
  };

  const renderMonth = (v) => {
    const cells = monthGrid(v.year, v.month);
    return (
      <div className="drp__month" key={`${v.year}-${v.month}`}>
        <div className="drp__grid drp__dow-row">
          {DOW.map((d, i) => <span key={i} className="drp__dow">{d}</span>)}
        </div>
        <div className="drp__grid">
          {cells.map((day, i) => {
            if (!day) return <span key={i} className="drp__day drp__day--empty" />;
            const ms = startOfDay(day.getTime());
            const future = ms > todaySod;
            const isStart = sel.start != null && ms === sel.start;
            const isEnd = sel.end != null && ms === sel.end;
            const inRange = sel.start != null && sel.end != null && ms >= sel.start && ms <= sel.end;
            const cls = ['drp__day'];
            if (future) cls.push('is-disabled');
            if (inRange) cls.push('is-range');
            if (isStart) cls.push('is-start');
            if (isEnd) cls.push('is-end');
            if (ms === todaySod) cls.push('is-today');
            return (
              <button
                key={i}
                type="button"
                className={cls.join(' ')}
                disabled={future}
                onMouseDown={(e) => { e.preventDefault(); onDayClick(day); }}
              >
                <span className="drp__day-n">{day.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const rightView = addMonth(view, 1);

  return (
    <div className="pill-ctl" ref={rootRef}>
      <span className="pill-ctl__label">{t('controls.range')}</span>
      <button
        type="button"
        ref={triggerRef}
        className={`pill-select drp-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="drp-trigger__icon"><CalIcon /></span>
        <span className="drp-trigger__label">{triggerLabel}</span>
        <span className="drp-trigger__dates">{mmddyyyy(resolved.fromMs)} → {mmddyyyy(resolved.toMs)}</span>
        <span className="pill-select__chevron"><ChevronDown /></span>
      </button>

      {open && (
        <div className="pill-pop drp" role="dialog" aria-label={t('controls.range')} style={popStyle || undefined}>
          <div className="drp__sidebar">
            {PRESETS.map((k) => (
              <button
                key={k}
                type="button"
                className={`drp__preset ${rangeKey === k ? 'is-active' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pickPreset(k); }}
              >
                {labels[k]}
              </button>
            ))}
          </div>

          <div className="drp__cal">
            <div className="drp__cal-head">
              <button type="button" className="drp__nav" aria-label="Previous" onMouseDown={(e) => { e.preventDefault(); setView((v) => addMonth(v, -1)); }}><ChevronLeft /></button>
              <span className="drp__mtitle">{MONTHS[view.month]} {view.year}</span>
              <span className="drp__mtitle drp__mtitle--right">{MONTHS[rightView.month]} {rightView.year}</span>
              <button type="button" className="drp__nav" aria-label="Next" onMouseDown={(e) => { e.preventDefault(); setView((v) => addMonth(v, 1)); }}><ChevronRight /></button>
            </div>
            <div className="drp__months">
              {renderMonth(view)}
              {renderMonth(rightView)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
