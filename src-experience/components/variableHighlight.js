import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const variableHighlightKey = new PluginKey('variableHighlight');

const TOKEN_RE = /\{\{(\w+)\}\}/g;

/**
 * Tiptap extension that visually highlights `{{variable}}` placeholder tokens in
 * the editor. Known variables (options.known) get the accent style; anything
 * else is flagged as unknown so supervisors notice typos / unsupported tokens.
 */
export const VariableHighlight = Extension.create({
  name: 'variableHighlight',

  addOptions() {
    return { known: [] };
  },

  addProseMirrorPlugins() {
    const known = new Set((this.options.known || []).map(String));
    return [
      new Plugin({
        key: variableHighlightKey,
        props: {
          decorations(state) {
            const decos = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText || !node.text) return;
              let m;
              TOKEN_RE.lastIndex = 0;
              while ((m = TOKEN_RE.exec(node.text)) !== null) {
                const from = pos + m.index;
                const to = from + m[0].length;
                const isKnown = known.size === 0 || known.has(m[1]);
                decos.push(Decoration.inline(from, to, {
                  class: `exp-var${isKnown ? '' : ' exp-var--unknown'}`,
                }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
