import { queryClient } from './queryClient.js';

// Realtime-driven bootstrap refetches are coalesced (250 ms) and held back while this client has a
// write in flight, so a refetch can't return a pre-PUT snapshot over an optimistic value. Deferred
// requests are kept, not dropped: another user's change still lands once the writes settle.
let pending = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const wanted = new Set<string>();

function flush() {
  timer = undefined;
  wanted.forEach((id) => void queryClient.invalidateQueries({ queryKey: ['bootstrap', id] }));
  wanted.clear();
}

export function syncBootstrap(campaignId: string) {
  wanted.add(campaignId);
  if (!pending && !timer) timer = setTimeout(flush, 250);
}

/** Marks a local write as in flight until `p` settles. */
export async function tracked<T>(p: Promise<T>): Promise<T> {
  pending++;
  try {
    return await p;
  } finally {
    if (!--pending && wanted.size) {
      clearTimeout(timer);
      flush();
    }
  }
}
