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

  test('extracts international and formatted phone numbers', () => {
    const text = 'Mobile +1 (415) 555-0142, office 020 7946 0958, CZ +420 602 123 456';
    const { phones } = scan.extractContacts(text);
    const values = phones.map((p) => p.value);
    expect(values).toContain('+14155550142');
    expect(values).toContain('02079460958');
    expect(values).toContain('+420602123456');
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
