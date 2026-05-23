import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '@/crypto/vault';

const KEY = Buffer.alloc(32, 7).toString('base64'); // deterministic test key
process.env.NEXUS_MASTER_KEY = KEY;

describe('vault', () => {
  it('encrypts and decrypts a JSON payload', () => {
    const plain = { serviceAccount: { project_id: 'demo', private_key: 'xxx' } };
    const ct = encrypt(plain);
    expect(ct).toBeInstanceOf(Buffer);
    expect(ct.length).toBeGreaterThan(28); // iv(12) + tag(16) + data
    const out = decrypt<typeof plain>(ct);
    expect(out).toEqual(plain);
  });

  it('throws on tag tampering', () => {
    const ct = encrypt({ a: 1 });
    ct[ct.length - 1] ^= 0x01; // flip last byte (auth tag)
    expect(() => decrypt(ct)).toThrow();
  });

  it('throws when master key is missing', () => {
    const orig = process.env.NEXUS_MASTER_KEY;
    delete process.env.NEXUS_MASTER_KEY;
    try {
      expect(() => encrypt({})).toThrow(/NEXUS_MASTER_KEY/);
    } finally {
      process.env.NEXUS_MASTER_KEY = orig;
    }
  });
});
