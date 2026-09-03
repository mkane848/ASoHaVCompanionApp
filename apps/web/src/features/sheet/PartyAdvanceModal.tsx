import { useState } from 'react';
import type { Party, PartyAdvanceOption } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './PartyAdvanceModal.module.css';

const PARTY_OPTION_LABELS: Record<PartyAdvanceOption, string> = {
  AddSkillTag: 'Add a Skill Tag',
  AddWeaknessTag: 'Add a Weakness Tag',
  RemoveWeaknessTag: 'Remove a Weakness Tag',
};

/** Shared with `EndSessionModal.tsx` — Rapport can fill from either place (Aid spending, the
 *  End-the-Session table question), and both need the same "clear it, choose one" dialog. Split
 *  into its own file and lazy-loaded from both (a rarely-triggered modal, only shown when a
 *  full Rapport track needs clearing) — see `CharacterSheetPage.tsx`'s bundle-budget note. */
export function PartyAdvanceModal({ party, onChoose, onClose }: { party: Party; onChoose: (o: PartyAdvanceOption, tag?: string) => void; onClose: () => void }) {
  const [newTag, setNewTag] = useState('');
  const removableWeaknesses = party.WeaknessTags.length > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="party-advance-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 id="party-advance-title" className={modal.title}>Progress the Party</h2>
          <p className={modal.subtitle}>The Rapport track is full. Clear it and choose one.</p>
        </div>
        <div className={modal.body}>
          {(['AddSkillTag', 'AddWeaknessTag'] as const).map((o) => (
            <div key={o} className={styles.advanceOption}>
              <input
                aria-label={`New ${o === 'AddSkillTag' ? 'Skill' : 'Weakness'} Tag`}
                className={`tap-inline ${styles.advanceInput}`}
                value={newTag}
                placeholder={`Type the new ${o === 'AddSkillTag' ? 'Skill' : 'Weakness'} Tag…`}
                onChange={(e) => setNewTag(e.target.value)}
              />
              <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!newTag.trim()} onClick={() => onChoose(o, newTag)}>
                {PARTY_OPTION_LABELS[o]}
              </button>
            </div>
          ))}
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled={!removableWeaknesses} onClick={() => onChoose('RemoveWeaknessTag')}>
            {PARTY_OPTION_LABELS.RemoveWeaknessTag} {removableWeaknesses ? `(removes "${party.WeaknessTags[party.WeaknessTags.length - 1]}")` : ''}
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled title="No Party Improvement trees are authored yet — Ruleset-V0.5.md names no Party Improvement content at all.">
            Gain a Party Improvement (not available yet)
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet — keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}
