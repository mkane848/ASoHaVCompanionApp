// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Bond, Character, CharacterSheet, Library } from '@asohav/shared';
import { EndSessionModal } from './EndSessionModal.js';

afterEach(cleanup);

function setup(onPropose: () => Promise<void>) {
  render(
    <EndSessionModal
      sheet={{ Motifs: [] } as unknown as CharacterSheet}
      library={{ settings: { RapportTrackLength: 5, PotentialTrackLength: 5 } } as unknown as Library}
      bonds={[{ Id: 'b1', CharacterAId: 'me', CharacterBId: 'pat' } as unknown as Bond]}
      characters={[{ Id: 'pat', Name: 'Pat' } as unknown as Character]}
      myCharacterId="me"
      commitSheet={vi.fn()}
      commitParty={vi.fn()}
      onPropose={onPropose}
      onClose={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Grow closer with a Hero' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pat' }));
  fireEvent.change(screen.getByPlaceholderText(/What changed/), { target: { value: 'We fought side by side.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Propose +1 Bond' }));
}

describe('EndSessionModal Grow closer', () => {
  it('does not claim growth when the proposal is refused, and lets the player retry', async () => {
    const onPropose = vi.fn().mockRejectedValueOnce(new Error('refused')).mockResolvedValueOnce(undefined);
    setup(onPropose);
    await waitFor(() => expect(onPropose).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(screen.queryByText('Growth chosen for this session.')).toBeNull();
    expect(screen.getByText('Mark Bond')).toBeTruthy(); // the note dialog is still open
    fireEvent.click(screen.getByRole('button', { name: 'Propose +1 Bond' }));
    await waitFor(() => expect(screen.getByText('Growth chosen for this session.')).toBeTruthy());
    expect(onPropose).toHaveBeenCalledTimes(2);
  });
});
