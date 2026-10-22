import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Bond, Character, CharacterSheet, Library, Party } from '@asohav/shared';
import { applyPartyRapportAdvance, readyCampAdvances } from '@asohav/shared';
import { ForgeBondModal } from '../campaign/ForgeBondModal.js';
import { MotifAdvanceFlow } from './MotifAdvanceFlow.js';
import type { PartyAdvanceChoice } from './PartyAdvanceModal.js';
import type { SheetCommit } from './Panel.js';
import styles from './CampAdvanceSteps.module.css';

// Lazy: it opens only from a full Rapport track at Make Camp (see CharacterSheetPage.tsx's bundle-budget note).
const PartyAdvanceModal = lazy(() => import('./PartyAdvanceModal.js').then((m) => ({ default: m.PartyAdvanceModal })));

/** Everything the advance steps of Make Camp need that the sheet panel itself doesn't hold. */
export interface CampAdvanceContext {
  library: Library;
  party: Party | null;
  commitParty?: (m: (d: Party) => void) => void;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  onProposeBond: (bondId: string, type: string, payload: Record<string, unknown>, note?: string) => void;
  /** An archived campaign is frozen, so a Forge cannot be proposed. */
  archived?: boolean;
}

type Active = { kind: 'motif'; index: number } | { kind: 'party' } | { kind: 'bond'; id: string } | null;

/** The advance steps of the per-Hero Make Camp dialog (V0.7; owner rulings D4/D7, 2026-10-22): "Motif,
 *  Party and Bond advances are offered only inside the Make Camp flow", "STEPS INSIDE the existing
 *  per-Hero Make Camp modal, shown only when the relevant track is full". Motif advance stays per Hero;
 *  there is no Party-level Make Camp, so the Party and each full Bond are offered here to whichever Hero
 *  is camping. Which are ready is `readyCampAdvances()`; each step opens the dialog it always had (Motif
 *  advance, Progress the Party, Forge a Bond) on top of this one. Renders nothing when no track is full.
 *
 *  A Party advance clears Rapport and applies at once (`applyPartyRapportAdvance`); a Forge is a proposal
 *  the partner must accept, as it always was, and the Bond track clears when they do. */
export function CampAdvanceSteps({
  sheet,
  commitSheet,
  ctx,
}: {
  sheet: CharacterSheet;
  commitSheet: SheetCommit;
  ctx: CampAdvanceContext;
}) {
  const [active, setActive] = useState<Active>(null);
  const { library, party, bonds, characters, myCharacterId } = ctx;
  const ready = readyCampAdvances(sheet, party, bonds, myCharacterId, library.settings);
  const readyBonds = ctx.archived ? [] : bonds.filter((b) => ready.Bonds.includes(b.Id));
  const partnerOf = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'your partner';
  const partyReady = ready.Party && !!ctx.commitParty;

  if (ready.Motifs.length === 0 && !partyReady && readyBonds.length === 0 && active === null) return null;

  function applyPartyAdvance({ option, tag, improvement, rewrite }: PartyAdvanceChoice) {
    ctx.commitParty?.((d) => {
      applyPartyRapportAdvance(d, option, tag, improvement);
      if (rewrite) {
        const tags = rewrite.kind === 'Skill' ? d.SkillTags : d.FlawTags;
        const at = tags.indexOf(rewrite.from);
        if (at >= 0) tags[at] = rewrite.to;
      }
    });
    setActive(null);
  }

  const forging = active?.kind === 'bond' ? bonds.find((b) => b.Id === active.id) : undefined;

  return (
    <div className={styles.steps}>
      <div className={styles.label} id="camp-advance-label">Ready to advance</div>
      <p className={styles.hint}>A full track is spent here, at Camp. Each opens its own dialog; you can come back for the others.</p>
      <div className={styles.list} role="group" aria-labelledby="camp-advance-label">
        {ready.Motifs.map((i) => (
          <button key={`m${i}`} type="button" className={`tap ${styles.step}`} onClick={() => setActive({ kind: 'motif', index: i })}>
            Advance {sheet.Motifs[i].Name || `Motif ${i + 1}`}
          </button>
        ))}
        {partyReady && (
          <button type="button" className={`tap ${styles.step}`} onClick={() => setActive({ kind: 'party' })}>
            Progress the Party
          </button>
        )}
        {readyBonds.map((b) => (
          <button key={b.Id} type="button" className={`tap ${styles.step}`} onClick={() => setActive({ kind: 'bond', id: b.Id })}>
            Forge a Bond with {partnerOf(b)}
          </button>
        ))}
      </div>

      {/* Portalled to <body>: these are full-screen dialogs and must not sit inside Make Camp's own dialog box. */}
      {active &&
        createPortal(
          <>
            {active.kind === 'motif' && (
              <MotifAdvanceFlow sheet={sheet} library={library} motifIndex={active.index} commit={commitSheet} onClose={() => setActive(null)} />
            )}
            {active.kind === 'party' && party && (
              <Suspense fallback={null}>
                <PartyAdvanceModal party={party} library={library} onChoose={applyPartyAdvance} onClose={() => setActive(null)} />
              </Suspense>
            )}
            {forging && (
              <ForgeBondModal
                partnerName={partnerOf(forging)}
                currentTag={forging.ConnectionTag}
                onClose={() => setActive(null)}
                onSubmit={(improvement, newTag) => {
                  ctx.onProposeBond(forging.Id, 'ForgeBond', newTag ? { Text: improvement, ConnectionTag: newTag } : { Text: improvement }, "Let's forge it.");
                  setActive(null);
                }}
              />
            )}
          </>,
          document.body,
        )}
    </div>
  );
}
