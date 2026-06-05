import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

// Sanitize HTML to prevent XSS — removes dangerous tags/attributes before injecting into shadow DOM
const sanitizeHtml = (html) => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove dangerous elements
    const dangerousTags = ['script', 'object', 'embed', 'applet', 'form', 'input', 'button', 'meta', 'link'];
    dangerousTags.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    // Remove dangerous attributes from all elements
    const dangerousAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
      'onkeydown', 'onkeyup', 'onkeypress', 'onsubmit', 'onreset', 'onchange', 'oninput'];
    doc.querySelectorAll('*').forEach((el) => {
      dangerousAttrs.forEach((attr) => el.removeAttribute(attr));
      // Remove javascript: href/src values
      ['href', 'src', 'action'].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (val && /^\s*javascript:/i.test(val)) {
          el.removeAttribute(attr);
        }
      });
    });

    return doc.body.innerHTML;
  } catch {
    // Fallback: return escaped plain text
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
};

const LIGHT_CSS = `
  :host { display: block; }
  * { box-sizing: border-box; }
  body, :host > div {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; line-height: 1.5; color: #333; margin: 0; padding: 8px;
  }
  img { max-width: 100%; height: auto; }
  a { color: #0076D6; }
  pre { white-space: pre-wrap; word-break: break-word; }
`;

const DARK_CSS = `
  :host { display: block; }
  * { box-sizing: border-box; color: inherit !important; }
  body, :host > div {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px; line-height: 1.5; color: #d8d8d8; background: transparent; margin: 0; padding: 8px;
  }
  img { max-width: 100%; height: auto; }
  a { color: #5bcff2 !important; }
  pre { white-space: pre-wrap; word-break: break-word; }
  table, td, th { border-color: rgba(255,255,255,.15) !important; }
  [style*="background"] { background: transparent !important; }
`;

/**
 * Renders sanitized email HTML in a Shadow DOM for CSS isolation.
 * Shadow DOM replaces the previous iframe approach — same style isolation,
 * no cross-origin restrictions, no scrolling/resize quirks, modern standard.
 */
const EmailViewer = ({ bodyHtml, bodyText, darkMode }) => {
  const hostRef = useRef(null);
  const shadowRef = useRef(null);

  const htmlContent = bodyHtml || (bodyText
    ? `<pre>${bodyText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`
    : '<p><em>No content</em></p>');

  const sanitized = sanitizeHtml(htmlContent);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Attach shadow root once
    if (!shadowRef.current) {
      shadowRef.current = host.attachShadow({ mode: 'open' });
    }

    const shadow = shadowRef.current;
    const css = darkMode ? DARK_CSS : LIGHT_CSS;

    shadow.innerHTML = `<style>${css}</style><div>${sanitized}</div>`;
  }, [sanitized, darkMode]);

  return (
    <div className="email-viewer">
      <div ref={hostRef} className="email-viewer__shadow-host" />
    </div>
  );
};

EmailViewer.propTypes = {
  bodyHtml: PropTypes.string,
  bodyText: PropTypes.string,
  darkMode: PropTypes.bool,
};

EmailViewer.defaultProps = {
  bodyHtml: '',
  bodyText: '',
  darkMode: false,
};

export default EmailViewer;
