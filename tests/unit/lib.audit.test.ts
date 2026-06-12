import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMock = vi.fn();
const warnMock = vi.fn();

vi.mock('@/db/client', () => ({ prisma: { auditLog: { create: (...a: unknown[]) => createMock(...a) } } }));
vi.mock('@/lib/logger', () => ({ log: { warn: (...a: unknown[]) => warnMock(...a), info: vi.fn() } }));

import { writeAudit } from '@/lib/audit';

describe('writeAudit', () => {
  beforeEach(() => {
    createMock.mockReset();
    warnMock.mockReset();
  });

  it('inserts an audit row', async () => {
    createMock.mockResolvedValue({});
    await writeAudit({ userId: 'u1', action: 'connection.create', target: 'c1', payload: { name: 'x' } });
    expect(createMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u1', action: 'connection.create', target: 'c1' }),
    });
  });

  it('skips when userId is missing (no FK to violate)', async () => {
    await writeAudit({ userId: undefined, action: 'x', target: 'y' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('never throws when the DB write fails', async () => {
    createMock.mockRejectedValue(new Error('FK violation'));
    await expect(writeAudit({ userId: 'u1', action: 'x', target: 'y' })).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalled();
  });
});
