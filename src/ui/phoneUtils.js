/**
 * phoneUtils.js
 *
 * Utilities for classifying phone numbers for the CustomerContactCard.
 * Currently supports Czech (+420), German (+49), and UK (+44) mobile number detection.
 *
 * Rules
 * ─────
 * Czech mobile (+420):
 *   Domestic format:      6xxxxxxxx or 7xxxxxxxx  (9 digits, starts with 6 or 7)
 *   International format: +420 6xx xxx xxx or +420 7xx xxx xxx
 *   Mobile prefixes: 601–699, 700–799 (operators share 6xx / 7xx blocks)
 *
 * German mobile (+49):
 *   Domestic format:      01[5-7]x xxxxxxxx  (starts with 015x, 016x, 017x)
 *   International format: +49 1[5-7]x xxxxxxxx
 *   Mobile prefix ranges: 015x (Telekom, Vodafone, O2 MVNOs),
 *                         016x (O2, Vodafone, Telekom),
 *                         017x (Telekom, Vodafone, O2)
 *
 * UK mobile (+44):
 *   Domestic format:      07[1-5789]xxxxxxx  (10 digits, starts with 071–075, 077–079)
 *   International format: +44 7[1-5789]xxxxxxx
 *   Excluded: 070 (personal numbers / redirect services — not mobile)
 *             076 (pager numbers — not mobile)
 *   All other 07x prefixes (071–075, 077–079) are genuine mobile ranges.
 *
 * Numbers from any other country/format are treated as UNKNOWN — the caller
 * decides whether to show buttons for unknown numbers (default: true, so
 * international numbers that don't match CZ/DE/UK are not filtered out).
 */

/**
 * Strip all whitespace, hyphens, parentheses, dots from a phone number string,
 * leaving only digits, a leading +, or a leading 00.
 *
 * @param {string} raw
 * @returns {string}
 */
const normalise = (raw) =>
  String(raw || '')
    .replace(/[\s\-().]/g, '')
    .trim();

/**
 * Returns true if the (normalised) number looks like a Czech mobile number.
 *
 * @param {string} n  - normalised number string
 * @returns {boolean}
 */
const isCzechMobile = (n) => {
  // International: +420 followed by 6 or 7 and exactly 8 more digits
  if (/^\+420[67]\d{8}$/.test(n)) return true;
  // Alternative international prefix: 00420
  if (/^00420[67]\d{8}$/.test(n)) return true;
  // Domestic: exactly 9 digits starting with 6 or 7
  if (/^[67]\d{8}$/.test(n)) return true;
  return false;
};

/**
 * Returns true if the (normalised) number looks like a German mobile number.
 *
 * @param {string} n  - normalised number string
 * @returns {boolean}
 */
const isGermanMobile = (n) => {
  // International: +49 15x/16x/17x followed by 8–9 digits (total after +49: 10–11 digits)
  if (/^\+491[5-7]\d{8,9}$/.test(n)) return true;
  // Alternative international prefix: 0049
  if (/^00491[5-7]\d{8,9}$/.test(n)) return true;
  // Domestic with leading 0: 015x/016x/017x followed by 8–9 digits
  if (/^01[5-7]\d{8,9}$/.test(n)) return true;
  return false;
};

/**
 * Returns true if the (normalised) number looks like a UK mobile number.
 *
 * UK mobile prefixes (Ofcom numbering plan):
 *   071–075, 077–079 → genuine mobile ranges
 *   070               → personal numbers (not mobile, excluded)
 *   076               → pager numbers (not mobile, excluded)
 *
 * @param {string} n  - normalised number string
 * @returns {boolean}
 */
const isUkMobile = (n) => {
  // International: +44 7[1-5789] followed by 8 digits (total 12 digits after +)
  if (/^\+447[1-5789]\d{8}$/.test(n)) return true;
  // Alternative international prefix: 0044
  if (/^00447[1-5789]\d{8}$/.test(n)) return true;
  // Domestic with leading 0: 07[1-5789] followed by 8 digits
  if (/^07[1-5789]\d{8}$/.test(n)) return true;
  return false;
};

/**
 * Returns true if the number matches a recognised country code that we have
 * mobile rules for (+420 CZ, +49 DE, +44 UK), but does NOT match mobile patterns —
 * i.e. it's a known-landline number.
 *
 * @param {string} n  - normalised number string
 * @returns {boolean}
 */
const isKnownLandline = (n) => {
  // Starts with Czech country code but not a mobile prefix
  if (/^\+420/.test(n) || /^00420/.test(n)) return !isCzechMobile(n);
  // Starts with German country code but not a mobile prefix
  if (/^\+49/.test(n) || /^0049/.test(n)) return !isGermanMobile(n);
  // Starts with UK country code but not a mobile prefix
  if (/^\+44/.test(n) || /^0044/.test(n)) return !isUkMobile(n);
  // 9-digit domestic Czech number but doesn't start with 6 or 7 → landline
  if (/^[2-589]\d{8}$/.test(n)) return true;
  // Domestic DE number starting with 0 but not 015x/016x/017x → landline
  if (/^0[^1]/.test(n)) return true;
  // Domestic UK number starting with 0 but not a mobile prefix → landline
  // (covers 01xxx, 02xxx landlines and 070/076 non-mobile special numbers)
  if (/^0[^7]/.test(n)) return true;
  if (/^07[06]/.test(n)) return true;  // 070 personal / 076 pager
  return false;
};

/**
 * Determine whether a phone number should show messaging (WhatsApp/SMS) buttons.
 *
 * Returns true for:
 *   - Confirmed Czech mobile numbers
 *   - Confirmed German mobile numbers
 *   - Confirmed UK mobile numbers
 *   - Numbers with unrecognised format (no country code, ambiguous) — shown by
 *     default so we don't silently hide buttons for unlisted countries.
 *
 * Returns false for numbers that are positively identified as landlines
 * (CZ/DE/UK country code present but prefix is not a mobile range).
 *
 * @param {string} raw  - raw phone number as stored in JDS / customerProfile
 * @returns {boolean}
 */
export const isMobileNumber = (raw) => {
  const n = normalise(raw);
  if (!n) return false;
  if (isCzechMobile(n)) return true;
  if (isGermanMobile(n)) return true;
  if (isUkMobile(n)) return true;
  if (isKnownLandline(n)) return false;
  // Unknown format — show buttons rather than silently suppress them
  return true;
};
