import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { InlineSuggestions, inlineSuggestionsKey } from './inlineSuggestions';
import { AddedMark } from './addedMark';

/**
 * Headless rich-text editor wrapper built on Tiptap + ProseMirror.
 * Exposes the `editor` instance via ref for external toolbar usage.
 *
 * Props:
 *   content   – controlled HTML string (synced from Redux aiReplyDraft)
 *   onChange  – called with new HTML on every keystroke
 *   placeholder – empty-state hint
 *   disabled  – locks editor (undo countdown, sending)
 *   className – appended to .rte-editor wrapper
 *
 * CSS note: all visual styles live in email.css (injected into Shadow DOM by
 * rollup-plugin-postcss). Tiptap's own placeholder CSS is also duplicated
 * there so it works inside the shadow root.
 */
const RichTextEditor = forwardRef(({ content, onChange, placeholder, disabled, className, insertPayload, onInserted, suggestions, onSuggestionsChange, acceptLabel, rejectLabel }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, // Email replies don't need h1-h6
        code: false,
        codeBlock: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      TextAlign.configure({ types: ['paragraph'] }),
      AddedMark,
      InlineSuggestions.configure({ acceptLabel, rejectLabel }),
    ],
    content: content || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      if (onChange) onChange(ed.getHTML());
    },
  });

  // Expose the editor instance so ReplyComposer can read getText() at send time
  // and the toolbar can drive formatting.
  useImperativeHandle(ref, () => ({ editor }), [editor]);

  // Insert templates / suggested replies at the caret. Keyed on the payload
  // nonce and re-run when the editor (re)mounts, so it survives the editor being
  // unmounted during AI operations.
  const onInsertedRef = useRef(onInserted);
  onInsertedRef.current = onInserted;
  useEffect(() => {
    if (!editor || editor.isDestroyed || !insertPayload?.html) return;
    // focus() (no position) inserts at the last cursor position, not the end.
    editor.chain().focus().insertContent(insertPayload.html).run();
    onInsertedRef.current?.();
  }, [editor, insertPayload?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes (AI draft arriving from Redux)
  // Only update if content differs — avoids cursor-jump on every keystroke
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync disabled/editable state
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  // Push proofread suggestions into the inline-suggestions plugin.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setSuggestions(suggestions || []);
  }, [editor, suggestions]);

  // Report remaining inline suggestions (accept/reject shrink the list).
  const onSuggestionsChangeRef = useRef(onSuggestionsChange);
  onSuggestionsChangeRef.current = onSuggestionsChange;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return undefined;
    const handler = () => {
      const st = inlineSuggestionsKey.getState(editor.state);
      onSuggestionsChangeRef.current?.(st?.suggestions?.length ?? 0);
    };
    editor.on('transaction', handler);
    return () => editor.off('transaction', handler);
  }, [editor]);

  return (
    <EditorContent
      editor={editor}
      className={`rte-editor${className ? ` ${className}` : ''}`}
    />
  );
});

RichTextEditor.displayName = 'RichTextEditor';

RichTextEditor.propTypes = {
  content: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
  insertPayload: PropTypes.shape({ html: PropTypes.string, nonce: PropTypes.number }),
  onInserted: PropTypes.func,
  suggestions: PropTypes.array,
  onSuggestionsChange: PropTypes.func,
  acceptLabel: PropTypes.string,
  rejectLabel: PropTypes.string,
};

RichTextEditor.defaultProps = {
  content: '',
  onChange: null,
  placeholder: '',
  disabled: false,
  className: '',
  insertPayload: null,
  onInserted: null,
  suggestions: null,
  onSuggestionsChange: null,
  acceptLabel: 'Accept',
  rejectLabel: 'Reject',
};

export default RichTextEditor;
