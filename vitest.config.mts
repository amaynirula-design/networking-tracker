import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Load .env.local so the opt-in RLS integration test can find its
    // credentials. The unit tests need none of this and run either way.
    env: loadEnv('', process.cwd(), ''),
    testTimeout: 30_000,
  },
});
