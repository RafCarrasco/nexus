import { describe, it, expect, beforeEach } from 'vitest';
import { isDevAllowedEmail } from '@/auth/utils';

beforeEach(() => {
  process.env.NEXUS_ALLOWED_EMAIL_DOMAIN = 'procurementgarage.com';
  process.env.NEXUS_DEV_EMAILS = 'rafael.carrasco@procurementgarage.com, other@procurementgarage.com';
});

describe('isDevAllowedEmail', () => {
  it('allows an email in the list + matching domain', () => {
    expect(isDevAllowedEmail('rafael.carrasco@procurementgarage.com')).toBe(true);
  });
  it('rejects an email not in the list', () => {
    expect(isDevAllowedEmail('intruder@procurementgarage.com')).toBe(false);
  });
  it('rejects when domain does not match', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAIN = 'somewhereelse.com';
    expect(isDevAllowedEmail('rafael.carrasco@procurementgarage.com')).toBe(false);
  });
  it('is case-insensitive on both list and input', () => {
    process.env.NEXUS_DEV_EMAILS = 'RAFAEL@procurementgarage.com';
    expect(isDevAllowedEmail('rafael@procurementgarage.com')).toBe(true);
  });
});
