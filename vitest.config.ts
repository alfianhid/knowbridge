import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['tests/**/*.test.{ts,tsx}'], exclude: ['tests/e2e/**'],
    env: { KNOWBRIDGE_STORE: 'file', KNOWBRIDGE_RETRIEVAL: 'local' },
  },
});
