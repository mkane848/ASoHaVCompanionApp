import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));
const changelog = readFileSync(fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)), 'utf-8');
// CHANGELOG headings carry a full UTC timestamp as of 0.4.0 ("YYYY-MM-DDTHH:MM:SSZ"); older
// entries are date-only ("YYYY-MM-DD"). Both match here — AboutModal.tsx branches on whether a
// time component is present.
const releaseDateMatch = changelog.match(
  new RegExp(`## \\[${pkg.version.replace(/\./g, '\\.')}\\] — (\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}Z)?)`),
);

export default defineConfig({
  plugins: [
    react({
      // TechStackAudit.md D10/G13. The usual pitch ("delete your manual memoization") barely
      // applies here — apps/web has 8 useMemo, 2 useCallback, zero memo() across 93 files. The
      // real case is the opposite: the compiler *introduces* memoization this codebase has never
      // had, on an app where every Realtime event invalidates ['bootstrap', campaignId] and
      // re-renders the whole campaign tree from the root. Gated on G11 (ESLint + react-hooks,
      // which folds the compiler's own rule set in) and G12 (a first web test suite) landing
      // green first, per the audit's own explicit sequencing — neither existed before this pass,
      // and the compiler silently bails on a component it can't prove safe rather than erroring,
      // so those are what would have caught a Rules-of-React violation instead. Also checked
      // directly in this sandbox before enabling (the audit's own couldn't):
      // `npx react-compiler-healthcheck` reports 88/88 components compiling successfully.
      babel: { plugins: [['babel-plugin-react-compiler', {}]] },
    }),
    // Opt-in only (TechStackAudit.md D1) — an ordinary `vite build` emits no stats file.
    // `npm run build:visualize -w @asohav/web` writes apps/web/.stats/bundle.html for a human
    // to inspect; scripts/bundle-budget.mjs reads the manifest directly and doesn't need this.
    ...(process.env.VISUALIZE ? [visualizer({ filename: '.stats/bundle.html', gzipSize: true })] : []),
  ],
  css: {
    modules: {
      // Readable in devtools; the hash still guarantees uniqueness.
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_RELEASE_DATE__: JSON.stringify(releaseDateMatch?.[1] ?? null),
  },
  build: {
    // scripts/bundle-budget.mjs reads dist/.vite/manifest.json to sum first-load bytes.
    // Dot-prefixed, so express.static's default `dotfiles: 'ignore'` never serves it
    // (confirmed against apps/server/src/index.ts's bare `express.static(webDist)` call).
    manifest: true,
    rollupOptions: {
      output: {
        // Saves zero first-load bytes on its own — every chunk below still ships before first
        // paint. The entire payoff is keeping vendor content-hashes stable across deploys (only
        // useful once apps/server/src/index.ts's cache headers make a stable hash worth
        // anything — TechStackAudit.md D6/D7, must land after G9). Three deliberate omissions,
        // each one a real footgun if named here instead: react/react-dom/react-router stay
        // together because they co-initialize (splitting them risks a "cannot access before
        // initialization" error at runtime for no benefit); zod/react-hook-form/
        // @hookform/resolvers are never named, because naming them would hoist them into an
        // eagerly-referenced chunk and undo G4's lazy-loaded CreateCharacterPage entirely; and
        // @asohav/shared is never named, because it's a workspace source dependency — pinning it
        // into a vendor chunk would make that chunk's hash change on every game-content edit,
        // destroying the cache stability this change exists to provide.
        //
        // 'react-router-dom' -> 'react-router' as of G14 (TechStackAudit.md D11) — the package
        // itself was swapped, not just its imports; a stale name here fails the build outright
        // (rollup can't resolve a manualChunks entry that names an uninstalled package), which
        // is exactly what caught this needing an update.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
