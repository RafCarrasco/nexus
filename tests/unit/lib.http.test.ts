import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSafePublicHttpUrl, probePublicUrl, isTransientError, withRetry } from '@/lib/http';

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

describe('isTransientError', () => {
  it('treats timeouts, network errors and 429/5xx as transient', () => {
    expect(isTransientError(new Error('request timeout'))).toBe(true);
    expect(isTransientError(new Error('fetch failed'))).toBe(true);
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('http 429'))).toBe(true);
    expect(isTransientError(new Error('http 500'))).toBe(true);
    expect(isTransientError(new Error('http 503'))).toBe(true);
  });

  it('treats auth/not-found/bad-request as permanent (no retry)', () => {
    expect(isTransientError(new Error('http 400'))).toBe(false);
    expect(isTransientError(new Error('http 401'))).toBe(false);
    expect(isTransientError(new Error('http 403'))).toBe(false);
    expect(isTransientError(new Error('http 404'))).toBe(false);
    expect(isTransientError(new Error('unknown provider type: foo'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const onRetry = vi.fn();
    expect(await withRetry(fn, { baseMs: 1, onRetry })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries transient failures then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('http 503'))
      .mockResolvedValue('ok');
    const onRetry = vi.fn();
    expect(await withRetry(fn, { baseMs: 1, onRetry })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not retry permanent errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('http 404'));
    await expect(withRetry(fn, { baseMs: 1 })).rejects.toThrow('404');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries on persistent transient errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    await expect(withRetry(fn, { baseMs: 1, retries: 2 })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
