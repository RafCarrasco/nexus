import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { GitHubProvider } from '@/providers/github';

const conn = {
  id: 'c',
  type: 'github',
  config: { token: 'ghp_xxx' },
};

const connOrg = {
  id: 'c2',
  type: 'github',
  config: { token: 'ghp_xxx', org: 'my-org' },
};

const fakeRepo = {
  full_name: 'my-org/repo1',
  name: 'repo1',
  default_branch: 'main',
  private: false,
  html_url: 'https://github.com/my-org/repo1',
  language: 'TypeScript',
  pushed_at: '2026-05-20T12:00:00Z',
};

describe('GitHubProvider', () => {
  beforeEach(() => fetchMock.mockReset());

  it('listResources maps repos to ResourceDTOs', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [fakeRepo] });
    const r = await GitHubProvider.listResources(conn);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      externalId: 'my-org/repo1',
      name: 'repo1',
      kind: 'github-repo',
      metadata: {
        defaultBranch: 'main',
        private: false,
        url: 'https://github.com/my-org/repo1',
        language: 'TypeScript',
        pushedAt: '2026-05-20T12:00:00Z',
      },
    });
  });

  it('listResources uses org endpoint when org set', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await GitHubProvider.listResources(connOrg);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/orgs/my-org/repos'),
      expect.any(Object),
    );
  });

  it('listResources uses user endpoint when no org', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await GitHubProvider.listResources(conn);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/user/repos'),
      expect.any(Object),
    );
  });

  it('validate calls /user', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ login: 'user' }) });
    await expect(GitHubProvider.validate!(conn)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/user'),
      expect.any(Object),
    );
  });

  it('validate throws on 401', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    await expect(GitHubProvider.validate!(conn)).rejects.toThrow('401');
  });

  it('getHealth returns ok when the repo probe is 2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ...fakeRepo }) });
    const h = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/repos/my-org/repo1'),
      expect.any(Object),
    );
  });

  it('getHealth returns down (repo não encontrado) on 404', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });
    const h = await GitHubProvider.getHealth(conn, 'my-org/gone');
    expect(h.status).toBe('down');
    expect(h.message).toContain('não encontrado');
  });

  it('getHealth returns down (token sem acesso) on 401/403', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
    const h401 = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h401.status).toBe('down');
    expect(h401.message).toContain('token');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });
    const h403 = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h403.status).toBe('down');
  });

  it('getHealth degrades on other non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const h = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h.status).toBe('degraded');
    expect(h.message).toContain('500');
  });

  it('getHealth is down on a network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network boom'));
    const h = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h.status).toBe('down');
    expect(h.message).toContain('network boom');
  });

  it('getLastActivity fetches repo and returns pushed_at', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...fakeRepo }),
    });
    const d = await GitHubProvider.getLastActivity(conn, 'my-org/repo1');
    expect(d).toBeInstanceOf(Date);
    expect(d!.toISOString()).toBe('2026-05-20T12:00:00.000Z');
  });
});
