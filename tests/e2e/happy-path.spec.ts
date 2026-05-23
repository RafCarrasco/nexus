import { test, expect } from '@playwright/test';

test.use({
  extraHTTPHeaders: { 'x-nexus-e2e': '1' },
});

test('create fake connection, run collector, see resources + incident flow', async ({ page, request }) => {
  // 1. create connection via API
  const create = await request.post('/api/connections', {
    data: { name: 'E2E Fake', type: 'fake', config: { resourceCount: 2 } },
  });
  expect(create.status()).toBe(201);

  // 2. run collector
  const run = await request.post('/api/collector/run');
  expect(run.status()).toBe(204);

  // 3. open the resources page
  await page.goto('/resources');
  await expect(page.getByText('Fake Resource 0').first()).toBeVisible();
  await expect(page.getByText('Fake Resource 1').first()).toBeVisible();

  // 4. open overview
  await page.goto('/');
  await expect(page.locator('h1', { hasText: 'Overview' })).toBeVisible();
});
