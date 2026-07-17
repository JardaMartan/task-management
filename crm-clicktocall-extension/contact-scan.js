/*
 * contact-scan.js
 *
 * Pure contact-extraction helpers, shared by the content script and the unit
 * tests. Written in a dual-export style so it works both as an extension
 * content script (attaches to `self.CrmContactScan`) and as a CommonJS module
 * (`require(...)` in Jest) with no bundler.
 *
 * These functions contain NO DOM or Chrome API access — they operate on plain
 * strings so they are trivially testable.
 */
(function (root) {
  'use strict';

  // Email: pragmatic RFC-ish pattern. Good enough to spot addresses in prose.
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

  // Phone: international / national numbers. Requires 7–15 significant digits,
  // optional leading +, and common separators (space, dot, dash, parentheses).
  // The surrounding lookarounds keep us from matching inside longer digit runs
  // (order numbers, IDs) as much as possible without a full libphonenumber.
  var PHONE_RE = /(?:(?<![\w.])(?:\+)?(?:\d[\s().-]*){6,14}\d)(?![\w])/g;

  /** Count the digits in a string. */
  function digitCount(s) {
    var m = String(s).match(/\d/g);
    return m ? m.length : 0;
  }

  /** Normalise a phone string to a compact dialable form (keeps a leading +). */
  function normalizePhone(raw) {
    var s = String(raw).trim();
    var hasPlus = s.charAt(0) === '+' || /^\s*\+/.test(s);
    var digits = s.replace(/\D/g, '');
    return (hasPlus ? '+' : '') + digits;
  }

  /**
   * Extract candidate contacts from a plain-text string.
   * @param {string} text
   * @returns {{emails: string[], phones: {raw:string, value:string}[]}}
   */
  function extractContacts(text) {
    var emails = [];
    var phones = [];
    if (!text || typeof text !== 'string') return { emails: emails, phones: phones };

    var seenEmail = {};
    var em;
    EMAIL_RE.lastIndex = 0;
    while ((em = EMAIL_RE.exec(text)) !== null) {
      var addr = em[0].toLowerCase();
      if (!seenEmail[addr]) { seenEmail[addr] = true; emails.push(addr); }
    }

    // Mask out emails before phone scanning so the numeric part of an address
    // (e.g. user123@x.com) is not misread as a phone number.
    var phoneText = text.replace(EMAIL_RE, ' ');

    var seenPhone = {};
    var ph;
    PHONE_RE.lastIndex = 0;
    while ((ph = PHONE_RE.exec(phoneText)) !== null) {
      var rawPhone = ph[0].trim();
      var n = digitCount(rawPhone);
      if (n < 7 || n > 15) continue;
      var value = normalizePhone(rawPhone);
      if (!seenPhone[value]) {
        seenPhone[value] = true;
        phones.push({ raw: rawPhone, value: value });
      }
    }

    return { emails: emails, phones: phones };
  }

  /** True when the given string looks like a single, whole email address. */
  function isEmail(s) {
    return typeof s === 'string' && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s.trim());
  }

  var api = {
    EMAIL_RE: EMAIL_RE,
    PHONE_RE: PHONE_RE,
    extractContacts: extractContacts,
    normalizePhone: normalizePhone,
    digitCount: digitCount,
    isEmail: isEmail,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) root.CrmContactScan = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
