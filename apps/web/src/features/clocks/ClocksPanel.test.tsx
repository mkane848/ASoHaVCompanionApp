// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import type { CampaignBootstrap } from '@asohav/shared';

const save = vi.fn();
vi.mock('../../lib/mutations.js', () => ({ useClockActions: () => ({ save, create: vi.fn(), remove: vi.fn() }) }));
vi.mock('../../lib/useGlossaryMatcher.js', () => ({ useGlossaryMatcher: () => null }));

import { ClocksPanel } from './ClocksPanel.js';
afterEach(() => { cleanup(); save.mockReset(); });

const clock = { Id: 'c1', CampaignId: 'x', Title: 'Tide', Kind: 'TugOfWar', Segments: 6, SuccessMarks: 3, Goal: '', SkillTags: [], Developments: [], PromotedToBoard: false, Status: 'Open', History: [] };
const boot = { membership: { Role: 'GM' }, campaign: { Status: 'Active' }, clocks: [clock] } as unknown as CampaignBootstrap;

describe('Clock tick controls', () => {
  it('disables Tick up/down when the amount is empty or zero, so no "Ticked +0" is saved', () => {
    render(<ClocksPanel campaignId="x" boot={boot} />);
    const amount = screen.getByLabelText('Tick amount');
    const up = screen.getByRole('button', { name: 'Tick up' }) as HTMLButtonElement;
    const down = screen.getByRole('button', { name: 'Tick down' }) as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    fireEvent.change(amount, { target: { value: '' } });
    expect(up.disabled).toBe(true);
    expect(down.disabled).toBe(true);
    fireEvent.click(up);
    expect(save).not.toHaveBeenCalled();
    fireEvent.change(amount, { target: { value: '2' } });
    fireEvent.click(up);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
