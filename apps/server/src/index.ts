import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attachUser } from './auth.js';
import { authRouter } from './routes/auth.js';
import { libraryRouter } from './routes/library.js';
import { campaignRouter } from './routes/campaign.js';
import { sheetRouter } from './routes/sheet.js';
import { partyRouter } from './routes/party.js';
import { bondRouter } from './routes/bond.js';
import { invitesRouter } from './routes/invites.js';
import { charactersRouter } from './routes/characters.js';
import { combatRouter } from './routes/combat.js';
import { clocksRouter } from './routes/clocks.js';
import { adventuresRouter } from './routes/adventures.js';
import { worldRouter } from './routes/world.js';
import { adminRouter } from './routes/admin.js';
import { runSeedIfEmpty } from './seed.js';
import { errorMiddleware } from './errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const WEB_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

/* Seeding must never be able to stop the server from starting. This was an unguarded
   top-level `await` until 0.50.0, and it took production down for about four hours at
   0.28.0: a transient Supabase 521 threw out of here, the process died before
   `app.listen`, Render's failed deploy silently kept serving the previous build, and
   nothing reported a problem. An empty database is a first-boot condition worth
   retrying; an unreachable one is not worth refusing to serve over. Either way the
   server comes up, `/api/health` answers, and the failure is in the logs where a deploy
   check can see it. See HANDOFF.md open issue 18. */
try {
  await runSeedIfEmpty();
} catch (err) {
  console.error('[boot] Seed check failed — starting the server anyway.', err);
}

const app = express();
app.use(express.json({ limit: '2mb' }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', WEB_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    next();
  });
}

app.use(attachUser);

app.use('/api/auth', authRouter);
app.use('/api/library', libraryRouter);
app.use('/api/campaigns', campaignRouter);
app.use('/api/campaigns/:campaignId/sheets', sheetRouter);
app.use('/api/campaigns/:campaignId/party', partyRouter);
app.use('/api/campaigns/:campaignId/bonds', bondRouter);
app.use('/api/campaigns/:campaignId/characters', charactersRouter);
app.use('/api/campaigns/:campaignId/combat', combatRouter);
app.use('/api/campaigns/:campaignId/clocks', clocksRouter);
app.use('/api/campaigns/:campaignId/adventures', adventuresRouter);
app.use('/api/campaigns/:campaignId/world', worldRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/admin', adminRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// In production, serve the built client and let it handle client-side routing.
const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(webDist)) {
  // Vite content-hashes every asset filename, so a hashed file can be cached forever — but
  // index.html can't, or a browser that cached it long-term keeps requesting asset hashes a
  // later deploy no longer has on disk (a real stranding bug, not hypothetical: this app has no
  // headers at all today, which happens to be safe only because browsers then revalidate every
  // request — TechStackAudit.md D6). index:false stops express.static from auto-serving
  // index.html for "/" under the `immutable` branch below; the SPA-fallback route beneath this
  // is then the one and only place index.html is ever sent, so its no-cache header is the one
  // and only place that has to get this right.
  app.use(
    express.static(webDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`[server] ASoHaV API listening on http://localhost:${PORT}`);
});
