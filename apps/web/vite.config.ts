import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));
const changelog = readFileSync(fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url)), 'utf-8');
// CHANGELOG headings carry a full UTC timestamp as of 0.4.0 ("YYYY-MM-DDTHH:MM:SSZ"); older
// entries are date-only ("YYYY-MM-DD"). Both match here — AboutModal.tsx branches on whether a
// time component is present.
const releaseDateMatch = changelog.match(
  new RegExp(`## \\[${pkg.version.replace(/\./g, '\\.')}\\] — (\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}:\\d{2}Z)?)`),
);

export default defineConfig({
  plugins: [react()],
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
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
