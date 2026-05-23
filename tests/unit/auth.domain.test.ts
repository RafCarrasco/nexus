import { describe, it, expect } from 'vitest';
import { isAllowedEmail } from '@/auth/utils';

describe('isAllowedEmail', () => {
  it('accepts the configured domain', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAIN = 'procurementgarage.com';
    expect(isAllowedEmail('alice@procurementgarage.com')).toBe(true);
  });
  it('rejects other domains', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAIN = 'procurementgarage.com';
    expect(isAllowedEmail('bob@gmail.com')).toBe(false);
  });
  it('is case-insensitive', () => {
    process.env.NEXUS_ALLOWED_EMAIL_DOMAIN = 'procurementgarage.com';
    expect(isAllowedEmail('CASEY@ProcurementGarage.com')).toBe(true);
  });
  it('rejects empty/undefined', () => {
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail('')).toBe(false);
  });
});
