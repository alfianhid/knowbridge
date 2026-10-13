import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/e2e', workers: 1, retries: 0,
  use: { baseURL: 'http://127.0.0.1:3100', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: {
    command: 'node .next/standalone/server.js',
    url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 60_000,
    env: { PORT: '3100', HOSTNAME: '127.0.0.1', KNOWBRIDGE_STORE: 'file', KNOWBRIDGE_DATA_DIR: path.resolve('.data/sources') },
  },
});
