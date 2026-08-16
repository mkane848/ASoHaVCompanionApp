import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
import { api } from './lib/api.js';
/* Stylesheets first, and layers.css before all of them.
 *
 * @layer order is fixed by where each layer name is FIRST seen. ES imports are
 * evaluated in source order, so importing App above these would pull in every
 * component's .module.css — and their `@layer components` blocks — before this
 * declaration ran. `components` would then be registered as the first, and
 * therefore weakest, layer, and base.css's `a { color: var(--gold) }` would
 * beat a component's own colour. */
import './styles/layers.css';
import './styles/tokens.css';
import './styles/appearances.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/surfaces.css';
import App from './App.js';

// The library is user-independent (game content, not play state) — it doesn't need useMe() to
// resolve first, unlike ['bootstrap', campaignId]. App.tsx blocks its whole tree on useMe(), so
// without this every cold load pays for /api/auth/me and /api/library serially instead of in
// parallel (TechStackAudit.md B1/D4). Key/staleTime match useLibrary.ts exactly so this dedupes
// into the same in-flight query rather than firing a second request.
queryClient.prefetchQuery({
  queryKey: ['library'],
  queryFn: () => api.library.get().then((r) => r.library),
  staleTime: 60_000,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
