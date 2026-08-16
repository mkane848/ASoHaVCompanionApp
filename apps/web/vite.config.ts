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
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
