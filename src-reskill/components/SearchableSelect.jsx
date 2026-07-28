import React, {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';

// Inline SVG icons (no icon-font dependency — safe in the standalone bundle).
const SearchIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M11.74 10.34l2.96 2.96a1 1 0 0 1-1.41 1.41l-2.96-2.96a5.5 5.5 0 1 1 1.41-1.41zM7 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
  </svg>
);
const ChevronIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M4.24 6.24a1 1 0 0 1 1.42 0L8 8.59l2.34-2.35a1 1 0 1 1 1.42 1.42l-3.05 3.05a1 1 0 0 1-1.42 0L4.24 7.66a1 1 0 0 1 0-1.42z" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path fill="currentColor" d="M6.2 11.3L2.8 7.9l1.4-1.4 2 2 4.6-4.6 1.4 1.4z" />
  </svg>
);

/**
 * Compact combo dropdown with an embedded search field. Momentum-token styled to
 * match the widget. `options` = [{ id, name }]. `firstOption` = { id, label } is
 * pinned as the first entry and is never filtered out by the search (e.g. a
 * "No profile" / unassign entry). The popover is fixed-positioned so it is not
 * clipped by the scrollable table and works inside the shadow-root host.
 */
export default function SearchableSelect({
  value, options, onChange, placeholder, searchPlaceholder, firstOption,
  ariaLabel, disabled = false, changed = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const profileItems = useMemo(
    () => (options || []).map((o) => ({ id: o.id, label: o.name ?? o.id })),
    [options],
  );

  const q = query.trim().toLowerCase();
  const filtered = q
    ? profileItems.filter((i) => i.label.toLowerCase().includes(q))
    : profileItems;
  const items = firstOption
    ? [{ id: firstOption.id, label: firstOption.label, pinned: true }, ...filtered]
    : filtered;

  const selectedId = value ?? '';
  const allItems = firstOption
    ? [{ id: firstOption.id, label: firstOption.label }, ...profileItems]
    : profileItems;
  const selected = allItems.find((i) => i.id === selectedId);
  const triggerText = selected ? selected.label : (placeholder || '');

  const reposition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useLayoutEffect(() => { if (open) reposition(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      // composedPath so clicks are detected correctly inside a shadow root.
      const path = (e.composedPath && e.composedPath()) || [];
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(e.target))) return;
      setOpen(false);
    };
    const onScrollResize = () => reposition();
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onScrollResize);
    window.addEventListener('scroll', onScrollResize, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onScrollResize);
      window.removeEventListener('scroll', onScrollResize, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (inputRef.current) inputRef.current.focus();
    const idx = items.findIndex((i) => i.id === selectedId);
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, items.length - 1)));
  }, [query, items.length]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (id) => { onChange(id); setOpen(false); setQuery(''); };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(items.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[activeIndex]; if (it) pick(it.id); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQuery(''); }
  };

  return (
    <div className="reskill-ss" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        ref={triggerRef}
        className={`reskill-ss__trigger${open ? ' is-open' : ''}${selected ? '' : ' is-placeholder'}${changed ? ' is-changed' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="reskill-ss__value" title={triggerText}>{triggerText}</span>
        <span className="reskill-ss__chevron"><ChevronIcon /></span>
      </button>
      {open && pos && (
        <div
          className="reskill-ss__pop"
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
        >
          <div className="reskill-ss__search">
            <span className="reskill-ss__search-icon"><SearchIcon /></span>
            <input
              ref={inputRef}
              className="reskill-ss__input"
              type="text"
              value={query}
              placeholder={searchPlaceholder || placeholder}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="reskill-ss__list" role="listbox" ref={listRef}>
            {items.map((it, i) => (
              <li
                key={it.id || '__first'}
                role="option"
                aria-selected={it.id === selectedId}
                className={`reskill-ss__opt${it.id === selectedId ? ' is-selected' : ''}${i === activeIndex ? ' is-active' : ''}${it.pinned ? ' reskill-ss__opt--pinned' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(it.id); }}
                title={it.label}
              >
                <span className="reskill-ss__opt-label">{it.label}</span>
                {it.id === selectedId && <span className="reskill-ss__opt-check"><CheckIcon /></span>}
              </li>
            ))}
            {items.length === 0 && <li className="reskill-ss__opt reskill-ss__opt--empty">—</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
