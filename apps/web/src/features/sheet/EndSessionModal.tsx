import { useState } from 'react';
import type { Bond, Character, CharacterSheet, Library, Party } from '@asohav/shared';
import { addMotifPotential, rewriteMotifTag } from '@asohav/shared';
import { MarkBondModal } from '../../components/MarkBondModal.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './EndSessionModal.module.css';

type GrowthMode = 'bond' | 'tag' | 'potential';

/** End the Session (V0.6 slice 4 rewrite, `WorkPlan-V0.6.md` Section A2): mark 1 or 2 party
 *  Rapport depending on how many of the table's questions hit, then each player separately
 *  chooses ONE of three ways to grow — mark a Bond, rewrite a Skill or Flaw Tag, or mark
 *  Potential on a Motif whose Quest they progressed. This replaces the old per-player Hold
 *  economy entirely ("the per-player Hold economy is gone"); `CharacterSheet.Hold` itself
 *  survives untouched for the Moves that still grant it directly (Assess the Situation, Discern
 *  the Truth — see `MoveRollHelper.tsx`), this modal just no longer grants or spends it. A full
 *  Rapport track no longer auto-opens `PartyAdvanceModal` here either — see `AdvancementPanel.tsx`'s
 *  own "Ready to advance" trigger for the advance-at-next-Camp timing change. This app has no
 *  Playbook system at all — Playbooks aren't part of the game's systems, confirmed by the repo
 *  owner (see HANDOFF) — so it doesn't author or count the doc's example questions itself — the
 *  table answers them out loud and reports how many hit. `Party.Path` (slice 7) holds the doc's
 *  own unique "PARTY PATH" question as freeform text, but isn't yet surfaced here as its own
 *  listed question — see CLAUDE.md's "Architecture: Party Identity & Camp" section. */
export function EndSessionModal({
  sheet,
  library,
  bonds,
  characters,
  myCharacterId,
  commitSheet,
  commitParty,
  onPropose,
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
  onClose: () => void;
}) {
  const [partyDelta, setPartyDelta] = useState<number | null>(null);
  const [markingBond, setMarkingBond] = useState<{ bondId: string; partnerName: string } | null>(null);
  const [growthMode, setGrowthMode] = useState<GrowthMode | null>(null);
  const [growthApplied, setGrowthApplied] = useState(false);
  const [tagMotifIndex, setTagMotifIndex] = useState(0);
  const [tagCategory, setTagCategory] = useState<'Skill' | 'Flaw'>('Skill');
  const [tagExistingIndex, setTagExistingIndex] = useState<number | null>(null);
  const [tagText, setTagText] = useState('');
  const [potentialMotifIndex, setPotentialMotifIndex] = useState(0);

  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const partnerName = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'them';
  const existingTags = tagCategory === 'Skill' ? sheet.Motifs[tagMotifIndex]?.SkillTags ?? [] : sheet.Motifs[tagMotifIndex]?.FlawTags ?? [];

  function markParty(n: 0 | 1 | 2) {
    setPartyDelta(n);
    if (n === 0) return;
    commitParty((d) => {
      d.Rapport = Math.min(library.settings.RapportTrackLength, d.Rapport + n);
    });
  }

  function applyGrowBond(bondId: string, note: string) {
    onPropose(bondId, 'MarkBond', note);
    setMarkingBond(null);
    setGrowthApplied(true);
  }

  function applyRewriteTag() {
    commitSheet((d) => { rewriteMotifTag(d.Motifs[tagMotifIndex], tagCategory, tagExistingIndex, tagText); });
    setGrowthApplied(true);
  }

  function applyGrowPotential() {
    commitSheet((d) => { addMotifPotential(d.Motifs[potentialMotifIndex], 1, library.settings.PotentialTrackLength); });
    setGrowthApplied(true);
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
          <p className={modal.subtitle}>Mark Rapport for the party, then each player chooses one way to grow.</p>
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
            <div className={styles.sectionLabel}>You: choose one way to grow</div>
            {growthApplied ? (
              <p className={styles.confirmed}>Growth chosen for this session.</p>
            ) : (
              <>
                <div className={`action-grid ${styles.buttonRow}`}>
                  <button className={`tap-inline ${styles.choice} ${growthMode === 'bond' ? styles.choiceOn : ''}`} onClick={() => setGrowthMode('bond')}>Grow closer with a Hero</button>
                  <button className={`tap-inline ${styles.choice} ${growthMode === 'tag' ? styles.choiceOn : ''}`} onClick={() => setGrowthMode('tag')}>Grow into your changes</button>
                  <button className={`tap-inline ${styles.choice} ${growthMode === 'potential' ? styles.choiceOn : ''}`} onClick={() => setGrowthMode('potential')}>Grow toward your goal</button>
                </div>

                {growthMode === 'bond' && (
                  <div className={styles.spendGroup}>
                    <div className={styles.spendLabel}>Mark a Bond with a party member</div>
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
                )}

                {growthMode === 'tag' && (
                  <div className={styles.spendGroup}>
                    <div className={styles.spendLabel}>Rewrite or update a Skill or Flaw Tag</div>
                    <div className={`tap-row ${styles.holdInputRow}`}>
                      <select className={`tap-inline ${styles.select}`} value={tagMotifIndex} onChange={(e) => { setTagMotifIndex(Number(e.target.value)); setTagExistingIndex(null); }}>
                        {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
                      </select>
                      <select className={`tap-inline ${styles.select}`} value={tagCategory} onChange={(e) => { setTagCategory(e.target.value as 'Skill' | 'Flaw'); setTagExistingIndex(null); }}>
                        <option value="Skill">Skill Tag</option>
                        <option value="Flaw">Flaw Tag</option>
                      </select>
                    </div>
                    <div className={`tap-row ${styles.holdInputRow}`}>
                      <select className={`tap-inline ${styles.select}`} value={tagExistingIndex ?? ''} onChange={(e) => setTagExistingIndex(e.target.value === '' ? null : Number(e.target.value))}>
                        <option value="">Add a new tag</option>
                        {existingTags.map((t, i) => <option key={i} value={i}>Replace “{t}”</option>)}
                      </select>
                    </div>
                    <div className={`tap-row ${styles.holdInputRow}`}>
                      <input className={`tap-inline ${styles.textInput}`} placeholder="New tag text…" value={tagText} onChange={(e) => setTagText(e.target.value)} />
                      <button className={`tap-inline ${modal.primaryAction}`} disabled={!tagText.trim()} onClick={applyRewriteTag}>Apply</button>
                    </div>
                  </div>
                )}

                {growthMode === 'potential' && (
                  <div className={styles.spendGroup}>
                    <div className={styles.spendLabel}>Mark Potential on a Motif whose Quest you progressed</div>
                    <div className={`tap-row ${styles.holdInputRow}`}>
                      <select className={`tap-inline ${styles.select}`} value={potentialMotifIndex} onChange={(e) => setPotentialMotifIndex(Number(e.target.value))}>
                        {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
                      </select>
                      <button className={`tap-inline ${modal.primaryAction}`} onClick={applyGrowPotential}>Mark Potential</button>
                    </div>
                  </div>
                )}
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
          onSubmit={(note: string) => applyGrowBond(markingBond.bondId, note)}
        />
      )}
    </div>
  );
}
