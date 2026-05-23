import { describe, it, expect } from 'vitest';
import { prisma } from '@/db/client';

describe('prisma client', () => {
  it('can reach the database', async () => {
    const r = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(r[0].ok).toBe(1);
  });
});
