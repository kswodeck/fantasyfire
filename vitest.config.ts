import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Unit/integration tests run under Vitest. Default environment is `node`
// (pure compute fns, the NBA client, route handlers). Component tests opt into
// jsdom per-file with a `// @vitest-environment jsdom` comment at the top.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright owns tests/e2e; keep it out of Vitest.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
