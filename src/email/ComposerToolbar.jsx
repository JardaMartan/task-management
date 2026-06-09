import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useI18n } from '../i18n/I18nContext';

// ─── Primitive toolbar button ────────────────────────────────────────────────
// Uses onMouseDown + preventDefault so the editor never loses focus on click.
const ToolbarBtn = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    className={`rte-toolbar__btn${active ? ' rte-toolbar__btn--active' : ''}${disabled ? ' rte-toolbar__btn--disabled' : ''}`}
    onMouseDown={(e) => {
      e.preventDefault(); // keep ProseMirror focus
      if (!disabled) onClick();
    }}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    aria-label={title}
  >
    {children}
  </button>
);

ToolbarBtn.propTypes = {
  onClick: PropTypes.func.isRequired,
  active: PropTypes.bool,
  disabled: PropTypes.bool,
  title: PropTypes.string,
  children: PropTypes.node.isRequired,
};
ToolbarBtn.defaultProps = { active: false, disabled: false, title: '' };

const ToolbarDivider = () => (
  <span className="rte-toolbar__divider" role="separator" aria-hidden="true" />
);

// ─── Link popover ────────────────────────────────────────────────────────────
const LinkPopover = ({ initialUrl, onSubmit, onClose }) => {
  const [url, setUrl] = useState(initialUrl || 'https://');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onSubmit(url); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="rte-toolbar__link-popover" role="dialog" aria-label="Insert link">
      <input
        ref={inputRef}
        className="rte-toolbar__link-input"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="https://example.com"
        aria-label="URL"
      />
      <button
        type="button"
        className="rte-toolbar__link-ok"
        onMouseDown={(e) => { e.preventDefault(); onSubmit(url); }}
      >
        OK
      </button>
      <button
        type="button"
        className="rte-toolbar__link-cancel"
        onMouseDown={(e) => { e.preventDefault(); onClose(); }}
        aria-label="Cancel"
      >
        ✕
      </button>
    </div>
  );
};

LinkPopover.propTypes = {
  initialUrl: PropTypes.string,
  onSubmit: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};
LinkPopover.defaultProps = { initialUrl: '' };

// ─── Main toolbar ────────────────────────────────────────────────────────────
/**
 * Formatting toolbar for the rich-text email composer.
 * Receives the Tiptap `editor` instance as a prop.
 * All buttons use onMouseDown + preventDefault to keep editor focus.
 * Pass `onAttachClick` to show the paperclip button on the right end.
 */
const ComposerToolbar = ({ editor, onAttachClick }) => {
  const { t } = useI18n();
  const [showLinkPopover, setShowLinkPopover] = useState(false);

  if (!editor) return null;

  const handleLinkClick = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
    } else {
      setShowLinkPopover(true);
    }
  };

  const handleLinkSubmit = (url) => {
    setShowLinkPopover(false);
    const trimmed = url?.trim();
    if (!trimmed || trimmed === 'https://') return;
    editor.chain().focus().setLink({ href: trimmed }).run();
  };

  return (
    <div className="rte-toolbar" role="toolbar" aria-label={t('email.composer.toolbar')}>
      <div className="rte-toolbar__row">

        {/* ── Inline formatting ── */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title={t('email.composer.bold')}
        >
          <strong>B</strong>
        </ToolbarBtn>

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title={t('email.composer.italic')}
        >
          <em style={{ fontStyle: 'italic' }}>I</em>
        </ToolbarBtn>

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title={t('email.composer.underline')}
        >
          <span className="rte-toolbar__icon-u">U</span>
        </ToolbarBtn>

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title={t('email.composer.strike')}
        >
          <s>S</s>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* ── Link ── */}
        <div className="rte-toolbar__link-wrap">
          <ToolbarBtn
            onClick={handleLinkClick}
            active={editor.isActive('link')}
            title={editor.isActive('link') ? t('email.composer.unlink') : t('email.composer.link')}
          >
            <span className="rte-toolbar__icon-link" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </span>
          </ToolbarBtn>
          {showLinkPopover && (
            <LinkPopover
              initialUrl={editor.getAttributes('link').href}
              onSubmit={handleLinkSubmit}
              onClose={() => setShowLinkPopover(false)}
            />
          )}
        </div>

        <ToolbarDivider />

        {/* ── Lists ── */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title={t('email.composer.bulletList')}
        >
          <span className="rte-toolbar__icon-ul" aria-hidden="true">≡</span>
        </ToolbarBtn>

        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title={t('email.composer.orderedList')}
        >
          <span className="rte-toolbar__icon-ol" aria-hidden="true">#≡</span>
        </ToolbarBtn>

        <ToolbarDivider />

        {/* ── Blockquote ── */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title={t('email.composer.blockquote')}
        >
          <span aria-hidden="true">❝</span>
        </ToolbarBtn>

        {/* ── Attach (pushed right) ── */}
        {onAttachClick && (
          <>
            <span className="rte-toolbar__spacer" aria-hidden="true" />
            <button
              type="button"
              className="rte-toolbar__btn rte-toolbar__attach-btn"
              onMouseDown={(e) => { e.preventDefault(); onAttachClick(); }}
              title={t('email.reply.attachLabel')}
              aria-label={t('email.reply.attachLabel')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
          </>
        )}

      </div>
    </div>
  );
};

ComposerToolbar.propTypes = {
  editor: PropTypes.object,
  onAttachClick: PropTypes.func,
};

ComposerToolbar.defaultProps = {
  editor: null,
  onAttachClick: null,
};

export default ComposerToolbar;
