import { useState } from 'react';
import type { CharacterSheet, Library, MotifAdvanceOption } from '@asohav/shared';
import { newId, nowIso, takeMotifAdvance } from '@asohav/shared';
import { Pips } from './Pips.js';
import { useModalA11y } from '../../lib/useModalA11y.js';
import modal from '../../styles/modal.module.css';
import styles from './MotifPanel.module.css';

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
  const cap = library.settings.PotentialTrackLength;

  const motifs = sheet.Motifs;

  function updateMotif(index: number, fn: (m: CharacterSheet['Motifs'][number]) => void) {
    commit((d) => fn(d.Motifs[index]));
  }

  function setPotential(index: number, n: number) {
    commit((d) => { d.Motifs[index].Potential = n; });
    if (n >= cap) setAdvancing(index);
  }

  function applyAdvance(option: MotifAdvanceOption) {
    const idx = advancing!;
    const tag = newTag.trim();
    commit((d) => {
      const m = d.Motifs[idx];
      takeMotifAdvance(m);
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

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Motifs</div>
      <p className={styles.hint}>Three aspects of your Hero — each with its own Skills, Flaws, Potential, and a Quest.</p>

      {motifs.map((m, i) => (
        <div key={i} className={`board ${styles.motif}`}>
          <div className={styles.motifHead}>
            <input
              aria-label={`Motif ${i + 1} name`}
              className={`tap-inline ${styles.nameInput}`}
              defaultValue={m.Name}
              placeholder="Name this Motif…"
              onBlur={(e) => updateMotif(i, (mm) => { mm.Name = e.target.value.trim(); })}
            />
            <Pips count={cap} filled={m.Potential} color="var(--gold)" onSet={(n) => setPotential(i, n)} />
          </div>

          <div className={styles.tagGroup}>
            <div className={styles.tagLabel}>Skill Tags <span className={styles.tagHint}>+1 when relevant</span></div>
            {m.SkillTags.map((tag, ti) => (
              <TagInput key={`s-${ti}`} value={tag} aria={`Skill tag ${ti + 1} on Motif ${i + 1}`}
                onBlur={(v) => updateMotif(i, (mm) => { mm.SkillTags[ti] = v; })}
                onRemove={() => updateMotif(i, (mm) => { mm.SkillTags.splice(ti, 1); })} />
            ))}
            <button type="button" className={`tap-inline ${styles.addTag}`} onClick={() => updateMotif(i, (mm) => { mm.SkillTags.push(''); })}>+ Skill Tag</button>
          </div>

          <div className={styles.tagGroup}>
            <div className={styles.tagLabel}>Flaw Tags <span className={styles.tagHint}>−1 when relevant · mark Potential</span></div>
            {m.FlawTags.map((tag, ti) => (
              <TagInput key={`f-${ti}`} value={tag} aria={`Flaw tag ${ti + 1} on Motif ${i + 1}`}
                onBlur={(v) => updateMotif(i, (mm) => { mm.FlawTags[ti] = v; })}
                onRemove={() => updateMotif(i, (mm) => { mm.FlawTags.splice(ti, 1); })} />
            ))}
            <button type="button" className={`tap-inline ${styles.addTag}`} onClick={() => updateMotif(i, (mm) => { mm.FlawTags.push(''); })}>+ Flaw Tag</button>
          </div>

          <div className={styles.questBlock}>
            <div className={styles.tagLabel}>Quest</div>
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
                color="var(--gold-dark)"
                onSet={(n) => updateMotif(i, (mm) => { mm.ActBreaks = n as 0 | 1 | 2 | 3; })}
              />
              <TrackStepper
                label="Forsakes"
                value={m.Forsakes}
                color="var(--danger)"
                onSet={(n) => updateMotif(i, (mm) => { mm.Forsakes = n as 0 | 1 | 2 | 3; })}
              />
            </div>
          </div>
        </div>
      ))}

      {advancing !== null && (
        <MotifAdvanceModal
          motif={motifs[advancing]}
          newTag={newTag}
          onNewTag={setNewTag}
          onChoose={applyAdvance}
          onClose={() => setAdvancing(null)}
        />
      )}
    </div>
  );
}

function TagInput({ value, aria, onBlur, onRemove }: { value: string; aria: string; onBlur: (v: string) => void; onRemove: () => void }) {
  return (
    <div className={styles.tagRow}>
      <input
        aria-label={aria}
        className={`tap-inline ${styles.tagInput}`}
        defaultValue={value}
        placeholder="Write a tag…"
        onBlur={(e) => onBlur(e.target.value.trim())}
      />
      <button type="button" className={`tap-inline ${styles.removeTag}`} onClick={onRemove} aria-label={`Remove ${value || 'tag'}`}>&times;</button>
    </div>
  );
}

/** A compact 0–3 counter for Act Breaks and Forsakes. Deliberately does NOT use `Pips`: that
 *  component carries a 44px-tall absolute tap overlay (layout.css's `.pip::after`) built for the
 *  Status row, and stacking two of them in a dense Motif card would make their overlays bleed into
 *  the Quest input above and into each other. Plain 44×44 buttons around three read-only dots keep
 *  the tap targets real without any overlay geometry to collide. */
function TrackStepper({ label, value, color, onSet }: { label: string; value: number; color: string; onSet: (n: number) => void }) {
  const max = 3;
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

function MotifAdvanceModal({ motif, newTag, onNewTag, onChoose, onClose }: {
  motif: CharacterSheet['Motifs'][number];
  newTag: string;
  onNewTag: (v: string) => void;
  onChoose: (o: MotifAdvanceOption) => void;
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
          <div className={styles.advanceOption}>
            <button type="button" className={`tap-inline ${modal.secondaryAction}`} disabled title="Improvements ship in slice 4 — this choice isn't available yet.">
              {OPTION_LABELS.GainImprovement}
            </button>
            <p className={styles.improvementNote}>Improvements aren't built yet — this lands in a later slice.</p>
          </div>
          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.dismiss}`} onClick={onClose}>
            Not yet — keep the track full
          </button>
        </div>
      </div>
    </div>
  );
}
