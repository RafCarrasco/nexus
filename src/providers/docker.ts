import Docker from 'dockerode';
import type { Provider, ConnectionView, ResourceDTO, CostDTO, HealthDTO, TenantDTO } from './types';

function clientFor(conn: ConnectionView): Docker {
  const socketPath = (conn.config.socketPath as string) ?? '/var/run/docker.sock';
  return new Docker({ socketPath });
}

function cleanName(name: string): string {
  return name.replace(/^\//, '');
}

export const DockerProvider: Provider = {
  type: 'docker',

  async listResources(conn) {
    const docker = clientFor(conn);
    const containers = await docker.listContainers({ all: true });
    return containers.map<ResourceDTO>((c) => ({
      externalId: c.Id,
      name: cleanName(c.Names?.[0] ?? c.Id.slice(0, 12)),
      kind: 'container',
      metadata: {
        image: c.Image,
        state: c.State,
        status: c.Status,
        createdAt: new Date(c.Created * 1000).toISOString(),
      },
    }));
  },

  async getDailyCost(): Promise<CostDTO | null> {
    return null;
  },

  async getLastActivity(conn, externalId) {
    const docker = clientFor(conn);
    const info = await docker.getContainer(externalId).inspect();
    const started = info.State?.StartedAt;
    return started ? new Date(started) : null;
  },

  async getHealth(conn, externalId): Promise<HealthDTO> {
    const docker = clientFor(conn);
    const info = await docker.getContainer(externalId).inspect();
    const state = info.State?.Status;
    const health = info.State?.Health?.Status;
    if (state === 'running' && (!health || health === 'healthy')) return { status: 'ok' };
    if (state === 'running' && health === 'starting') return { status: 'degraded', message: 'starting' };
    if (state === 'running' && health === 'unhealthy') return { status: 'degraded', message: 'unhealthy' };
    if (state === 'exited' || state === 'dead') return { status: 'down', message: `state=${state}` };
    return { status: 'unknown', message: `state=${state}` };
  },

  async listTenants(): Promise<TenantDTO[]> {
    return [];
  },

  async validate(conn) {
    const docker = clientFor(conn);
    await docker.ping();
  },
};
