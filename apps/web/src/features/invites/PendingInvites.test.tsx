// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';

vi.mock('../../lib/useMyInvites.js', () => ({
  useMyInvites: () => ({
    isLoading: false,
    data: [
      { Id: 'i1', CampaignName: 'Alpha', Code: 'AAA' },
      { Id: 'i2', CampaignName: 'Beta', Code: 'BBB' },
    ],
  }),
}));
vi.mock('../../lib/api.js', () => ({
  api: { invites: { redeem: vi.fn(() => new Promise(() => {})), decline: vi.fn(() => new Promise(() => {})) } },
}));

import { PendingInvites } from './PendingInvites.js';
afterEach(cleanup);

describe('PendingInvites', () => {
  it('keeps every in-flight invite disabled, not just the latest one tapped', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><PendingInvites /></MemoryRouter>
      </QueryClientProvider>,
    );
    const accepts = screen.getAllByRole('button', { name: 'Accept' }) as HTMLButtonElement[];
    fireEvent.click(accepts[0]);
    fireEvent.click(accepts[1]);
    expect(accepts[0].disabled).toBe(true); // a single busyId slot re-enabled row 1 here
    expect(accepts[1].disabled).toBe(true);
  });
});
