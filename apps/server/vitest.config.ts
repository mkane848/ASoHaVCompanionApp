import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/supabase.ts throws at import time if these are unset. Real routes always mock
    // ../repo.js (which is the only thing that actually touches supabaseAdmin), but ../auth.js
    // — imported unmocked, for requireAuth — pulls in supabase.ts regardless. Same stub-value
    // approach apps/web/scripts/responsive-smoke.mjs uses for its own Supabase-free harness run.
    env: {
      SUPABASE_URL: 'http://127.0.0.1:9/stub',
      SUPABASE_SERVICE_ROLE_KEY: 'stub-service-role-key',
    },
  },
});
