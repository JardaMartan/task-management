import { Mark, mergeAttributes } from '@tiptap/core';

// Visual-only mark used to highlight text the agent accepted (inline suggestion)
// or added (suggested addition) so it stays visible as "changed". Rendered as
// <mark class="rte-added"> and stripped from the outgoing email before sending.
export const AddedMark = Mark.create({
  name: 'added',
  inclusive: false,
  parseHTML() {
    return [{ tag: 'mark.rte-added' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes, { class: 'rte-added' }), 0];
  },
});

export default AddedMark;
