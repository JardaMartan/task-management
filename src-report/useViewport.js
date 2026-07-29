import { useState, useRef, useEffect } from 'react';

/**
 * Interactive viewport for a time-based timeline: wheel to zoom (anchored at the
 * cursor), drag to pan, plus zoom-in/out/reset controls. Returns a `pct(ms)`
 * mapper over the current window and the window bounds.
 *
 * @param {number} min data start (ms)
 * @param {number} max data end (ms)
 * @param {React.RefObject} containerRef element that captures wheel + drag
 */
export function useViewport(min, max, containerRef) {
  const [win, setWin] = useState(null); // null = full (auto-follows data/now)
  const view = win || { start: min, end: max };

  // Latest values for the native (non-React) event handlers.
  const viewRef = useRef(view);
  viewRef.current = view;
  const boundsRef = useRef({ min, max });
  boundsRef.current = { min, max };

  const span = Math.max(view.end - view.start, 1000);
  const pct = (x) => ((x - view.start) / span) * 100;

  const clamp = (w) => {
    const b = boundsRef.current;
    const fullSpan = Math.max(b.max - b.min, 1000);
    let sp = Math.min(Math.max(w.end - w.start, 5000), fullSpan); // min 5s window
    let s = w.start;
    let e = s + sp;
    if (s < b.min) { s = b.min; e = s + sp; }
    if (e > b.max) { e = b.max; s = e - sp; }
    if (s < b.min) s = b.min;
    return { start: s, end: e };
  };

  const zoomAt = (factor, anchor) => {
    const v = viewRef.current;
    const b = boundsRef.current;
    let a;
    if (anchor != null) {
      a = anchor;
    } else if (v.end >= b.max - (b.max - b.min) * 0.005) {
      // The end (current time) is visible at the right edge — keep it pinned
      // there while zooming so "now" stays on screen.
      a = v.end;
    } else {
      a = (v.start + v.end) / 2;
    }
    setWin(clamp({ start: a - (a - v.start) * factor, end: a + (v.end - a) * factor }));
  };
  const panBy = (dm) => {
    const v = viewRef.current;
    setWin(clamp({ start: v.start + dm, end: v.end + dm }));
  };

  const zoomIn = () => zoomAt(1 / 1.6);
  const zoomOut = () => zoomAt(1.6);
  const reset = () => setWin(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onWheel = (e) => {
      const rect = el.getBoundingClientRect();
      const v = viewRef.current;
      const sp = v.end - v.start;
      const zoomIntent = e.ctrlKey || e.metaKey;
      const horizontalIntent = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (zoomIntent) {
        // Ctrl/Cmd + wheel → zoom anchored at the cursor.
        e.preventDefault();
        const p = (e.clientX - rect.left) / rect.width;
        const anchor = v.start + p * sp;
        zoomAt(e.deltaY > 0 ? 1.2 : 1 / 1.2, anchor);
      } else if (horizontalIntent) {
        // Horizontal wheel / trackpad swipe → pan the timeline.
        e.preventDefault();
        panBy((e.deltaX / rect.width) * sp);
      }
      // Plain vertical wheel (no modifier) is left alone so the page scrolls.
    };

    let drag = null;
    const onDown = (e) => {
      drag = { x: e.clientX, v: viewRef.current, w: el.getBoundingClientRect().width };
      el.classList.add('is-dragging');
    };
    const onMove = (e) => {
      if (!drag) return;
      const sp = drag.v.end - drag.v.start;
      const dm = -((e.clientX - drag.x) / drag.w) * sp;
      setWin(clamp({ start: drag.v.start + dm, end: drag.v.end + dm }));
    };
    const onUp = () => { drag = null; el.classList.remove('is-dragging'); };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef]);

  return { start: view.start, end: view.end, span, pct, zoomIn, zoomOut, reset, isZoomed: !!win };
}
