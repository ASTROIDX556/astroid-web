import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit test runner for pure modules (`src/lib`, `src/features/**\/utils`).
 *
 * Deliberately node-environment only — these suites cover formatting,
 * validation, and data-shaping logic, so no DOM or React renderer is needed.
 * The `@/*` alias mirrors `tsconfig.json` so tests import exactly as app code does.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
