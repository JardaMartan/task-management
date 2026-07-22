import React, { useEffect, useMemo, useRef, useState } from 'react';

// Inline SVG icons (crisp, no icon-font dependency).
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
 * Compact pill dropdown with an embedded search field + filtered option list.
 * Layered on Momentum design tokens. `emptyOption` prepends an always-present
 * entry (e.g. "All active agents") that selects `null`. `searchable=false`
 * hides the search field (short lists like the time range).
 */
export default function SearchableSelect({
  label, value, options, onChange, placeholder, searchable = true, emptyOption, formatOption,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const items = useMemo(() => {
    const arr = [];
    if (emptyOption) arr.push({ id: '', label: emptyOption.label });
    for (const o of options) arr.push({ id: o.id, label: formatOption ? formatOption(o) : (o.name || o.id) });
    return arr;
  }, [options, emptyOption, formatOption]);

  const selectedId = value || '';
  const selected = items.find((i) => i.id === selectedId);
  const triggerText = selected ? selected.label : (placeholder || '');

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      // Use composedPath so clicks are detected correctly even when the widget
      // is mounted inside a shadow root (where e.target is retargeted to the host).
      const path = (e.composedPath && e.composedPath()) || [];
      if (rootRef.current && (path.includes(rootRef.current) || rootRef.current.contains(e.target))) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // On open: focus the search field and start the highlight on the current selection.
  useEffect(() => {
    if (!open) return;
    if (searchable && inputRef.current) inputRef.current.focus();
    const idx = filtered.findIndex((i) => i.id === selectedId);
    setActiveIndex(idx >= 0 ? idx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the highlight in range as the filter narrows, and scroll it into view.
  useEffect(() => { setActiveIndex((i) => Math.min(i, Math.max(0, filtered.length - 1))); }, [query, filtered.length]);
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[activeIndex];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const pick = (id) => { onChange(id || null); setOpen(false); setQuery(''); };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActiveIndex(0); }
    else if (e.key === 'End') { e.preventDefault(); setActiveIndex(filtered.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = filtered[activeIndex]; if (it) pick(it.id); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQuery(''); }
  };

  return (
    <div className="pill-ctl" ref={rootRef} onKeyDown={onKeyDown}>
      <span className="pill-ctl__label">{label}</span>
      <button
        type="button"
        className={`pill-select ${open ? 'is-open' : ''} ${selected ? '' : 'is-placeholder'}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="pill-select__value" title={triggerText}>{triggerText}</span>
        <span className="pill-select__chevron"><ChevronIcon /></span>
      </button>
      {open && (
        <div className="pill-pop">
          {searchable && (
            <div className="pill-pop__search">
              <div className="pill-pop__searchbox">
                <span className="pill-pop__search-icon"><SearchIcon /></span>
                <input
                  ref={inputRef}
                  className="pill-pop__input"
                  type="text"
                  value={query}
                  placeholder={placeholder}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
          )}
          <ul className="pill-pop__list" role="listbox" ref={listRef}>
            {filtered.map((it, i) => (
              <li
                key={it.id || '__all'}
                role="option"
                aria-selected={it.id === selectedId}
                className={`pill-pop__opt ${it.id === selectedId ? 'is-selected' : ''} ${i === activeIndex ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); pick(it.id); }}
                title={it.label}
              >
                <span className="pill-pop__opt-label">{it.label}</span>
                {it.id === selectedId && <span className="pill-pop__opt-check"><CheckIcon /></span>}
              </li>
            ))}
            {filtered.length === 0 && <li className="pill-pop__opt pill-pop__opt--empty">—</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
