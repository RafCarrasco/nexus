import { describe, it, expect, afterEach } from 'vitest';
import { isAllowedEmail, allowedDomains } from '@/auth/utils';

describe('isAllowedEmail', () => {
  afterEach(() => {
    delete process.env.NEXUS_ALLOWED_EMAIL_DOMAINS;
  });

  it('accepts both PG domains by default (no env)', () => {
    delete process.env.NEXUS_ALLOWED_EMAIL_DOMAINS;
    expect(isAllowedEmail('alice@procurementgarage.com')).toBe(true);
    expect(isAllowedEmail('rafael@pgconsulting-group.com')).toBe(true);
  });
  it('rejects other domains', () => {
    expect(isAllowedEmail('bob@gmail.com')).toBe(false);
    expect(isAllowedEmail('x@evil.com')).toBe(false);
    expect(isAllowedEmail('x@procurementgarage.com.evil.com')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(isAllowedEmail('CASEY@PGConsulting-Group.com')).toBe(true);
  });
  it('rejects empty/undefined', () => {
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
  });
  it('honors the NEXUS_ALLOWED_EMAIL_DOMAINS override', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAINS = 'foo.com, @bar.com';
    expect(allowedDomains()).toEqual(['foo.com', 'bar.com']);
    expect(isAllowedEmail('a@foo.com')).toBe(true);
    expect(isAllowedEmail('a@bar.com')).toBe(true);
    // override replaces the PG defaults
    expect(isAllowedEmail('a@procurementgarage.com')).toBe(false);
  });
});
