import { lazy, Suspense } from 'react';

// First-load JS sits at bundle-budget.mjs's cap, and this only ever renders after a failed
// request, so the markup stays out of the entry chunk.
const Inner = lazy(() => import('./LoadFailed.js').then((m) => ({ default: m.LoadFailed })));

export function LoadFailed(props: { what: string; onRetry: () => void }) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}
