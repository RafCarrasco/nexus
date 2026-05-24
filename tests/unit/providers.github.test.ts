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

  it('getHealth always returns ok', async () => {
    const h = await GitHubProvider.getHealth(conn, 'my-org/repo1');
    expect(h.status).toBe('ok');
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
