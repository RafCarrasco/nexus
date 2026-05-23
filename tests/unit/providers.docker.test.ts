import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listContainersMock, containerMock } = vi.hoisted(() => ({
  listContainersMock: vi.fn(),
  containerMock: vi.fn(),
}));

vi.mock('dockerode', () => {
  function MockDocker(this: unknown) {
    return {
      listContainers: listContainersMock,
      getContainer: containerMock,
      ping: vi.fn().mockResolvedValue('OK'),
    };
  }
  return { default: MockDocker };
});

import { DockerProvider } from '@/providers/docker';

describe('DockerProvider', () => {
  beforeEach(() => {
    listContainersMock.mockReset();
    containerMock.mockReset();
  });

  it('lists containers as resources', async () => {
    listContainersMock.mockResolvedValue([
      { Id: 'abc123', Names: ['/web'], Image: 'nginx:latest', State: 'running', Status: 'Up 2h', Created: 1716480000 },
      { Id: 'def456', Names: ['/db'],  Image: 'postgres:16', State: 'exited',  Status: 'Exited (0)', Created: 1716483600 },
    ]);
    const resources = await DockerProvider.listResources({ id: 'c', type: 'docker', config: {} });
    expect(resources).toHaveLength(2);
    expect(resources[0]).toMatchObject({ externalId: 'abc123', name: 'web', kind: 'container' });
  });

  it('reports degraded when container exited', async () => {
    containerMock.mockReturnValue({
      inspect: vi.fn().mockResolvedValue({
        State: { Status: 'exited', Health: undefined, StartedAt: '2026-05-22T00:00:00Z' },
      }),
    });
    const h = await DockerProvider.getHealth({ id: 'c', type: 'docker', config: {} }, 'abc123');
    expect(h.status).toBe('down');
  });

  it('returns null cost (no native billing)', async () => {
    const cost = await DockerProvider.getDailyCost({ id: 'c', type: 'docker', config: {} }, 'abc123', new Date());
    expect(cost).toBeNull();
  });
});
