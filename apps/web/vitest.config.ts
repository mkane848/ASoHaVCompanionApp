import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // supabaseClient.ts throws at import time if these are unset — same reason and same
    // stub-value approach apps/server/vitest.config.ts uses for its own SUPABASE_URL/
    // SUPABASE_SERVICE_ROLE_KEY, and harnessConfig.mjs uses for the Vite dev server harness.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:9/stub',
      VITE_SUPABASE_ANON_KEY: 'stub-anon-key',
    },
  },
});
