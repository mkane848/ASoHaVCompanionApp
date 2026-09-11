import { useState } from 'react';
import type { Bond, Character, CharacterSheet, Library } from '@asohav/shared';
import { addMotifPotential } from '@asohav/shared';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './SpendHoldModal.module.css';

type SpendMode = 'charges' | 'condition' | 'bond' | 'potential';

/** Spending Hold, restored in 0.50.0.
 *
 *  Hold had become a one-way counter: `MoveRollHelper.tsx` grants it on Assess the Situation and
 *  Discern the Truth via `holdGrantForTier()`, `StatusesPanel.tsx` displays it, and nothing
 *  anywhere decremented it. Slice 4 (0.45.0) replaced End the Session's per-player Hold economy
 *  with the three-way growth choice and retired that modal's four spends along with it — but the
 *  Move-level grants stayed, so the number on the sheet only ever went up.
 *
 *  The four spends are the same four that economy offered, decoupled from End the Session so they
 *  are available whenever the player has Hold: refresh a Gear item's Charges, clear a Condition,
 *  mark a Bond, or mark Potential. Each costs 1.
 *
 *  Marking a Bond still goes through the propose/accept handshake (`onPropose`) rather than
 *  writing the Bond directly — spending Hold gates *offering* the proposal, it doesn't bypass the
 *  other player's agreement, exactly as it did before slice 4. Hold is therefore decremented when
 *  the proposal is sent, not when it is accepted; a declined proposal doesn't refund it, matching
 *  the old behaviour and every other "you spent it to act" resource in this app. */
export function SpendHoldModal({
  sheet,
  library,
  bonds,
  characters,
  myCharacterId,
  archived,
  commitSheet,
  onPropose,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  /** Bond writes are refused server-side on an archived campaign, so that one option hides
   *  rather than failing on tap — same treatment AdvancementPanel/CampaignBonds already give it. */
  archived?: boolean;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  onPropose: (bondId: string, type: 'MarkBond' | 'SpendBond', note?: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useModalA11y(onClose);
  const [mode, setMode] = useState<SpendMode | null>(null);
  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);
  const [note, setNote] = useState('');

  const hold = sheet.Hold ?? 0;
  const canSpend = hold > 0;

  // Only a carried item with a Charges allowance that has actually been spent down is worth
  // refreshing — an untouched one would consume Hold for nothing.
  const refreshable = sheet.Items.map((ci, index) => ({ ci, index, item: library.items.find((i) => i.Id === ci.ItemId) }))
    .filter((r) => r.ci.Carried && (r.item?.Charges ?? 0) > 0 && r.ci.ChargesUsed > 0);

  const markedConditions = sheet.Virtues
    .map((v) => ({ v, condition: library.conditions.find((c) => c.VirtueId === v.VirtueId) }))
    .filter((r) => r.v.ConditionMarked && r.condition);

  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) =>
    characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'them';

  /** Every spend decrements Hold in the same commit as its effect, so the two can't drift if a
   *  save fails partway — there is no path that applies the effect without the cost. */
  function spend(effect: (d: CharacterSheet) => void, confirmation: string) {
    commitSheet((d) => {
      d.Hold = Math.max(0, (d.Hold ?? 0) - 1);
      effect(d);
    });
    setMode(null);
    setNote(confirmation);
  }

  function refreshCharges(index: number, name: string) {
    spend((d) => { d.Items[index].ChargesUsed = 0; }, `Refreshed ${name}'s Charges.`);
  }

  function clearCondition(virtueId: string, name: string) {
    spend((d) => {
      const vv = d.Virtues.find((v) => v.VirtueId === virtueId);
      if (vv) vv.ConditionMarked = false;
    }, `Cleared ${name}.`);
  }

  function markPotential(index: number, name: string) {
    spend((d) => { addMotifPotential(d.Motifs[index], 1, library.settings.PotentialTrackLength); },
      `Marked Potential on ${name}.`);
  }

  function markBond(bondId: string, proposalNote: string) {
    // Cost and proposal together: the Hold is spent on making the offer.
    commitSheet((d) => { d.Hold = Math.max(0, (d.Hold ?? 0) - 1); });
    onPropose(bondId, 'MarkBond', proposalNote);
    setMarkingBond(null);
    setMode(null);
    setNote('Bond proposed — it applies once they accept.');
  }

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="spend-hold-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="spend-hold-title" className={modal.title}>Spend Hold</h2>
          <p className={modal.subtitle}>Each of these costs 1 Hold.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.holdRow}>
            <span className={styles.holdLabel}>Hold</span>
            <span className={styles.holdValue}>{hold}</span>
          </div>

          {!canSpend && <p className={styles.empty}>No Hold to spend. Assess the Situation and Discern the Truth grant it.</p>}

          <div className={`action-grid ${styles.buttonRow}`}>
            <button className={`tap-inline ${styles.choice} ${mode === 'charges' ? styles.choiceOn : ''}`} disabled={!canSpend} onClick={() => setMode('charges')}>Refresh Gear Charges</button>
            <button className={`tap-inline ${styles.choice} ${mode === 'condition' ? styles.choiceOn : ''}`} disabled={!canSpend} onClick={() => setMode('condition')}>Clear a Condition</button>
            {!archived && (
              <button className={`tap-inline ${styles.choice} ${mode === 'bond' ? styles.choiceOn : ''}`} disabled={!canSpend} onClick={() => setMode('bond')}>Mark a Bond</button>
            )}
            <button className={`tap-inline ${styles.choice} ${mode === 'potential' ? styles.choiceOn : ''}`} disabled={!canSpend} onClick={() => setMode('potential')}>Mark Potential</button>
          </div>

          {mode === 'charges' && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Which item?</div>
              {refreshable.length === 0 ? (
                <p className={styles.empty}>Nothing carried has spent Charges to refresh.</p>
              ) : (
                <div className={`action-grid ${styles.buttonRow}`}>
                  {refreshable.map((r) => (
                    <button key={r.index} className={`tap-inline ${styles.choice}`} onClick={() => refreshCharges(r.index, r.item!.Name)}>
                      {r.item!.Name} ({r.ci.ChargesUsed} used)
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'condition' && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Which Condition?</div>
              {markedConditions.length === 0 ? (
                <p className={styles.empty}>No Conditions are marked.</p>
              ) : (
                <div className={`action-grid ${styles.buttonRow}`}>
                  {markedConditions.map((r) => (
                    <button key={r.v.VirtueId} className={`tap-inline ${styles.choice}`} onClick={() => clearCondition(r.v.VirtueId, r.condition!.Name)}>
                      {r.condition!.Name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'bond' && !archived && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>With whom?</div>
              {myBonds.length === 0 ? (
                <p className={styles.empty}>No Bonds yet.</p>
              ) : (
                <>
                  <div className={`action-grid ${styles.buttonRow}`}>
                    {myBonds.map((b) => (
                      <button key={b.Id} className={`tap-inline ${styles.choice}`} onClick={() => setMarkingBond({ bondId: b.Id, partnerName: partnerName(b) })}>
                        {partnerName(b)}
                      </button>
                    ))}
                  </div>
                  <p className={styles.hint}>They still have to accept — spending Hold buys the offer, not the mark.</p>
                </>
              )}
            </div>
          )}

          {mode === 'potential' && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>On which Motif?</div>
              <div className={`action-grid ${styles.buttonRow}`}>
                {sheet.Motifs.map((m, i) => (
                  <button key={i} className={`tap-inline ${styles.choice}`} onClick={() => markPotential(i, m.Name || `Motif ${i + 1}`)}>
                    {m.Name || `Motif ${i + 1}`} ({m.Potential} / {library.settings.PotentialTrackLength})
                  </button>
                ))}
              </div>
            </div>
          )}

          {note && <p className={styles.confirmed}>{note}</p>}

          <button className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {markingBond && (
        <MarkBondModal
          partnerName={markingBond.partnerName}
          onClose={() => setMarkingBond(null)}
          onSubmit={(n: string) => markBond(markingBond.bondId, n)}
        />
      )}
    </div>
  );
}
