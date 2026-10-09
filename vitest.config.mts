import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['__test__/**/*.test.ts'],
    fileParallelism: false,
    clearMocks: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      include: ['app/api/auth/login/route.ts', 'app/api/auth/register/route.ts'],
      reporter: ['text', 'lcov'],
    },
  },
});
