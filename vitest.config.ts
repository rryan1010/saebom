import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The app imports the plan engine as @shared/... (app/tsconfig.json), so its tests do too.
    alias: { '@shared': fileURLToPath(new URL('./supabase/functions/_shared', import.meta.url)) },
  },
  test: {
    // scripts/agents tests use node:test and run under `npm run test:agents`
    include: [
      'supabase/functions/_shared/**/*.test.ts',
      'app/src/**/*.test.ts',
      'scripts/*.test.ts',
    ],
  },
});
