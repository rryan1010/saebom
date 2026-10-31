import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // scripts/agents tests use node:test and run under `npm run test:agents`
    include: [
      'supabase/functions/_shared/**/*.test.ts',
      'app/src/**/*.test.ts',
      'scripts/*.test.ts',
    ],
  },
});
