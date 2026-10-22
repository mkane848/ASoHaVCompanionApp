import type { CharacterSheet, Library, QuestAbandonInput, QuestCompletionChoices } from '@asohav/shared';
import { newId, nowIso, completeQuest, abandonQuest } from '@asohav/shared';
import { TrackStepper } from './TrackStepper.js';
import { QuestProgress } from './QuestProgress.js';
import { TagList } from '../../components/TagList.js';
import { InlineEdit } from '../../components/InlineEdit.js';
import { PlayLockedNote, StaticTags, sheetWriter, type SheetWriteProps } from './Panel.js';
import styles from './MotifPanel.module.css';
import typography from '../../styles/typography.module.css';

/** Three Motifs replace the single Theme (ruleset V0.5, slice 2). Each Motif is a self-contained
 *  bucket: a renameable name, its own Skill Tags and Flaw Tags, a 0–5 Potential track, a Quest,
 *  and three Act Breaks + three Forsakes. Rendered inside `BackgroundPanel`, below `LooksPanel`.
 *
 *  `playLocked` (before the GM starts play) disables what happens in the fiction — marking
 *  Potential and the Quest's Act Breaks, Forsakes, completion and abandonment — while a
 *  Motif's name, its tags and its Quest text stay editable as character building. One
 *  PlayLockedNote covers all three Motifs. `readOnly` (the GM's peek) renders every value as text. */
export function MotifPanel(props: { sheet: CharacterSheet; library: Library; playLocked?: boolean } & SheetWriteProps) {
  const { sheet, library, playLocked = false } = props;
  const readOnly = props.readOnly === true;
  const commit = sheetWriter(props);
  const cap = library.settings.PotentialTrackLength;

  const motifs = sheet.Motifs;

  function updateMotif(index: number, fn: (m: CharacterSheet['Motifs'][number]) => void) {
    commit((d) => fn(d.Motifs[index]));
  }

  /** A full Potential track just sits full: V0.7 offers the Motif advance only inside Make Camp (owner
   *  rulings D4/D7, 2026-10-22), as a step of `MakeCampModal` (`MotifAdvanceFlow`). Nothing here opens it. */
  function setPotential(index: number, n: number) {
    commit((d) => { d.Motifs[index].Potential = n; });
  }

  function completeMotifQuest(i: number, choices: QuestCompletionChoices) {
    commit((d) => {
      const m = d.Motifs[i];
      // "Mark Potential on that Quest's Motif until you have 5": the track fills; the advance itself
      // waits for Make Camp (V0.7, owner rulings D4/D7), where it is offered because the track is full.
      const { fillProgress } = completeQuest(m, choices);
      if (fillProgress) m.Potential = cap;
      d.Advancement.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'noted',
        Name: 'Completed a Quest',
        Effect: m.Name,
      });
    });
  }

  function abandonMotifQuest(i: number, input: QuestAbandonInput) {
    commit((d) => {
      const m = d.Motifs[i];
      const { progressToAdd } = abandonQuest(m, input);
      m.Potential = Math.min(cap, m.Potential + progressToAdd);
      d.Advancement.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'noted',
        Name: 'Abandoned a Quest',
        Effect: m.Name,
      });
    });
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Motifs</div>
      <p className={styles.hint}>Three aspects of your Hero — each with its own Skills, Flaws, Potential, and a Quest.</p>
      {playLocked && !readOnly && <PlayLockedNote />}

      <div className={`board ${styles.motifBoard}`}>
        {motifs.map((m, i) => (
          <div key={i} className={`posting ${styles.motif}`}>
            <div className={styles.motifHead}>
              {readOnly ? (
                <div className={`${styles.nameInput} ${styles.nameStatic} ${m.Name ? '' : styles.nameEmpty}`}>{m.Name || `Motif ${i + 1}`}</div>
              ) : (
                <InlineEdit
                  className={styles.nameInput}
                  value={m.Name}
                  placeholder="Name this Motif…"
                  ariaLabel={`Motif ${i + 1} name`}
                  onCommit={(next) => updateMotif(i, (mm) => { mm.Name = next; })}
                />
              )}
              <TrackStepper
                label="Potential"
                value={m.Potential}
                max={cap}
                color="var(--gold)"
                onSet={(n) => setPotential(i, n)}
                disabled={playLocked}
                readOnly={readOnly}
              />
            </div>

            {m.Potential >= cap && !readOnly && (
              <p className={styles.readyBadge}>Potential full — Advance this Motif when you Make Camp</p>
            )}

            <div className={styles.tagGroups}>
              <div className={styles.tagGroup}>
                <div className={typography.label}>Skill Tags <span className={styles.tagHint}>+1 when relevant</span></div>
                {readOnly ? (
                  <StaticTags items={m.SkillTags} emptyText="None" />
                ) : (
                  <TagList
                    items={m.SkillTags}
                    onChange={(next) => updateMotif(i, (mm) => { mm.SkillTags = next; })}
                    addLabel="+ Skill Tag"
                    placeholder="Write a tag…"
                    ariaPrefix={`Skill tag on Motif ${i + 1},`}
                  />
                )}
              </div>

              <div className={styles.tagGroup}>
                <div className={typography.label}>Flaw Tags <span className={styles.tagHint}>−1 when relevant · mark Potential</span></div>
                {readOnly ? (
                  <StaticTags items={m.FlawTags} emptyText="None" />
                ) : (
                  <TagList
                    items={m.FlawTags}
                    onChange={(next) => updateMotif(i, (mm) => { mm.FlawTags = next; })}
                    addLabel="+ Flaw Tag"
                    placeholder="Write a tag…"
                    ariaPrefix={`Flaw tag on Motif ${i + 1},`}
                  />
                )}
              </div>
            </div>

            <QuestProgress
              quest={m.Quest}
              actBreaks={m.ActBreaks}
              forsakes={m.Forsakes}
              currentName={m.Name}
              skillTags={m.SkillTags}
              flawTags={m.FlawTags}
              progressLabel="Potential"
              onQuestChange={(q) => updateMotif(i, (mm) => { mm.Quest = q; })}
              onSetActBreaks={(n) => updateMotif(i, (mm) => { mm.ActBreaks = n as 0 | 1 | 2 | 3; })}
              onSetForsakes={(n) => updateMotif(i, (mm) => { mm.Forsakes = n as 0 | 1 | 2 | 3; })}
              onComplete={(choices) => completeMotifQuest(i, choices)}
              onAbandon={(input) => abandonMotifQuest(i, input)}
              readOnly={readOnly}
              playLocked={playLocked}
              hideLockedHint
            />
          </div>
        ))}
      </div>
    </div>
  );
}
