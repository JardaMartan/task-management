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

const ToolbarGroup = ({ children }) => (
  <div className="rte-toolbar__group" role="group">
    {children}
  </div>
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
const ComposerToolbar = ({ editor, onAttachClick, children }) => {
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

        {/* ── Inline formatting (segmented MomentumUI ButtonGroup look) ── */}
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title={t('email.composer.bold')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M6 4h7a5 5 0 0 1 5 5 5 5 0 0 1-5 5H6V4zm0 11h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6v-8z"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title={t('email.composer.italic')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M11 4h6l-1 2h-2L11 18h2l-1 2H6l1-2h2l3-12H10z"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title={t('email.composer.underline')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M6 3h3v8a3 3 0 0 0 6 0V3h3v8a6 6 0 0 1-12 0V3zm1 15h10v2H7z"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title={t('email.composer.strike')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M7 3h2v8a3 3 0 0 0 6 0V3h2v8a5 5 0 0 1-10 0V3zm-1 13h12v2H6z" style="text-decoration: line-through" />
            </svg>
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* ── Link ── */}
        <div className="rte-toolbar__link-wrap">
          <ToolbarBtn
            onClick={handleLinkClick}
            active={editor.isActive('link')}
            title={editor.isActive('link') ? t('email.composer.unlink') : t('email.composer.link')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
              <path d="M10 4a4 4 0 0 1 4 4v4h-2V8a2 2 0 0 0-4 0v8a2 2 0 0 0 2 2h1v2h-1a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4zm4 0h1a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-1v-2h1a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1V4z"/>
            </svg>
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
        <ToolbarGroup>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title={t('email.composer.bulletList')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4zM9 5h2v14H9z"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title={t('email.composer.orderedList')}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
              <path d="M3 7h2v2H3zm0 4h2v2H3zm0 4h2v2H3zm4-8h14v2H7zm0 4h14v2H7zm0 4h14v2H7z"/>
            </svg>
          </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* ── Blockquote ── */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title={t('email.composer.blockquote')}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="currentColor">
            <path d="M4 4h16v2H4zm0 4h12v2H4zm0 4h16v2H4zm0 4h10v2H4z"/>
          </svg>
        </ToolbarBtn>

        {/* ── Inline AI / extra controls ── */}
        {children && (
          <>
            <ToolbarDivider />
            {children}
          </>
        )}

        {/* ── Attach (pushed right) ── */}
        {onAttachClick && (
          <>
            <span className="rte-toolbar__spacer" aria-hidden="true" />
            <button
              type="button"
              className="rte-toolbar__attach-btn"
              onMouseDown={(e) => { e.preventDefault(); onAttachClick(); }}
              title={t('email.reply.attachLabel')}
              aria-label={t('email.reply.attachLabel')}
            >
              <span aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </span>
              {t('email.reply.attachLabel')}
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
  children: PropTypes.node,
};

ComposerToolbar.defaultProps = {
  editor: null,
  onAttachClick: null,
  children: null,
};

export default ComposerToolbar;
