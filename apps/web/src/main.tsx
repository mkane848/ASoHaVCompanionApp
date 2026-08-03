import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient.js';
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
import './styles/base.css';
import './styles/layout.css';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
