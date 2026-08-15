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
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M9.507 12C10.33 12 11 11.331 11 10.507c0-.823-.67-1.493-1.493-1.493L5 9.014 5 12l4.507 0zM5 4l0 3 3.99 0c.827 0 1.5-.673 1.5-1.5 0-.827-.673-1.5-1.5-1.5L5 4zm6.639 3.761C12.461 8.4 13 9.388 13 10.507 13 12.433 11.433 14 9.507 14L4 14c-.553 0-1-.448-1-1l0-4.986c0-.002.001-.004.001-.007C3.001 8.004 3 8.002 3 8l0-5c0-.552.447-1 1-1l4.99 0c1.93 0 3.5 1.57 3.5 3.5 0 .866-.328 1.649-.851 2.261z" fill-rule="evenodd"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title={t('email.composer.italic')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M11.5 2l-3 0c-.276 0-.5.224-.5.5 0 .276.224.5.5.5l.786 0L5.65 13 4.5 13c-.276 0-.5.224-.5.5 0 .276.224.5.5.5l3 0c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5l-.786 0L10.35 3l1.15 0c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5" fill-rule="evenodd"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            title={t('email.composer.underline')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M13.5 13c.276 0 .5.224.5.5 0 .276-.224.5-.5.5l-11 0c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5l11 0zM13 7c0 2.757-2.243 5-5 5-2.757 0-5-2.243-5-5l0-4.5c0-.276.224-.5.5-.5.276 0 .5.224.5.5L4 7c0 2.206 1.794 4 4 4 2.206 0 4-1.794 4-4l0-4.5c0-.276.224-.5.5-.5.276 0 .5.224.5.5L13 7z" fill-rule="evenodd"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title={t('email.composer.strike')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M13.5 7.5l-4.729 0C5.373 6.987 4.99 5.975 5 5.257 5.009 4.578 5.318 3 7.977 3c1.634 0 2.369.76 2.698 1.398.127.247.429.344.673.216.246-.127.342-.428.215-.674C11.19 3.216 10.228 2 7.977 2 4.234 2 4.008 4.702 4 5.243c-.015 1.061.556 1.769 1.368 2.257L2.5 7.5c-.276 0-.5.224-.5.5 0 .276.224.5.5.5l6.184 0c1.658.255 2.44.994 2.319 2.2-.065.64-.733 2.3-3.026 2.3-1.655 0-2.687-.884-3.101-1.711-.124-.246-.426-.347-.671-.224-.247.124-.347.424-.224.671C4.529 12.831 5.866 14 7.977 14c3.034 0 3.931-2.31 4.02-3.2.054-.529.013-1.524-.822-2.3l2.325 0c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5" fill-rule="evenodd"/>
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
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M5.1465 12.8535c-.195-.195-.195-.512 0-.707l7-7c.195-.195.512-.195.707 0 .195.195.195.512 0 .707l-7 7c-.098.098-.226.146-.353.146-.128 0-.256-.048-.354-.146zm4.7822-1.8511c.256-.021.52.171.548.446.137 1.332-.324 2.635-1.264 3.574l-.69.691c-.83.83-1.938 1.287-3.118 1.287-1.181 0-2.288-.457-3.118-1.287-.83-.83-1.287-1.937-1.287-3.118 0-1.181.457-2.288 1.287-3.117l.691-.692c.939-.939 2.248-1.396 3.573-1.263.275.028.475.274.446.549-.028.275-.29.468-.547.446-1.033-.11-2.04.249-2.765.975l-.691.692c-.64.64-.994 1.496-.994 2.41 0 .914.354 1.77.994 2.411 1.282 1.281 3.54 1.281 4.822 0l.69-.691c.727-.726 1.082-1.733.977-2.764-.029-.275.171-.521.446-.549zm5.7842-8.7158c.83.83 1.287 1.937 1.287 3.118 0 1.181-.457 2.288-1.287 3.117l-.69.692c-.831.83-1.946 1.286-3.113 1.286-.153 0-.306-.007-.461-.023-.275-.028-.474-.274-.446-.549.028-.275.295-.47.548-.446 1.031.108 2.038-.249 2.765-.975l.69-.692c.641-.64.994-1.496.994-2.41 0-.914-.353-1.77-.994-2.411-1.281-1.281-3.54-1.281-4.821 0l-.691.691c-.726.726-1.082 1.733-.976 2.764.028.275-.171.521-.447.549-.26.024-.519-.171-.547-.446-.137-1.332.324-2.635 1.263-3.574l.691-.691c.83-.83 1.937-1.287 3.118-1.287 1.18 0 2.288.457 3.117 1.287z" fill-rule="evenodd"/>
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
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M3.5 5c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5h8c.276 0 .5.224.5.5 0 .276-.224.5-.5.5h-8zm8 3c.276 0 .5.224.5.5 0 .276-.224.5-.5.5h-8c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5h8zm0 3c.276 0 .5.224.5.5 0 .276-.224.5-.5.5h-8c-.276 0-.5-.224-.5-.5 0-.276.224-.5.5-.5h8zM1.5 5c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5-.276 0-.5.224-.5.5 0 .276.224.5.5.5zm0 3c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5-.276 0-.5.224-.5.5 0 .276.224.5.5.5zm0 3c.276 0 .5-.224.5-.5 0-.276-.224-.5-.5-.5-.276 0-.5.224-.5.5 0 .276.224.5.5.5z" fill-rule="evenodd"/>
            </svg>
          </ToolbarBtn>

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title={t('email.composer.orderedList')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
              <path d="M1.5 5h.75v.75H1.5V5zm0 3h.75v.75H1.5V8zm.75 2.25H1.5v.75h1.5v-.75h-.75V11H1.5v-.75zm1.75-8.25h9v.75h-9V3zm0 3h9v.75h-9V6zm0 3h9v.75h-9V9zm0 3h9v.75h-9v-.75z" fill-rule="evenodd"/>
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
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
            <path d="M6.457 2.001a.502.502 0 01.396.798C5.412 4.76 4.66 6.51 4.84 7.48c.05.267.11.288.179.314 1.508.555 2.066 2.042 1.949 3.268-.163 1.698-1.433 2.907-3.09 2.938L3.816 14c-.952 0-1.937-.424-2.643-1.14-.58-.59-1.228-1.642-1.17-3.374C.142 5.624 3.226 2 6.4 2zm9.017 0a.502.502 0 01.397.798c-1.441 1.96-2.193 3.71-2.013 4.68.05.267.109.288.178.314 1.51.555 2.067 2.042 1.949 3.268-.162 1.698-1.433 2.907-3.09 2.938l-.061.001c-.953 0-1.938-.424-2.644-1.14-.58-.59-1.258-1.656-1.2-3.388C9.128 5.61 12.243 2 15.416 2zM5.388 3.155C3.126 3.828 1.077 6.631.973 9.507c-.036 1.088.28 2.004.914 2.647.53.54 1.267.866 1.971.842 1.131-.02 2-.857 2.113-2.03.06-.63-.147-1.807-1.298-2.23-.285-.106-.68-.332-.817-1.074-.252-1.36.665-3.167 1.532-4.507zm9.018 0c-2.263.673-4.312 3.476-4.415 6.352-.036 1.088.279 2.004.913 2.647.532.54 1.256.866 1.972.842 1.132-.02 2-.857 2.112-2.03.06-.63-.146-1.807-1.298-2.23-.285-.106-.68-.332-.817-1.074-.252-1.36.666-3.167 1.533-4.507z" fill-rule="evenodd"/>
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
