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
    react(),
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
        // each one a real footgun if named here instead: react/react-dom/react-router-dom stay
        // together because they co-initialize (splitting them risks a "cannot access before
        // initialization" error at runtime for no benefit); zod/react-hook-form/
        // @hookform/resolvers are never named, because naming them would hoist them into an
        // eagerly-referenced chunk and undo G4's lazy-loaded CreateCharacterPage entirely; and
        // @asohav/shared is never named, because it's a workspace source dependency — pinning it
        // into a vendor chunk would make that chunk's hash change on every game-content edit,
        // destroying the cache stability this change exists to provide.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
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
