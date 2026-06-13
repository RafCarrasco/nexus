import { defineConfig } from '@playwright/test';

// Shared E2E bypass secret. Set on the runner process here so BOTH this process
// (the spec reads it to build the header) and the child webServer (below) see the
// same value. Overridable via a real env var in CI.
process.env.NEXUS_E2E_SECRET ||= 'e2e-local-bypass-secret';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  webServer: {
    command: 'node .next/standalone/server.js',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXUS_E2E: '1',
      NEXUS_E2E_SECRET: process.env.NEXUS_E2E_SECRET,
      AUTH_TRUST_HOST: '1',
      AUTH_SECRET: 'devsecret',
    },
  },
});
