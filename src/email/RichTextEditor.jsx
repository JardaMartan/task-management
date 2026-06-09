import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';

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
const RichTextEditor = forwardRef(({ content, onChange, placeholder, disabled, className }, ref) => {
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
    ],
    content: content || '',
    editable: !disabled,
    onUpdate: ({ editor: ed }) => {
      if (onChange) onChange(ed.getHTML());
    },
  });

  // Expose editor instance via ref so ReplyComposer can read getText() at send time
  useImperativeHandle(ref, () => ({ editor }), [editor]);

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
};

RichTextEditor.defaultProps = {
  content: '',
  onChange: null,
  placeholder: '',
  disabled: false,
  className: '',
};

export default RichTextEditor;
