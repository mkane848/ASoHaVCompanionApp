/**
 * Shared harness config for the responsive smoke test and the screenshot
 * script (added 0.24.0) — one list of viewports and routes, one Vite dev
 * server bootstrap, so the two scripts can't quietly drift apart.
 */
import { createServer } from 'vite';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const VIEWPORTS = [
  { name: '360 phone', width: 360, height: 780, touch: true },
  { name: '390 phone', width: 390, height: 844, touch: true },
  { name: '768 tablet portrait', width: 768, height: 1024, touch: true },
  { name: '1024 tablet landscape', width: 1024, height: 768, touch: true },
  { name: '1440 desktop', width: 1440, height: 900, touch: false },
  // Added 0.24.0: 1440 was the widest viewport tested, but a "1440p monitor" is
  // 2560x1440 — literally untested. These two exercise the sheet/Campaign
  // >=1800px --content-max-wide step (see tokens.css/layout.css's `.page-shell`).
  { name: '1920 desktop', width: 1920, height: 1080, touch: false },
  { name: '2560 desktop (1440p)', width: 2560, height: 1440, touch: false },
];

// Mirrors apps/web/src/lib/appearances.ts's AppearanceId/APPEARANCES by hand — this file is a
// plain Node ESM script (no TS loader), so it can't import a .ts module from apps/web/src.
// harness.html reads `?appearance=` (see its own inline script) to force whichever of these two
// IDs a given navigation should render, independent of whatever's in localStorage.
export const APPEARANCES = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'noticeboard', label: 'Notice Board' },
];

export const ROUTES = [
  { name: 'home', qs: 'route=/&as=ryan' },
  { name: 'home (pending invite)', qs: 'route=/&as=mike' },
  { name: 'campaign (player)', qs: 'route=/c/cm-1&as=ryan' },
  { name: 'campaign (GM)', qs: 'route=/c/cm-1&as=mike' },
  { name: 'campaign (player, active encounter)', qs: 'route=/c/cm-1&as=ryan&encounter=1' },
  { name: 'campaign (GM, active encounter)', qs: 'route=/c/cm-1&as=mike&encounter=1' },
  { name: 'campaign (player, open clocks)', qs: 'route=/c/cm-1&as=ryan&clocks=1' },
  { name: 'campaign (GM, open clocks)', qs: 'route=/c/cm-1&as=mike&clocks=1' },
  { name: 'campaign (archived)', qs: 'route=/c/cm-1&as=ryan&archived=1' },
  { name: 'character sheet', qs: 'route=/c/cm-1/sheet&as=ryan' },
  { name: 'character sheet (archived)', qs: 'route=/c/cm-1/sheet&as=ryan&archived=1' },
  { name: 'combat (no active encounter)', qs: 'route=/c/cm-1/combat&as=ryan' },
  { name: 'combat (active encounter, player)', qs: 'route=/c/cm-1/combat&as=ryan&encounter=1' },
  { name: 'combat (active encounter, GM)', qs: 'route=/c/cm-1/combat&as=mike&encounter=1' },
  { name: 'adventure prep (empty, GM)', qs: 'route=/c/cm-1/adventure&as=mike' },
  { name: 'adventure prep (populated, GM)', qs: 'route=/c/cm-1/adventure&as=mike&adventures=1' },
  { name: 'create character', qs: 'route=/c/cm-3/create-character&as=dax' },
  { name: 'content admin', qs: 'route=/admin&as=mike' },
  { name: 'login (signed out)', qs: 'route=/&anon=1' },
];

/**
 * Starts the same no-server, seed-fixture Vite harness both scripts render
 * through, and returns the resolved base URL plus a close() to tear it down.
 */
export async function startHarnessServer() {
  const server = await createServer({
    // fileURLToPath, not `new URL(...).pathname`: the latter keeps the leading slash of the
    // drive letter on Windows (`/M:/...`), which Vite then re-prefixes into `M:\M:\...`.
    root: fileURLToPath(new URL('..', import.meta.url)),
    // Port 0 lets the OS pick, so this never collides with a dev server. The
    // resolved URL is read back below rather than assumed — apps/web/vite.config.ts
    // pins 5173, and its value wins the config merge.
    server: { port: 0, strictPort: false },
    logLevel: 'error',
    // The harness never reaches Supabase, but supabaseClient.ts throws at import
    // time if these are unset, which would blank the page before anything renders.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:9/stub'),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || 'stub-anon-key'),
    },
  });
  await server.listen();
  const origin = server.resolvedUrls?.local?.[0];
  if (!origin) {
    await server.close();
    throw new Error('Vite did not report a local URL — the dev server failed to start.');
  }
  const base = `${origin.replace(/\/$/, '')}/harness.html`;
  return { base, close: () => server.close() };
}
