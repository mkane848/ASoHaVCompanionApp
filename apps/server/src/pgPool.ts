import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set — see apps/server/.env.example.');
}

// Used only for the Bond handshake (propose/accept/reject), which needs a real transactional
// row lock (`SELECT ... FOR UPDATE`) that `supabase-js` (PostgREST) can't offer — it only ever
// does a plain check-then-write. Everything else in the app goes through the supabaseAdmin
// client in repo.ts.
export const pgPool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
