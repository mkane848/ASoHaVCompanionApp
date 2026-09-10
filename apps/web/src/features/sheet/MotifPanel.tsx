import { useState } from 'react';
import type { CharacterSheet, Improvement, Library, MotifAdvanceOption } from '@asohav/shared';
import { newId, nowIso, takeMotifAdvance } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { ImprovementTreePicker } from './ImprovementTreePicker.js';
import modal from '../../styles/modal.module.css';
import { TagList } from '../../components/TagList.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import styles from './MotifPanel.module.css';
import typography from '../../styles/typography.module.css';

const OPTION_LABELS: Record<MotifAdvanceOption, string> = {
  AddSkillTag: 'Add a Skill Tag',
  AddFlawTag: 'Add a Flaw Tag',
  RemoveFlawTag: 'Remove a Flaw Tag',
  GainImprovement: 'Gain an Improvement',
};

/** Three Motifs replace the single Theme (ruleset V0.5, slice 2). Each Motif is a self-contained
 *  bucket: a renameable name, its own Skill Tags and Flaw Tags, a 0–5 Potential track, a Quest,
 *  and three Act Breaks + three Forsakes. Rendered inside `BackgroundPanel`, below `LooksPanel`. */
export function MotifPanel({ sheet, library, commit }: { sheet: CharacterSheet; library: Library; commit: (m: (d: CharacterSheet) => void) => void }) {
  const [advancing, setAdvancing] = useState<number | null>(null);
  const [newTag, setNewTag] = useState('');
  const [pickingImprovement, setPickingImprovement] = useState(false);
  const cap = library.settings.PotentialTrackLength;

  const motifs = sheet.Motifs;

  function updateMotif(index: number, fn: (m: CharacterSheet['Motifs'][number]) => void) {
    commit((d) => fn(d.Motifs[index]));
  }

  /** V0.6 slice 4 (`WorkPlan-V0.6.md` Section A2): a full Potential track no longer advances the
   *  instant it fills — it advances "the next time you Make Camp." So a full track just sits
   *  full (`readyToAdvance` below renders a manual trigger) instead of auto-opening the picker
   *  the moment `setPotential` reaches `cap`, which is what this used to do and would read as
   *  advancing immediately, off-camera from any actual Camp. */
  function setPotential(index: number, n: number) {
    commit((d) => { d.Motifs[index].Potential = n; });
  }

  function applyAdvance(option: Exclude<MotifAdvanceOption, 'GainImprovement'>) {
    const idx = advancing!;
    const tag = newTag.trim();
    commit((d) => {
      const m = d.Motifs[idx];
      takeMotifAdvance(m);
      d.Level = (d.Level ?? 0) + 1;
      if (option === 'AddSkillTag' && tag) m.SkillTags.push(tag);
      if (option === 'AddFlawTag' && tag) m.FlawTags.push(tag);
      if (option === 'RemoveFlawTag') m.FlawTags.pop();
      d.Advancement.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'took',
        Name: OPTION_LABELS[option],
        Effect: m.Name,
      });
    });
    setNewTag('');
    setAdvancing(null);
  }

  /** "Gain a Hero Improvement" defers clearing the Motif's Potential until an Improvement is
   *  actually picked from `ImprovementTreePicker` — unlike the other three options, this one has
   *  a real cancel path (closing the tree browser), so nothing should be spent until it commits. */
  function applyGainImprovement(imp: Improvement) {
    const idx = advancing!;
    commit((d) => {
      const m = d.Motifs[idx];
      takeMotifAdvance(m);
      d.Level = (d.Level ?? 0) + 1;
      d.Improvements.push({ Id: imp.Id, Name: imp.Name, Effect: imp.Effect, TakenAt: nowIso() });
      d.Advancement.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'took',
        Name: imp.Name,
        Effect: `${OPTION_LABELS.GainImprovement} — ${m.Name}`,
      });
    });
    setPickingImprovement(false);
    setAdvancing(null);
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Motifs</div>
      <p className={styles.hint}>Three aspects of your Hero — each with its own Skills, Flaws, Potential, and a Quest.</p>

      <div className={`board ${styles.motifBoard}`}>
        {motifs.map((m, i) => (
          <div key={i} className={`posting ${styles.motif}`}>
            <div className={styles.motifHead}>
              <InlineEdit
                className={styles.nameInput}
                value={m.Name}
                placeholder="Name this Motif…"
                ariaLabel={`Motif ${i + 1} name`}
                onCommit={(next) => updateMotif(i, (mm) => { mm.Name = next; })}
              />
              <TrackStepper
                label="Potential"
                value={m.Potential}
                max={cap}
                color="var(--gold)"
                onSet={(n) => setPotential(i, n)}
              />
            </div>

            {m.Potential >= cap && (
              <button type="button" className={`tap-inline ${styles.readyBadge}`} onClick={() => setAdvancing(i)}>
                Potential full — Advance at your next Make Camp
              </button>
            )}

            <div className={styles.tagGroups}>
              <div className={styles.tagGroup}>
                <div className={typography.label}>Skill Tags <span className={styles.tagHint}>+1 when relevant</span></div>
                <TagList
                  items={m.SkillTags}
                  onChange={(next) => updateMotif(i, (mm) => { mm.SkillTags = next; })}
                  addLabel="+ Skill Tag"
                  placeholder="Write a tag…"
                  ariaPrefix={`Skill tag on Motif ${i + 1},`}
                />
              </div>

              <div className={styles.tagGroup}>
                <div className={typography.label}>Flaw Tags <span className={styles.tagHint}>−1 when relevant · mark Potential</span></div>
                <TagList
                  items={m.FlawTags}
                  onChange={(next) => updateMotif(i, (mm) => { mm.FlawTags = next; })}
                  addLabel="+ Flaw Tag"
                  placeholder="Write a tag…"
                  ariaPrefix={`Flaw tag on Motif ${i + 1},`}
                />
              </div>
            </div>

            <div className={styles.questBlock}>
              <div className={typography.label}>Quest</div>
              <input
                aria-label={`Quest on Motif ${i + 1}`}
                className={`tap-inline ${styles.questInput}`}
                defaultValue={m.Quest}
                placeholder="A short sentence…"
                onBlur={(e) => updateMotif(i, (mm) => { mm.Quest = e.target.value.trim(); })}
              />
              <div className={styles.tracksRow}>
                <TrackStepper
                  label="Act Breaks"
                  value={m.ActBreaks}
                  max={3}
                  color="var(--gold-dark)"
                  onSet={(n) => updateMotif(i, (mm) => { mm.ActBreaks = n as 0 | 1 | 2 | 3; })}
                />
                <TrackStepper
                  label="Forsakes"
                  value={m.Forsakes}
                  max={3}
                  color="var(--danger)"
                  onSet={(n) => updateMotif(i, (mm) => { mm.Forsakes = n as 0 | 1 | 2 | 3; })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {advancing !== null && (
        <MotifAdvanceModal
          motif={motifs[advancing]}
          newTag={newTag}
          onNewTag={setNewTag}
          onChoose={applyAdvance}
          onGainImprovement={() => setPickingImprovement(true)}
          onClose={() => setAdvancing(null)}
        />
      )}
      {advancing !== null && pickingImprovement && (
        <ImprovementTreePicker
          library={library}
          heldIds={new Set(sheet.Improvements.map((i) => i.Id))}
          onTake={applyGainImprovement}
          onClose={() => setPickingImprovement(false)}
        />
      )}
    </div>
  );
}

/** A compact counter for Potential (5), Act Breaks (3) and Forsakes (3). Deliberately does NOT
 *  use `Pips`: that component carries a 44px-tall absolute tap overlay (layout.css's `.pip::after`)
 *  built for the Status row, and stacking several of them in a dense Motif card would make their
 *  overlays bleed into the text fields above and into each other. Plain 44×44 buttons around
 *  read-only dots keep the tap targets real without any overlay geometry to collide. */
function TrackStepper({ label, value, max, color, onSet }: { label: string; value: number; max: number; color: string; onSet: (n: number) => void }) {
  return (
    <div className={styles.track}>
      <span className={styles.trackLabel}>{label}</span>
      <div className={styles.stepper}>
        <button type="button" className={styles.stepperBtn} disabled={value <= 0} aria-label={`${label}: decrease`} onClick={() => onSet(Math.max(0, value - 1))}>−</button>
        <div className={styles.stepperDots} aria-hidden="true">
          {Array.from({ length: max }, (_, i) => (
            <span key={i} className={i < value ? styles.dotOn : styles.dotOff} style={i < value ? { borderColor: color, background: color } : undefined} />
          ))}
        </div>
        <button type="button" className={styles.stepperBtn} disabled={value >= max} aria-label={`${label}: increase`} onClick={() => onSet(Math.min(max, value + 1))}>+</button>
      </div>
    </div>
  );
}

function MotifAdvanceModal({ motif, newTag, onNewTag, onChoose, onGainImprovement, onClose }: {
  motif: CharacterSheet['Motifs'][number];
  newTag: string;
  onNewTag: (v: string) => void;
  onChoose: (o: Exclude<MotifAdvanceOption, 'GainImprovement'>) => void;
  onGainImprovement: () => void;
  onClose: () => void;
}) {
  const removableFlaws = motif.FlawTags.length > 0;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="motif-advance-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className={modal.head}>
          <h2 id="motif-advance-title" className={modal.title}>Advance {motif.Name || 'this Motif'}</h2>
          <p className={modal.subtitle}>The Potential track is full. Clear it and choose one.</p>
        </div>
        <div className={modal.body}>
          {(['AddSkillTag', 'AddFlawTag'] as const).map((o) => (
            <div key={o} className={styles.advanceOption}>
              <input
                aria-label={`New ${o === 'AddSkillTag' ? 'Skill' : 'Flaw'} Tag`}
                className={`tap-inline ${styles.advanceInput}`}
                value={newTag}
                placeholder={`Type the new ${o === 'AddSkillTag' ? 'Skill' : 'Flaw'} Tag…`}
                onChange={(e) => onNewTag(e.target.value)}
              />
              <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!newTag.trim()} onClick={() => onChoose(o)}>
                {OPTION_LABELS[o]}
              </button>
            </div>
          ))}
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled={!removableFlaws} onClick={() => onChoose('RemoveFlawTag')}>
            {OPTION_LABELS.RemoveFlawTag} {removableFlaws ? `(removes "${motif.FlawTags[motif.FlawTags.length - 1]}")` : ''}
          </button>
          <button type="button" className={`tap-inline ${modal.secondaryAction}`} onClick={onGainImprovement}>
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
