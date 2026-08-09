import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Renders proofread corrections inline in the editor: the original text is
// struck through and, right after it, the suggested replacement is shown with
// accept (✓) / reject (✕) icon buttons. Accept swaps the text; reject just
// removes the marker. Suggestions live in plugin state and are matched against
// the current document text on every render (no manual position mapping).

export const inlineSuggestionsKey = new PluginKey('inlineSuggestions');

const buildTextIndex = (doc) => {
  let text = '';
  const map = [];
  doc.descendants((node, pos) => {
    if (node.isText) {
      map.push({ start: text.length, pos, len: node.text.length });
      text += node.text;
    }
    return true;
  });
  return { text, map };
};

const offsetToPos = (map, offset) => {
  for (const seg of map) {
    if (offset <= seg.start + seg.len) {
      return seg.pos + Math.max(0, offset - seg.start);
    }
  }
  const last = map[map.length - 1];
  return last ? last.pos + last.len : null;
};

const findRange = (doc, original) => {
  if (!original) return null;
  const { text, map } = buildTextIndex(doc);
  const idx = text.indexOf(original);
  if (idx < 0) return null;
  const from = offsetToPos(map, idx);
  const to = offsetToPos(map, idx + original.length);
  if (from == null || to == null) return null;
  return { from, to };
};

export const InlineSuggestions = Extension.create({
  name: 'inlineSuggestions',

  addOptions() {
    return { acceptLabel: 'Accept', rejectLabel: 'Reject' };
  },

  addCommands() {
    return {
      setSuggestions: (list) => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta(inlineSuggestionsKey, { type: 'set', suggestions: list || [] }));
        return true;
      },
      clearSuggestions: () => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta(inlineSuggestionsKey, { type: 'set', suggestions: [] }));
        return true;
      },
      acceptSuggestion: (id) => ({ state, dispatch, tr }) => {
        const st = inlineSuggestionsKey.getState(state);
        const s = (st?.suggestions || []).find((x) => x.id === id);
        if (!s) return false;
        const range = findRange(state.doc, s.original);
        if (range) {
          tr.insertText(s.suggestion, range.from, range.to);
          // Keep the applied change visible instead of removing all trace of it.
          const addedMark = state.schema.marks.added;
          if (addedMark) tr.addMark(range.from, range.from + s.suggestion.length, addedMark.create());
        }
        tr.setMeta(inlineSuggestionsKey, { type: 'remove', id });
        if (dispatch) dispatch(tr);
        return true;
      },
      rejectSuggestion: (id) => ({ dispatch, tr }) => {
        if (dispatch) dispatch(tr.setMeta(inlineSuggestionsKey, { type: 'remove', id }));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const options = this.options;
    return [
      new Plugin({
        key: inlineSuggestionsKey,
        state: {
          init: () => ({ suggestions: [] }),
          apply(tr, value) {
            const meta = tr.getMeta(inlineSuggestionsKey);
            if (meta) {
              if (meta.type === 'set') return { suggestions: meta.suggestions || [] };
              if (meta.type === 'remove') return { suggestions: value.suggestions.filter((s) => s.id !== meta.id) };
            }
            return value;
          },
        },
        props: {
          decorations(state) {
            const st = inlineSuggestionsKey.getState(state);
            const suggestions = st?.suggestions || [];
            if (!suggestions.length) return DecorationSet.empty;
            const { text, map } = buildTextIndex(state.doc);
            const decos = [];
            suggestions.forEach((s) => {
              if (!s.original) return;
              const idx = text.indexOf(s.original);
              if (idx < 0) return;
              const from = offsetToPos(map, idx);
              const to = offsetToPos(map, idx + s.original.length);
              if (from == null || to == null) return;
              decos.push(Decoration.inline(from, to, { class: `sugg-orig sugg-orig--${s.type || 'grammar'}` }));
              decos.push(Decoration.widget(to, () => {
                const wrap = document.createElement('span');
                wrap.className = 'sugg-widget';
                wrap.contentEditable = 'false';
                const nw = document.createElement('span');
                nw.className = 'sugg-new';
                nw.textContent = s.suggestion;
                const acc = document.createElement('button');
                acc.type = 'button';
                acc.className = 'sugg-btn sugg-accept';
                acc.title = options.acceptLabel;
                acc.setAttribute('aria-label', options.acceptLabel);
                acc.textContent = '✓';
                const rej = document.createElement('button');
                rej.type = 'button';
                rej.className = 'sugg-btn sugg-reject';
                rej.title = options.rejectLabel;
                rej.setAttribute('aria-label', options.rejectLabel);
                rej.textContent = '✕';
                acc.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); editor.commands.acceptSuggestion(s.id); });
                rej.addEventListener('mousedown', (e) => { e.preventDefault(); e.stopPropagation(); editor.commands.rejectSuggestion(s.id); });
                const btns = document.createElement('span');
                btns.className = 'sugg-btns';
                btns.appendChild(acc);
                btns.appendChild(rej);
                wrap.appendChild(nw);
                wrap.appendChild(btns);
                return wrap;
              }, { side: 1, key: `sugg-${s.id}` }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export default InlineSuggestions;
