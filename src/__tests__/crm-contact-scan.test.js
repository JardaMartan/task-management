const path = require('path');
const scan = require(path.join(__dirname, '..', '..', 'crm-clicktocall-extension', 'contact-scan.js'));

describe('CRM contact scanner — extractContacts', () => {
  test('extracts a simple email', () => {
    const { emails, phones } = scan.extractContacts('Contact: jane.doe@example.com today');
    expect(emails).toEqual(['jane.doe@example.com']);
    expect(phones).toHaveLength(0);
  });

  test('lowercases and de-duplicates emails', () => {
    const { emails } = scan.extractContacts('A@X.com and a@x.com and B@x.com');
    expect(emails).toEqual(['a@x.com', 'b@x.com']);
  });

  test('extracts + international phone numbers (E.164)', () => {
    const text = 'Mobile +1 (415) 555-0142, office 020 7946 0958, CZ +420 602 123 456';
    const { phones } = scan.extractContacts(text);
    const values = phones.map((p) => p.value);
    expect(values).toContain('+14155550142');
    expect(values).toContain('+420602123456');
    // A bare national number with no leading + is ignored.
    expect(values).not.toContain('02079460958');
  });

  test('requires a leading + (bare national numbers are ignored)', () => {
    const { phones } = scan.extractContacts('Call 415 555 0142 or +14155550142 today');
    expect(phones.map((p) => p.value)).toEqual(['+14155550142']);
  });

  test('rejects +-numbers that are not valid E.164', () => {
    // Country code cannot start with 0, and too-short numbers are invalid.
    expect(scan.extractContacts('+0123456789').phones).toHaveLength(0);
    expect(scan.extractContacts('+12').phones).toHaveLength(0);
    // Too long (>15 digits) is also rejected.
    expect(scan.extractContacts('+1234567890123456').phones).toHaveLength(0);
  });

  test('does not treat the digits of an email as a phone number', () => {
    const { emails, phones } = scan.extractContacts('user12345678@example.com');
    expect(emails).toEqual(['user12345678@example.com']);
    expect(phones).toHaveLength(0);
  });

  test('ignores long id/order numbers (>15 digits)', () => {
    const { phones } = scan.extractContacts('Order #10029384756123456 reference');
    expect(phones).toHaveLength(0);
  });

  test('ignores short digit runs (<7 digits)', () => {
    const { phones } = scan.extractContacts('Suite 4021 on floor 3');
    expect(phones).toHaveLength(0);
  });

  test('isE164 validates normalised + numbers only', () => {
    expect(scan.isE164('+14155550142')).toBe(true);
    expect(scan.isE164('+420602123456')).toBe(true);
    expect(scan.isE164('02079460958')).toBe(false); // no leading +
    expect(scan.isE164('+0123')).toBe(false);       // leading 0 country code
    expect(scan.isE164('+12')).toBe(false);         // too short
  });

  test('returns empty result for non-string input', () => {
    expect(scan.extractContacts(null)).toEqual({ emails: [], phones: [] });
    expect(scan.extractContacts(undefined)).toEqual({ emails: [], phones: [] });
  });

  test('normalizePhone keeps a leading + and strips separators', () => {
    expect(scan.normalizePhone('+1 (415) 555-0142')).toBe('+14155550142');
    expect(scan.normalizePhone('020 7946 0958')).toBe('02079460958');
  });

  test('isEmail validates whole-string addresses only', () => {
    expect(scan.isEmail('a@b.com')).toBe(true);
    expect(scan.isEmail('  a@b.com  ')).toBe(true);
    expect(scan.isEmail('mail a@b.com here')).toBe(false);
    expect(scan.isEmail('not-an-email')).toBe(false);
  });
});
