import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import { useI18n } from '../i18n/I18nContext';
import { VariableHighlight } from './variableHighlight';

// Inline SVG toolbar icons (no icon-font dependency in the standalone bundle).
const I = {
  bold: <path fill="currentColor" d="M5 3h4.5a3 3 0 0 1 1.9 5.3A3.2 3.2 0 0 1 9.8 14H5V3zm2 2v2.2h2.3a1.1 1.1 0 0 0 0-2.2H7zm0 4.2V12h2.6a1.4 1.4 0 0 0 0-2.8H7z" />,
  italic: <path fill="currentColor" d="M6 3h6v2H9.8l-2 6H10v2H4v-2h2.2l2-6H6V3z" />,
  underline: <path fill="currentColor" d="M4 3h2v5a2 2 0 0 0 4 0V3h2v5a4 4 0 0 1-8 0V3zM3 14h10v1.5H3V14z" />,
  ul: <path fill="currentColor" d="M3 4.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 .2h8v1.6H6V4.7zm-3 3.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 .2h8v1.6H6V8.2zm-3 3.3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 .2h8v1.6H6v-1.6z" />,
  ol: <path fill="currentColor" d="M6 4.7h8v1.6H6V4.7zm0 3.5h8v1.6H6V8.2zm0 3.5h8v1.6H6v-1.6zM2.2 3.4h1.6v3H2.9v-2.3H2.2V3.4zm-.1 4.5h1.9v.9l-1 1.1h1v.8H2v-.9l1-1.1H2.1v-.8zM2 12.4h1.9v3H2v-.7h1.1v-.4H2.4v-.7h.7v-.4H2v-.8z" />,
  link: <path fill="currentColor" d="M6.7 9.3a2.5 2.5 0 0 0 3.5 0l2-2a2.5 2.5 0 1 0-3.5-3.5l-1 1 1 1 1-1a1.1 1.1 0 0 1 1.5 1.5l-2 2a1.1 1.1 0 0 1-1.5 0l-1 1zm2.6-2.6a2.5 2.5 0 0 0-3.5 0l-2 2a2.5 2.5 0 1 0 3.5 3.5l1-1-1-1-1 1a1.1 1.1 0 0 1-1.5-1.5l2-2a1.1 1.1 0 0 1 1.5 0l1-1z" />,
  alignLeft: <path fill="currentColor" d="M2 3h12v1.6H2V3zm0 3.2h8v1.6H2V6.2zm0 3.2h12V11H2V9.4zm0 3.2h8v1.6H2v-1.6z" />,
  alignCenter: <path fill="currentColor" d="M2 3h12v1.6H2V3zm2 3.2h8v1.6H4V6.2zM2 9.4h12V11H2V9.4zm2 3.2h8v1.6H4v-1.6z" />,
};

const Icon = ({ d }) => (
  <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">{d}</svg>
);

/**
 * Rich-text HTML editor with a formatting toolbar and a Visual/HTML toggle.
 * Controlled: `value` is an HTML string, `onChange(html)` fires on every edit
 * (from the visual editor) or on textarea input (in HTML mode). Built on Tiptap,
 * matching the task-management composer.
 */
export default function RichHtmlEditor({ value, onChange, placeholder, variables }) {
  const { t } = useI18n();
  const [mode, setMode] = useState('visual'); // 'visual' | 'html'
  const [helpOpen, setHelpOpen] = useState(false);
  const textareaRef = useRef(null);
  const vars = variables || [];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, code: false, codeBlock: false }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Placeholder.configure({ placeholder: placeholder || '' }),
      TextAlign.configure({ types: ['paragraph'] }),
      VariableHighlight.configure({ known: vars }),
    ],
    content: value || '',
    onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
  });

  // Keep the editor in sync when the value changes externally (e.g. switching
  // template/language) or after HTML-mode edits, without clobbering the caret.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  const active = (name, attrs) => (editor && editor.isActive(name, attrs) ? ' is-active' : '');
  const run = (fn) => () => { if (editor) fn(editor.chain().focus()); };

  // Insert a {{variable}} token at the caret — in the visual editor or, in HTML
  // mode, at the textarea selection.
  const insertVariable = (name) => {
    const token = `{{${name}}}`;
    if (mode === 'html') {
      const ta = textareaRef.current;
      const cur = value || '';
      if (ta && typeof ta.selectionStart === 'number') {
        const s = ta.selectionStart; const e = ta.selectionEnd;
        const next = cur.slice(0, s) + token + cur.slice(e);
        onChange(next);
        requestAnimationFrame(() => { ta.focus(); const p = s + token.length; ta.setSelectionRange(p, p); });
      } else {
        onChange(cur + token);
      }
      return;
    }
    if (editor) editor.chain().focus().insertContent(token).run();
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link')?.href || '';
    // eslint-disable-next-line no-alert
    const url = globalThis.prompt?.(t('rte.linkPrompt'), prev);
    if (url === null) return;
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const Btn = ({ on, cls, icon, label }) => (
    <button
      type="button"
      className={`exp-rte__btn${cls || ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      title={label}
      aria-label={label}
    >
      <Icon d={icon} />
    </button>
  );

  return (
    <div className="exp-rte">
      <div className="exp-rte__bar">
        <div className="exp-rte__tools" data-disabled={mode === 'html' ? 'true' : undefined}>
          <Btn on={run((c) => c.toggleBold().run())} cls={active('bold')} icon={I.bold} label={t('rte.bold')} />
          <Btn on={run((c) => c.toggleItalic().run())} cls={active('italic')} icon={I.italic} label={t('rte.italic')} />
          <Btn on={run((c) => c.toggleUnderline().run())} cls={active('underline')} icon={I.underline} label={t('rte.underline')} />
          <span className="exp-rte__div" />
          <Btn on={run((c) => c.toggleBulletList().run())} cls={active('bulletList')} icon={I.ul} label={t('rte.bulletList')} />
          <Btn on={run((c) => c.toggleOrderedList().run())} cls={active('orderedList')} icon={I.ol} label={t('rte.orderedList')} />
          <span className="exp-rte__div" />
          <Btn on={run((c) => c.setTextAlign('left').run())} cls={active('paragraph', { textAlign: 'left' })} icon={I.alignLeft} label={t('rte.alignLeft')} />
          <Btn on={run((c) => c.setTextAlign('center').run())} cls={active('paragraph', { textAlign: 'center' })} icon={I.alignCenter} label={t('rte.alignCenter')} />
          <span className="exp-rte__div" />
          <Btn on={setLink} cls={active('link')} icon={I.link} label={t('rte.link')} />
        </div>
        <span className="exp-rte__spacer" />
        <div className="exp-pill-seg exp-rte__mode" role="tablist" aria-label={t('rte.mode')}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'visual'}
            className={`exp-pill-seg__btn${mode === 'visual' ? ' is-active' : ''}`}
            onClick={() => setMode('visual')}
          >
            {t('rte.visual')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'html'}
            className={`exp-pill-seg__btn${mode === 'html' ? ' is-active' : ''}`}
            onClick={() => setMode('html')}
          >
            {t('rte.html')}
          </button>
        </div>
      </div>

      {mode === 'visual' ? (
        <EditorContent editor={editor} className="exp-rte__editor" />
      ) : (
        <textarea
          ref={textareaRef}
          className="exp-input exp-textarea exp-code exp-rte__html"
          value={value || ''}
          spellCheck={false}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {vars.length > 0 && (
        <div className="exp-vars">
          <div className="exp-vars__row">
            <span className="exp-vars__title">{t('vars.insert')}</span>
            {vars.map((name) => (
              <button
                key={name}
                type="button"
                className="exp-var-chip"
                title={t(`vars.desc.${name}`)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVariable(name)}
              >
                {`{{${name}}}`}
              </button>
            ))}
            <button
              type="button"
              className="exp-vars__help-toggle"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((v) => !v)}
            >
              {helpOpen ? t('vars.hideHelp') : t('vars.showHelp')}
            </button>
          </div>
          {helpOpen && (
            <dl className="exp-vars__help">
              <div className="exp-vars__help-note">{t('vars.help')}</div>
              {vars.map((name) => (
                <div key={name} className="exp-vars__help-item">
                  <dt><code>{`{{${name}}}`}</code></dt>
                  <dd>{t(`vars.desc.${name}`)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
