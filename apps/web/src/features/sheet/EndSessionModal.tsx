import { useState } from 'react';
import type { Bond, Character, CharacterSheet, Library, Party } from '@asohav/shared';
import { addMotifPotential } from '@asohav/shared';
import type { PickerState } from './pickerTypes.js';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './EndSessionModal.module.css';

/** End the Session: mark 1 or 2 party Rapport depending on how many of the table's questions hit,
 *  then each player separately answers their own questions for Hold, spent 1-for-1 on refreshing
 *  Gear, clearing a Condition, marking Kin, or marking Potential. This app has no Playbook system
 *  yet (see HANDOFF), so it doesn't author or count the doc's example questions itself — the table
 *  answers them out loud and reports how many hit. Hold is persisted on the sheet (`Hold`) rather
 *  than resolved in one sitting, so a player can come back and spend it later. */
export function EndSessionModal({
  sheet,
  library,
  bonds,
  characters,
  myCharacterId,
  commitSheet,
  commitParty,
  onPropose,
  openPicker,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onPropose: (bondId: string, type: 'MarkBond' | 'SpendBond', note?: string) => void;
  openPicker: (p: PickerState) => void;
  onClose: () => void;
}) {
  const [partyDelta, setPartyDelta] = useState<number | null>(null);
  const [personalHits, setPersonalHits] = useState(0);
  const [personalGranted, setPersonalGranted] = useState(false);
  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);

  const hold = sheet.Hold ?? 0;
  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'them';
  const markedConditions = sheet.Virtues
    .filter((v) => v.ConditionMarked)
    .map((v) => ({ virtueId: v.VirtueId, name: library.conditions.find((c) => c.VirtueId === v.VirtueId)?.Name ?? v.VirtueId }));
  const usedItems = sheet.Items
    .map((ci) => ({ ci, item: library.items.find((i) => i.Id === ci.ItemId) }))
    .filter((x): x is { ci: typeof sheet.Items[number]; item: NonNullable<typeof x.item> } => !!x.item && (x.item.Charges ?? 0) > 0 && x.ci.ChargesUsed > 0);

  function markParty(n: 0 | 1 | 2) {
    setPartyDelta(n);
    if (n === 0) return;
    commitParty((d) => {
      const next = Math.min(library.settings.RapportTrackLength, d.Rapport + n);
      d.Rapport = next;
      if (next >= library.settings.RapportTrackLength) openPicker({ kind: 'advancement', track: 'Rapport' });
    });
  }

  function grantHold() {
    if (personalHits <= 0) { setPersonalGranted(true); return; }
    commitSheet((d) => { d.Hold = (d.Hold ?? 0) + personalHits; });
    setPersonalGranted(true);
  }

  function spendHold(mutate: (d: CharacterSheet) => void) {
    commitSheet((d) => {
      mutate(d);
      d.Hold = Math.max(0, (d.Hold ?? 0) - 1);
    });
  }

  function refreshItem(itemId: string) {
    spendHold((d) => {
      const ci = d.Items.find((x) => x.ItemId === itemId);
      if (ci) ci.ChargesUsed = 0;
    });
  }

  function clearCondition(virtueId: string) {
    spendHold((d) => {
      const v = d.Virtues.find((x) => x.VirtueId === virtueId);
      if (v) v.ConditionMarked = false;
    });
  }

  function markPotential(index: number) {
    spendHold((d) => {
      addMotifPotential(d.Motifs[index], 1, library.settings.PotentialTrackLength);
    });
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={`${modal.dialog} ${styles.dialog}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-session-title"
        tabIndex={-1}
      >
        <div className={modal.head}>
          <h2 id="end-session-title" className={modal.title}>End the Session</h2>
          <p className={modal.subtitle}>Mark Rapport for the party, then answer your own questions for Hold.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>As a table: how many questions got a "yes"?</div>
            <div className={`action-grid ${styles.buttonRow}`}>
              <button className={`tap-inline ${styles.choice} ${partyDelta === 0 ? styles.choiceOn : ''}`} disabled={partyDelta !== null} onClick={() => markParty(0)}>None</button>
              <button className={`tap-inline ${styles.choice} ${partyDelta === 1 ? styles.choiceOn : ''}`} disabled={partyDelta !== null} onClick={() => markParty(1)}>1–2 (+1 Rapport)</button>
              <button className={`tap-inline ${styles.choice} ${partyDelta === 2 ? styles.choiceOn : ''}`} disabled={partyDelta !== null} onClick={() => markParty(2)}>3+ (+2 Rapport)</button>
            </div>
            {partyDelta !== null && <p className={styles.confirmed}>{partyDelta === 0 ? 'No Rapport marked this session.' : `Marked +${partyDelta} Rapport for the party.`}</p>}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>You: how many of your own questions got a "yes"?</div>
            {personalGranted ? (
              <p className={styles.confirmed}>{personalHits > 0 ? `Granted ${personalHits} Hold.` : 'No Hold granted this session.'}</p>
            ) : (
              <div className={`tap-row ${styles.holdInputRow}`}>
                <input
                  className={styles.number}
                  type="number"
                  min={0}
                  value={personalHits}
                  onChange={(e) => setPersonalHits(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
                <button className={`tap-inline ${modal.primaryAction} ${styles.grantButton}`} onClick={grantHold}>Grant Hold</button>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Spend your Hold — {hold} available</div>
            {hold === 0 ? (
              <p className={styles.empty}>Nothing to spend yet.</p>
            ) : (
              <>
                <div className={styles.spendGroup}>
                  <div className={styles.spendLabel}>Refresh a piece of Gear</div>
                  {usedItems.length === 0 ? (
                    <p className={styles.empty}>No used Gear charges to refresh.</p>
                  ) : (
                    <div className={`action-grid ${styles.buttonRow}`}>
                      {usedItems.map(({ ci, item }) => (
                        <button key={ci.ItemId} className={`tap-inline ${styles.spendChoice}`} onClick={() => refreshItem(ci.ItemId)}>{item.Name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.spendGroup}>
                  <div className={styles.spendLabel}>Clear a Condition</div>
                  {markedConditions.length === 0 ? (
                    <p className={styles.empty}>No Conditions marked.</p>
                  ) : (
                    <div className={`action-grid ${styles.buttonRow}`}>
                      {markedConditions.map((c) => (
                        <button key={c.virtueId} className={`tap-inline ${styles.spendChoice}`} onClick={() => clearCondition(c.virtueId)}>{c.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.spendGroup}>
                  <div className={styles.spendLabel}>Mark Bond with a party member</div>
                  {myBonds.length === 0 ? (
                    <p className={styles.empty}>No Bonds yet.</p>
                  ) : (
                    <div className={`action-grid ${styles.buttonRow}`}>
                      {myBonds.map((b) => (
                        <button key={b.Id} className={`tap-inline ${styles.spendChoice}`} onClick={() => setMarkingBond({ bondId: b.Id, partnerName: partnerName(b) })}>{partnerName(b)}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.spendGroup}>
                  <div className={styles.spendLabel}>Mark Potential on a Motif</div>
                  <div className={`action-grid ${styles.buttonRow}`}>
                    {sheet.Motifs.map((m, i) => (
                      <button key={i} className={`tap-inline ${styles.spendChoice}`} onClick={() => markPotential(i)}>
                        {m.Name || `Motif ${i + 1}`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {markingBond && (
        <MarkBondModal
          partnerName={markingBond.partnerName}
          onClose={() => setMarkingBond(null)}
          onSubmit={(note: string) => {
            onPropose(markingBond.bondId, 'MarkBond', note);
            spendHold(() => {});
            setMarkingBond(null);
          }}
        />
      )}
    </div>
  );
}
