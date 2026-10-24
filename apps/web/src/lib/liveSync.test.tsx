// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CampaignBootstrap, Clock } from '@asohav/shared';

// Pins the Realtime refetch policy: events are coalesced into one bootstrap refetch, held back
// (not dropped) while this client's own write is in flight, and a reconnect resyncs once.
const h = vi.hoisted(() => ({
  handlers: [] as (() => void)[],
  status: undefined as undefined | ((s: string) => void),
  saves: [] as (() => void)[],
}));

vi.mock('./supabaseClient.js', () => {
  const channel = {
    on(_t: string, _f: unknown, cb: () => void) { h.handlers.push(cb); return channel; },
    subscribe(cb: (s: string) => void) { h.status = cb; return channel; },
  };
  return { supabase: { channel: () => channel, removeChannel: () => {} } };
});
vi.mock('./api.js', () => ({
  api: { clocks: { save: vi.fn((_c: string, clock: Clock) => new Promise((resolve) => { h.saves.push(() => resolve({ clock })); })) } },
}));

import { queryClient } from './queryClient.js';
import { useLiveCampaign } from './useLiveCampaign.js';
import { useClockActions } from './mutations.js';

const clock = { Id: 'c1', SuccessMarks: 1 } as unknown as Clock;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
let spy: { mock: { calls: unknown[][] }; mockRestore: () => void };
const bootstrapCalls = () => spy.mock.calls.filter(([f]) => (f as { queryKey: string[] }).queryKey[0] === 'bootstrap').length;

beforeEach(() => {
  vi.useFakeTimers();
  h.handlers.length = 0;
  h.saves.length = 0;
  queryClient.setQueryData(['bootstrap', 'cm'], { clocks: [clock] } as unknown as CampaignBootstrap);
  spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup(); // Testing Library only auto-cleans when vitest globals are on, and they are not
  vi.useRealTimers();
  spy.mockRestore();
});

describe('useLiveCampaign refetch policy', () => {
  it('coalesces a burst of events into one refetch', () => {
    renderHook(() => useLiveCampaign('cm'), { wrapper });
    act(() => { for (let i = 0; i < 9; i++) h.handlers[i % h.handlers.length](); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(bootstrapCalls()).toBe(1);
  });

  it('defers events while a local write is in flight, then refetches once', async () => {
    renderHook(() => useLiveCampaign('cm'), { wrapper });
    const actions = renderHook(() => useClockActions('cm'), { wrapper });
    act(() => { void actions.result.current.save({ ...clock, SuccessMarks: 2 }); });
    await act(async () => { await Promise.resolve(); });
    expect(h.saves).toHaveLength(1);
    act(() => { h.handlers[0](); h.handlers[1](); vi.advanceTimersByTime(1000); });
    expect(bootstrapCalls()).toBe(0);
    await act(async () => { h.saves[0](); await vi.advanceTimersByTimeAsync(1000); });
    expect(bootstrapCalls()).toBe(1);
  });

  it('resyncs once when the channel resubscribes after a drop, but not on first join', () => {
    renderHook(() => useLiveCampaign('cm'), { wrapper });
    act(() => { h.status?.('SUBSCRIBED'); vi.advanceTimersByTime(1000); });
    expect(bootstrapCalls()).toBe(0);
    act(() => { h.status?.('CHANNEL_ERROR'); h.status?.('SUBSCRIBED'); vi.advanceTimersByTime(1000); });
    expect(bootstrapCalls()).toBe(1);
  });
});
