import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDevAllowedEmail, checkDevPassword } from '@/auth/utils';

beforeEach(() => {
  // isAllowedEmail defaults to the two PG domains; clear any override so each test starts clean.
  delete process.env.NEXUS_ALLOWED_EMAIL_DOMAINS;
  process.env.NEXUS_DEV_EMAILS = 'rafael.carrasco@procurementgarage.com, other@procurementgarage.com';
  delete process.env.NEXUS_DEV_PASSWORD;
});

afterEach(() => {
  delete process.env.NEXUS_DEV_PASSWORD;
  delete process.env.NEXUS_ALLOWED_EMAIL_DOMAINS;
});

describe('isDevAllowedEmail', () => {
  it('allows an email in the list + matching domain', () => {
    expect(isDevAllowedEmail('rafael.carrasco@procurementgarage.com')).toBe(true);
  });
  it('rejects an email not in the list', () => {
    expect(isDevAllowedEmail('intruder@procurementgarage.com')).toBe(false);
  });
  it('rejects when domain does not match', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAINS = 'somewhereelse.com';
    expect(isDevAllowedEmail('rafael.carrasco@procurementgarage.com')).toBe(false);
  });
  it('is case-insensitive on both list and input', () => {
    process.env.NEXUS_DEV_EMAILS = 'RAFAEL@procurementgarage.com';
    expect(isDevAllowedEmail('rafael@procurementgarage.com')).toBe(true);
  });
});

describe('checkDevPassword', () => {
  it('returns true when NEXUS_DEV_PASSWORD is unset', () => {
    expect(checkDevPassword(undefined)).toBe(true);
    expect(checkDevPassword(null)).toBe(true);
    expect(checkDevPassword('')).toBe(true);
  });

  it('returns true on exact match', () => {
    process.env.NEXUS_DEV_PASSWORD = 'secret123';
    expect(checkDevPassword('secret123')).toBe(true);
  });

  it('returns false on mismatch', () => {
    process.env.NEXUS_DEV_PASSWORD = 'secret123';
    expect(checkDevPassword('wrongpassword')).toBe(false);
  });

  it('returns false when submitted is empty and env is set', () => {
    process.env.NEXUS_DEV_PASSWORD = 'secret123';
    expect(checkDevPassword('')).toBe(false);
    expect(checkDevPassword(null)).toBe(false);
    expect(checkDevPassword(undefined)).toBe(false);
  });
});
