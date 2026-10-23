import { lazy, Suspense, useState } from 'react';
import type { CharacterSheet, Improvement, Library, MotifAdvanceOption } from '@asohav/shared';
import { applyMotifAdvanceBonus, newId, nowIso, raisableVirtues, rewriteMotifTag, takeMotifAdvance } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { Field } from '../../components/form/Field.js';
import { Select } from '../../components/form/Select.js';
import modal from '../../styles/modal.module.css';
import styles from './MotifPanel.module.css';
import type { SheetCommit } from './Panel.js';
import { backdropClose } from '../../lib/backdropClose.js';

const ImprovementTreePicker = lazy(() => import('./ImprovementTreePicker.js').then((m) => ({ default: m.ImprovementTreePicker })));
const TagRewriteModal = lazy(() => import('./TagRewriteModal.js').then((m) => ({ default: m.TagRewriteModal })));

const OPTION_LABELS: Record<MotifAdvanceOption, string> = {
  AddSkillTag: 'Add a Skill Tag',
  AddFlawTag: 'Add a Flaw Tag',
  RemoveFlawTag: 'Remove a Flaw Tag',
  GainImprovement: 'Gain an Improvement',
};

/** Advance a Hero Motif (V0.7, "Advance a Hero Motif", `Ruleset-V0.7.md` L2105-2114) — a step of the
 *  per-Hero Make Camp dialog (`MakeCampModal`), not something the Motif panel opens on its own (owner
 *  rulings D4/D7, 2026-10-22: "Motif advance stays per Hero").
 *
 *  **Always** — pick one: add a Skill Tag, add or remove a Flaw Tag, or gain a Hero Improvement (the
 *  same four options a full Potential track has always offered). **Then** — both, every time: add 1 to
 *  a Virtue (max 3) and permanently gain a Strain box. The owner approved building the Then half on
 *  2026-10-22; `applyMotifAdvanceBonus()` is the only place a sheet's Virtue score changes after
 *  character creation, so no stepper belongs on `VirtuesPanel`. The Potential track clears, the
 *  Always choice and the Then grants land in one `commit`, and an Advancement History entry records
 *  each. Afterwards the Hero may rewrite one of the Motif's tags ("Then you may…", the V0.6 step this
 *  flow always had). Closing the first dialog before choosing spends nothing. */
export function MotifAdvanceFlow({
  sheet,
  library,
  motifIndex,
  commit,
  onClose,
}: {
  sheet: CharacterSheet;
  library: Library;
  motifIndex: number;
  commit: SheetCommit;
  /** The whole flow is over — a choice was made (and the optional tag rewrite finished or skipped), or the Hero backed out. */
  onClose: () => void;
}) {
  const motif = sheet.Motifs[motifIndex];
  const eligible = raisableVirtues(sheet);
  const [stage, setStage] = useState<'choose' | 'rewrite'>('choose');
  const [newTag, setNewTag] = useState('');
  const [virtueId, setVirtueId] = useState(eligible[0]?.VirtueId ?? '');
  const [pickingImprovement, setPickingImprovement] = useState(false);

  /** Applies the Always choice's own change to the Motif, then the Then grants, then clears Potential. */
  function applyAdvance(d: CharacterSheet, mutate: (m: CharacterSheet['Motifs'][number]) => void, name: string, effect: string) {
    const m = d.Motifs[motifIndex];
    takeMotifAdvance(m);
    mutate(m);
    d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: name, Effect: effect });
    const bonus = applyMotifAdvanceBonus(d, eligible.length > 0 ? virtueId : null);
    if (bonus.VirtueId) {
      const virtueName = library.virtues.find((v) => v.Id === bonus.VirtueId)?.Name ?? bonus.VirtueId;
      d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: 'Raise a Virtue by 1', Effect: `${virtueName} ${bonus.VirtueScore} — ${m.Name}` });
    }
    d.Advancement.History.unshift({ Id: newId('h'), At: nowIso(), Action: 'took', Name: 'Permanent Strain box', Effect: `${bonus.StrainBoxes} earned — ${m.Name}` });
  }

  function chooseTagOption(option: Exclude<MotifAdvanceOption, 'GainImprovement'>) {
    const tag = newTag.trim();
    commit((d) => {
      applyAdvance(
        d,
        (m) => {
          if (option === 'AddSkillTag' && tag) m.SkillTags.push(tag);
          if (option === 'AddFlawTag' && tag) m.FlawTags.push(tag);
          if (option === 'RemoveFlawTag') m.FlawTags.pop();
        },
        OPTION_LABELS[option],
        motif.Name,
      );
    });
    afterAdvance(option, tag);
  }

  /** "Gain a Hero Improvement" defers the whole advance until an Improvement is actually picked from
   *  `ImprovementTreePicker`, which has a real cancel path — nothing is spent, no Virtue raised, until it commits. */
  function chooseImprovement(imp: Improvement) {
    commit((d) => {
      applyAdvance(d, () => { d.Improvements.push({ Id: imp.Id, Name: imp.Name, Effect: imp.Effect, TakenAt: nowIso() }); }, imp.Name, `${OPTION_LABELS.GainImprovement} — ${motif.Name}`);
    });
    setPickingImprovement(false);
    afterAdvance('GainImprovement', '');
  }

  function afterAdvance(option: MotifAdvanceOption, tag: string) {
    let skillCount = motif.SkillTags.length;
    let flawCount = motif.FlawTags.length;
    if (option === 'AddSkillTag' && tag) skillCount += 1;
    if (option === 'AddFlawTag' && tag) flawCount += 1;
    if (option === 'RemoveFlawTag') flawCount = Math.max(0, flawCount - 1);
    if (skillCount > 0 || flawCount > 0) setStage('rewrite');
    else onClose();
  }

  if (stage === 'rewrite') {
    return (
      <Suspense fallback={null}>
        <TagRewriteModal
          motif={motif}
          onClose={onClose}
          onRewrite={(kind, index, text) => {
            commit((d) => { rewriteMotifTag(d.Motifs[motifIndex], kind, index, text); });
            onClose();
          }}
        />
      </Suspense>
    );
  }

  return (
    <>
      <MotifAdvanceModal
        motif={motif}
        library={library}
        eligible={eligible}
        virtueId={virtueId}
        onVirtue={setVirtueId}
        strainBoxes={sheet.StrainBoxBonus ?? 0}
        newTag={newTag}
        onNewTag={setNewTag}
        onChoose={chooseTagOption}
        onGainImprovement={() => setPickingImprovement(true)}
        onClose={onClose}
      />
      <Suspense fallback={null}>
        {pickingImprovement && (
          <ImprovementTreePicker
            library={library}
            heldIds={new Set(sheet.Improvements.map((i) => i.Id))}
            onTake={chooseImprovement}
            onClose={() => setPickingImprovement(false)}
          />
        )}
      </Suspense>
    </>
  );
}

function MotifAdvanceModal({ motif, library, eligible, virtueId, onVirtue, strainBoxes, newTag, onNewTag, onChoose, onGainImprovement, onClose }: {
  motif: CharacterSheet['Motifs'][number];
  library: Library;
  eligible: CharacterSheet['Virtues'];
  virtueId: string;
  onVirtue: (id: string) => void;
  strainBoxes: number;
  newTag: string;
  onNewTag: (v: string) => void;
  onChoose: (o: Exclude<MotifAdvanceOption, 'GainImprovement'>) => void;
  onGainImprovement: () => void;
  onClose: () => void;
}) {
  const removableFlaws = motif.FlawTags.length > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  // Choosing the Virtue is part of the advance: while one can still be raised, the Always buttons wait for it.
  const needsVirtue = eligible.length > 0 && !eligible.some((v) => v.VirtueId === virtueId);

  return (
    <div className={modal.backdrop} {...backdropClose(onClose)}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="motif-advance-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 id="motif-advance-title" className={modal.title}>Advance {motif.Name || 'this Motif'}</h2>
          <p className={modal.subtitle}>The Potential track is full. Clear it, choose one of these, and take what follows.</p>
        </div>
        <div className={modal.body}>
          <div className={styles.thenBlock}>
            <div className={styles.thenHeading}>Then — you also gain</div>
            {eligible.length > 0 ? (
              <Field label="Add 1 to a Virtue (max 3)" htmlFor="motif-advance-virtue">
                <Select id="motif-advance-virtue" value={virtueId} onChange={(e) => onVirtue(e.target.value)}>
                  {eligible.map((v) => (
                    <option key={v.VirtueId} value={v.VirtueId}>
                      {library.virtues.find((x) => x.Id === v.VirtueId)?.Name ?? v.VirtueId} ({v.Score} → {v.Score + 1})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className={styles.thenNote}>Every Virtue is already at 3, so there is none to raise.</p>
            )}
            <p className={styles.thenNote}>Permanently gain a Strain box (you will have {strainBoxes + 1} extra).</p>
          </div>

          <div className={styles.thenHeading}>Always — choose one</div>
          {(['AddSkillTag', 'AddFlawTag'] as const).map((o) => (
            <div key={o} className={styles.advanceOption}>
              <input
                aria-label={`New ${o === 'AddSkillTag' ? 'Skill' : 'Flaw'} Tag`}
                className={`tap-inline ${styles.advanceInput}`}
                value={newTag}
                placeholder={`Type the new ${o === 'AddSkillTag' ? 'Skill' : 'Flaw'} Tag…`}
                onChange={(e) => onNewTag(e.target.value)}
              />
              <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!newTag.trim() || needsVirtue} onClick={() => onChoose(o)}>
                {OPTION_LABELS[o]}
              </button>
            </div>
          ))}
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled={!removableFlaws || needsVirtue} onClick={() => onChoose('RemoveFlawTag')}>
            {OPTION_LABELS.RemoveFlawTag} {removableFlaws ? `(removes "${motif.FlawTags[motif.FlawTags.length - 1]}")` : ''}
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled={needsVirtue} onClick={onGainImprovement}>
            {OPTION_LABELS.GainImprovement}
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet — keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}
