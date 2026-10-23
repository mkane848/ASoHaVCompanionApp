// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';
import { cleanup, renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CampaignBootstrap, Clock } from '@asohav/shared';

// Guards 0.77.1's Clock save: an edit is written into the cache at once, a Clock's saves reach
// the server one at a time in tap order, and a failed newest save restores the previous value.
const saves: { clock: Clock; resolve: (c: Clock) => void; reject: (e: Error) => void }[] = [];
vi.mock('./api.js', () => ({
  api: {
    clocks: {
      save: vi.fn((_cid: string, clock: Clock) => new Promise<{ clock: Clock }>((resolve, reject) => {
        saves.push({ clock, resolve: (c) => resolve({ clock: c }), reject });
      })),
    },
  },
}));

import { useClockActions } from './mutations.js';
import { useToastStore } from '../store/toastStore.js';

const clock = (marks: number): Clock => ({
  Id: 'c1', CampaignId: 'cm', Title: 'Gate', Kind: 'Threat', Segments: 6, SuccessMarks: marks, Goal: '', SkillTags: [],
  Developments: [], PromotedToBoard: false, Status: 'Open', History: [], CreatedAt: '', UpdatedAt: '',
}) as Clock;

function setup() {
  const qc = new QueryClient();
  qc.setQueryData(['bootstrap', 'cm'], { clocks: [clock(2)] } as unknown as CampaignBootstrap);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useClockActions('cm'), { wrapper });
  const marks = () => (qc.getQueryData(['bootstrap', 'cm']) as { clocks: Clock[] }).clocks[0].SuccessMarks;
  return { result, marks };
}

afterEach(cleanup); // Testing Library only auto-cleans when vitest globals are on, and they are not

beforeEach(() => {
  saves.length = 0;
  useToastStore.setState({ message: null });
});

describe('useClockActions.save', () => {
  it('shows the edit in the cache before the server answers', () => {
    const { result, marks } = setup();
    act(() => { void result.current.save(clock(3)); });
    expect(marks()).toBe(3);
  });

  it('sends a Clock\'s saves one at a time, in tap order', async () => {
    const { result } = setup();
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.save(clock(3));
      second = result.current.save(clock(4));
    });
    await Promise.resolve();
    expect(saves.map((s) => s.clock.SuccessMarks)).toEqual([3]); // the second waits for the first
    saves[0].resolve(clock(3));
    await first;
    await Promise.resolve();
    expect(saves.map((s) => s.clock.SuccessMarks)).toEqual([3, 4]);
    saves[1].resolve(clock(4));
    await second;
  });

  it('restores the previous value and says so when the newest save fails', async () => {
    const { result, marks } = setup();
    let p!: Promise<boolean>;
    act(() => { p = result.current.save(clock(3)); });
    await Promise.resolve();
    saves[0].reject(new Error('Network down'));
    expect(await p).toBe(false);
    expect(marks()).toBe(2);
    expect(useToastStore.getState().message).toBe('Network down');
  });
});
