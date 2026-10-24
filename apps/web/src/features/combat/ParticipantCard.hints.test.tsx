// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { newParticipant, newEnemyParticipant, seedLibrary, type CombatParticipant, type EnemyStatBlock } from '@asohav/shared';
import { EnemyCard, OwnPCCard } from './ParticipantCard.js';

afterEach(cleanup);

/** The reason a button is disabled has to be visible text on a touch screen (no hover `title`),
 *  and the button has to point at it. */
function expectDescribedBy(button: HTMLElement, text: string) {
  const id = button.getAttribute('aria-describedby');
  expect(id, `${button.textContent} has no aria-describedby`).toBeTruthy();
  const hint = document.getElementById(id!);
  expect(hint?.textContent).toBe(text);
  expect(button.hasAttribute('title')).toBe(false);
}

const noop = vi.fn();
function ownCard(p: CombatParticipant, extra: { dying?: boolean } = {}) {
  render(
    <OwnPCCard
      participant={p}
      statuses={[]}
      canRecuperate={!extra.dying}
      dying={extra.dying}
      onSetAP={noop} onReposition={noop} onEngageMelee={noop} onEngageRanged={noop}
      onRecuperate={noop} onPrepare={noop} onBreak={noop} onRemove={noop}
    />,
  );
}

describe('OwnPCCard disabled-button reasons', () => {
  it('explains Recuperate while Dying', () => {
    ownCard(newParticipant({ Kind: 'PC', RefId: 'c1', Name: 'Ash' }), { dying: true });
    const btn = screen.getByRole('button', { name: 'Recuperate' });
    expect(btn).toHaveProperty('disabled', true);
    expectDescribedBy(btn, 'A Dying Hero can’t take Recuperate.');
  });

  it('explains Prepare when already prepared', () => {
    ownCard({ ...newParticipant({ Kind: 'PC', RefId: 'c1', Name: 'Ash' }), PrepareNextTurn: true });
    const btn = screen.getByRole('button', { name: 'Prepare (1 AP)' });
    expect(btn).toHaveProperty('disabled', true);
    expectDescribedBy(btn, 'Prepare doesn’t stack with itself.');
  });

  it('shows no hint when nothing is disabled for those reasons', () => {
    ownCard(newParticipant({ Kind: 'PC', RefId: 'c1', Name: 'Ash' }));
    expect(screen.getByRole('button', { name: 'Recuperate' }).hasAttribute('aria-describedby')).toBe(false);
    expect(document.querySelector('p[id]')).toBeNull();
  });
});

describe('EnemyCard negate-with-Status reasons', () => {
  const stats = { Profile: 'Standard', StatusSlots: 1, StrainBoxes: 3, Attacks: [], Virtues: [] } as unknown as EnemyStatBlock;
  function enemy(filled: boolean) {
    const p = newEnemyParticipant({ RefId: 'e1', Name: 'Brute', Stats: stats });
    if (filled) p.StatusNotes = ['Cracked shield'];
    render(
      <EnemyCard
        participant={p}
        library={seedLibrary()}
        canControl
        pendingHits={[{ Id: 'h1', Amount: 2, Note: 'Sword' } as never]}
        onSetAP={noop} onReposition={noop} onAttack={noop} onResolveHit={noop}
        onMarkCondition={noop} onClearCondition={noop} onSetMinionCount={noop} onSetGambitCharges={noop}
        onRemove={noop}
      />,
    );
  }

  it('says why Confirm is disabled until the wound is described', () => {
    enemy(false);
    fireEvent.click(screen.getByRole('button', { name: 'Negate with Status' }));
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm).toHaveProperty('disabled', true);
    expectDescribedBy(confirm, 'Describe the lasting wound to confirm.');
    fireEvent.change(screen.getByLabelText('Describe the lasting wound'), { target: { value: 'Torn tendon' } });
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Confirm' }).hasAttribute('aria-describedby')).toBe(false);
  });

  it('says why Negate with Status is disabled when no slot is free', () => {
    enemy(true);
    const btn = screen.getByRole('button', { name: 'Negate with Status' });
    expect(btn).toHaveProperty('disabled', true);
    expectDescribedBy(btn, 'No free Status slots.');
  });
});
