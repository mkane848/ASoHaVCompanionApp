// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { CampaignBootstrap } from '@asohav/shared';
import { gmReplacementState, myCurrentCharacter, replacementOpenForMe } from '../../lib/replacementHero.js';
import { ReplacementHeroPrompt, ReplacementHeroToggle } from './ReplacementHero.js';

afterEach(cleanup);

function boot(over: { open?: string | null; role?: 'GM' | 'Player'; mine?: string | null } = {}): CampaignBootstrap {
  return {
    membership: { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'c', Role: over.role ?? 'Player', CharacterId: over.mine === undefined ? 'ch-new' : over.mine },
    members: [
      { Id: 'mb-1', UserId: 'u-mike', CampaignId: 'c', Role: 'Player', CharacterId: 'ch-new' },
      { Id: 'mb-2', UserId: 'u-ann', CampaignId: 'c', Role: 'Player', CharacterId: 'ch-ann' },
    ],
    characters: [{ Id: 'ch-old', UserId: 'u-mike' }, { Id: 'ch-new', UserId: 'u-mike' }, { Id: 'ch-ann', UserId: 'u-ann' }],
    party: { ReplacementHeroFor: over.open ?? null },
  } as unknown as CampaignBootstrap;
}

describe('replacement Hero helpers', () => {
  it('follows the membership pointer, not the first Character with my UserId', () => {
    expect(myCurrentCharacter(boot())?.Id).toBe('ch-new');
    expect(myCurrentCharacter(boot({ mine: null }))).toBeUndefined();
  });

  it('is open for me only when the slot holds my UserId and I am a Player with a Hero', () => {
    expect(replacementOpenForMe(boot({ open: 'u-mike' }))).toBe(true);
    expect(replacementOpenForMe(boot({ open: 'u-ann' }))).toBe(false);
    expect(replacementOpenForMe(boot())).toBe(false);
    expect(replacementOpenForMe(boot({ open: 'u-mike', mine: null }))).toBe(false);
  });

  it('offers only on a Dead or Retired current Hero, and blocks while another slot is open', () => {
    expect(gmReplacementState(boot(), 'ch-ann', 'Alive')).toBe('none');
    expect(gmReplacementState(boot(), 'ch-old', 'Dead')).toBe('none'); // a past Hero, no longer a membership's pointer
    expect(gmReplacementState(boot(), 'ch-ann', 'Dead')).toBe('offer');
    expect(gmReplacementState(boot(), 'ch-ann', 'Retired')).toBe('offer');
    expect(gmReplacementState(boot({ open: 'u-ann' }), 'ch-ann', 'Dead')).toBe('open');
    expect(gmReplacementState(boot({ open: 'u-mike' }), 'ch-ann', 'Dead')).toBe('blocked');
  });
});

describe('ReplacementHero components', () => {
  it('offers, then cancels', () => {
    const onOpen = vi.fn();
    const onCancel = vi.fn();
    const { rerender } = render(<ReplacementHeroToggle state="offer" busy={false} onOpen={onOpen} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open replacement Hero' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<ReplacementHeroToggle state="open" busy={false} onOpen={onOpen} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for none and only a note for blocked', () => {
    const { container, rerender } = render(<ReplacementHeroToggle state="none" busy={false} onOpen={vi.fn()} onCancel={vi.fn()} />);
    expect(container.innerHTML).toBe('');
    rerender(<ReplacementHeroToggle state="blocked" busy={false} onOpen={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('prompts the player with a link to the creation screen', () => {
    render(<MemoryRouter><ReplacementHeroPrompt campaignId="c1" heroName="Wren" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Create your new Hero' }).getAttribute('href')).toBe('/c/c1/create-character');
  });
});
