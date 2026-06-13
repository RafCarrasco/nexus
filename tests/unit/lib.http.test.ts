import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSafePublicHttpUrl, probePublicUrl } from '@/lib/http';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('isSafePublicHttpUrl', () => {
  it('accepts public http(s) URLs including custom domains', () => {
    expect(isSafePublicHttpUrl('https://app.vercel.app')).toBe(true);
    expect(isSafePublicHttpUrl('https://example.com')).toBe(true);
    expect(isSafePublicHttpUrl('http://my-custom-domain.io')).toBe(true);
  });

  it('rejects non-http(s) schemes', () => {
    expect(isSafePublicHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isSafePublicHttpUrl('ftp://host/x')).toBe(false);
    expect(isSafePublicHttpUrl('not a url')).toBe(false);
  });

  it('rejects loopback / private / link-local / metadata hosts', () => {
    expect(isSafePublicHttpUrl('http://localhost/')).toBe(false);
    expect(isSafePublicHttpUrl('http://127.0.0.1/')).toBe(false);
    expect(isSafePublicHttpUrl('http://10.0.0.5/')).toBe(false);
    expect(isSafePublicHttpUrl('http://192.168.1.1/')).toBe(false);
    expect(isSafePublicHttpUrl('http://172.16.0.1/')).toBe(false);
    expect(isSafePublicHttpUrl('http://169.254.169.254/')).toBe(false);
    expect(isSafePublicHttpUrl('http://svc.internal/')).toBe(false);
  });

  it('rejects IPv6 loopback / unique-local / link-local / v4-mapped literals', () => {
    expect(isSafePublicHttpUrl('http://[::1]/')).toBe(false); // loopback
    expect(isSafePublicHttpUrl('http://[::]/')).toBe(false); // unspecified
    expect(isSafePublicHttpUrl('http://[fd00::1]/')).toBe(false); // unique-local
    expect(isSafePublicHttpUrl('http://[fc00::1]/')).toBe(false); // unique-local
    expect(isSafePublicHttpUrl('http://[fe80::1]/')).toBe(false); // link-local
    expect(isSafePublicHttpUrl('http://[::ffff:127.0.0.1]/')).toBe(false); // v4-mapped loopback
  });

  it('still accepts public domains that merely start with fc/fd/fe', () => {
    expect(isSafePublicHttpUrl('https://fc-barcelona.com')).toBe(true);
    expect(isSafePublicHttpUrl('https://fdis.example.org')).toBe(true);
    expect(isSafePublicHttpUrl('https://feedly.com')).toBe(true);
  });
});

describe('probePublicUrl', () => {
  beforeEach(() => fetchMock.mockReset());

  it('returns unknown for missing or unsafe url without probing', async () => {
    expect(await probePublicUrl(undefined)).toMatchObject({ status: 'unknown' });
    expect(await probePublicUrl('http://169.254.169.254/')).toMatchObject({ status: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns ok on 2xx and degraded on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true });
    expect(await probePublicUrl('https://example.com')).toMatchObject({ status: 'ok' });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await probePublicUrl('https://example.com')).toMatchObject({ status: 'degraded' });
  });

  it('returns degraded when the probe throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect(await probePublicUrl('https://example.com')).toMatchObject({ status: 'degraded' });
  });
});
