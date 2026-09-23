import { useState } from 'react';
import type { Bond, Character, CharacterSheet, Clock, Party, RollTier } from '@asohav/shared';
import { CAMP_ACTIONS, campActionsAllowed, newId, nowIso, partyTagKey, rewriteMotifTag, tickClock } from '@asohav/shared';
import { useModalA11y } from '../../lib/useModalA11y.js';
import { useMisfortune } from '../../lib/useMisfortune.js';
import { TierChoiceRow } from './TierChoiceRow.js';
import modal from '../../styles/modal.module.css';
import styles from './CampActionsModal.module.css';

const PROJECT_CLOCK_SEGMENTS: Record<RollTier, number> = { Tier3: 3, Tier2: 2, Tier1: 1 };

/** The Make Camp pieces not already covered by the "Make Camp" button in `StatusesPanel.tsx`
 *  (`MakeCampModal.tsx` — clearing a Condition, refreshing Armor, and the Load lock). This modal
 *  covers: advancing a Threat Clock, a reminder to check Advancement for a full track, and Camp
 *  Actions (one per Party Improvement: rewrite or update Party Skill/Flaw Tags, rewrite or update
 *  Hero Skill/Flaw Tags, propose a Connection Tag rewrite and mark the Bond, use a Party
 *  Improvement, or progress a personal Project Clock). Both Clock pickers filter to the real `Kind`
 *  the doc names (V0.6 slice 6, `0.47.0`, split the old generic `'Countdown'` into
 *  `'Threat'`/`'Project'`) rather than listing every open Clock. The five Camp Actions are taken
 *  from the revised ruleset (slice 8), verbatim in order; "Change the Party Goal" and "Use a Camp
 *  Asset" are no longer Camp Actions. The "rewrite a Tag" action replaced the original "change a
 *  personal Quest" one in V0.6 slice 4 (`WorkPlan-V0.6.md` Section A2: "Change personal Drive/Want"
 *  becomes "Rewrite or update any one of your Skill or Flaw Tags") — a Motif's Quest is still
 *  freely editable on the sheet itself, just no longer spent as a Camp Action of its own. */
export function CampActionsModal({
  sheet,
  party,
  bonds,
  characters,
  myCharacterId,
  clocks,
  commitSheet,
  commitParty,
  onSaveClock,
  onProposeConnectionTag,
  onClose,
}: {
  sheet: CharacterSheet;
  party: Party;
  bonds: Bond[];
  characters: Character[];
  myCharacterId: string;
  clocks: Clock[];
  commitSheet: (m: (d: CharacterSheet) => void) => void;
  commitParty: (m: (d: Party) => void) => void;
  onSaveClock: (clock: Clock) => void;
  onProposeConnectionTag: (bondId: string, tag: string) => void;
  onClose: () => void;
}) {
  const [days, setDays] = useState(1);
  const [badGuyClockId, setBadGuyClockId] = useState('');
  const [partyTagCategory, setPartyTagCategory] = useState<'Skill' | 'Flaw'>('Skill');
  const [partyTagExistingIndex, setPartyTagExistingIndex] = useState<number | null>(null);
  const [partyTagText, setPartyTagText] = useState('');
  const [tagMotifIndex, setTagMotifIndex] = useState(0);
  const [tagCategory, setTagCategory] = useState<'Skill' | 'Flaw'>('Skill');
  const [tagExistingIndex, setTagExistingIndex] = useState<number | null>(null);
  const [tagText, setTagText] = useState('');
  const [connectionBondId, setConnectionBondId] = useState('');
  const [connectionTagText, setConnectionTagText] = useState('');
  const [improvementChoice, setImprovementChoice] = useState('');
  const [projectClockId, setProjectClockId] = useState('');

  const misfortune = useMisfortune();
  const actionsAllowed = campActionsAllowed(party.RapportImprovementsTaken.length);
  const actionsLeft = actionsAllowed - sheet.CampActionsUsed;
  const openClocks = clocks.filter((c) => c.Status === 'Open');
  // V0.6 slice 6: Countdown split into Threat/Project — Make Camp's own text is specific to
  // advancing "another Threat's Clock", and a personal project is a Project Clock, so both
  // pickers now filter to the Kind the doc actually names instead of listing every open Clock.
  const threatClocks = openClocks.filter((c) => c.Kind === 'Threat');
  const projectClocks = clocks.filter((c) => c.Kind === 'Project');

  const myBonds = bonds.filter((b) => b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId);
  const getPartnerName = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === myCharacterId ? b.CharacterBId : b.CharacterAId))?.Name ?? 'them';

  const partyTagOptions = partyTagCategory === 'Skill' ? party.SkillTags : party.FlawTags;
  const existingTags = tagCategory === 'Skill' ? sheet.Motifs[tagMotifIndex]?.SkillTags ?? [] : sheet.Motifs[tagMotifIndex]?.FlawTags ?? [];

  function advanceBadGuyClock() {
    const clock = threatClocks.find((c) => c.Id === badGuyClockId);
    if (!clock) return;
    const ticks = Math.max(1, days);
    onSaveClock({ ...clock, SuccessMarks: tickClock(clock, ticks), History: [{ Id: newId('h'), At: nowIso(), Text: `Advanced ${ticks} at Make Camp (${days} day${days === 1 ? '' : 's'}).` }, ...clock.History] });
  }

  function spendAction(fn: () => void) {
    if (actionsLeft <= 0) return;
    fn();
    commitSheet((d) => { d.CampActionsUsed += 1; });
  }

  function rewritePartyTag() {
    spendAction(() => {
      const oldTag = partyTagExistingIndex !== null && partyTagExistingIndex >= 0 ? partyTagOptions[partyTagExistingIndex] : null;
      const newTag = partyTagText.trim();
      if (!newTag) return;

      commitParty((d) => {
        const tags = partyTagCategory === 'Skill' ? d.SkillTags : d.FlawTags;
        if (oldTag !== null) {
          const idx = tags.indexOf(oldTag);
          if (idx >= 0) tags[idx] = newTag;
        } else {
          tags.push(newTag);
        }

        // Update UsedTags if the old tag was used
        if (oldTag !== null) {
          const oldKey = partyTagKey(partyTagCategory, oldTag);
          const newKey = partyTagKey(partyTagCategory, newTag);
          const usedIdx = d.UsedTags.indexOf(oldKey);
          if (usedIdx >= 0) {
            d.UsedTags[usedIdx] = newKey;
          }
        }

        // Add to history
        d.History.unshift({
          Id: newId('h'),
          At: nowIso(),
          Action: 'updated',
          Name: `Party ${partyTagCategory} Tag`,
          Effect: newTag,
        });
      });

      setPartyTagText('');
      setPartyTagExistingIndex(null);
    });
  }

  function rewriteHeroTag() {
    spendAction(() => {
      commitSheet((d) => { rewriteMotifTag(d.Motifs[tagMotifIndex], tagCategory, tagExistingIndex, tagText); });
      setTagText('');
      setTagExistingIndex(null);
    });
  }

  function proposeConnectionTag() {
    if (connectionBondId && connectionTagText.trim()) {
      spendAction(() => {
        onProposeConnectionTag(connectionBondId, connectionTagText.trim());
        setConnectionBondId('');
        setConnectionTagText('');
      });
    }
  }

  function usePartyImprovement() {
    const improvement = party.RapportImprovementsTaken.find((i) => i.Id === improvementChoice);
    if (!improvement) return;
    spendAction(() => {
      commitParty((d) => {
        d.History.unshift({
          Id: newId('h'),
          At: nowIso(),
          Action: 'used',
          Name: 'Party Improvement',
          Effect: improvement.Name,
        });
      });
      setImprovementChoice('');
    });
  }

  function progressProjectClock(tier: RollTier) {
    const clock = projectClocks.find((c) => c.Id === projectClockId);
    if (!clock) return;
    spendAction(() => {
      if (tier === 'Tier1') {
        misfortune.gain('A 6- on a Project');
      }
      onSaveClock({
        ...clock,
        SuccessMarks: tickClock(clock, PROJECT_CLOCK_SEGMENTS[tier]),
        History: [{ Id: newId('h'), At: nowIso(), Text: `Progressed ${PROJECT_CLOCK_SEGMENTS[tier]} as a Camp Action (${tier}).` }, ...clock.History],
      });
    });
  }

  const dialogRef = useModalA11y<HTMLDivElement>(onClose);

  return (
    <div className={modal.backdrop} onClick={onClose}>
      <div ref={dialogRef} className={`${modal.dialog} ${styles.dialog}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="camp-actions-title" tabIndex={-1}>
        <div className={modal.head}>
          <h2 id="camp-actions-title" className={modal.title}>Camp Actions</h2>
          <p className={modal.subtitle}>
            Clearing a Condition, refreshing Armor, or Recuperating? Use the <strong>Make Camp</strong> button in Statuses above — this covers the rest.
          </p>
        </div>
        <div className={modal.body}>
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Advance a Threat</div>
            {threatClocks.length === 0 ? (
              <p className={styles.empty}>No open Threat Clocks — the GM can create one from the Campaign Shell.</p>
            ) : (
              <div className={`tap-row ${styles.row}`}>
                <select className={`tap-inline ${styles.select}`} value={badGuyClockId} onChange={(e) => setBadGuyClockId(e.target.value)}>
                  <option value="">Choose a Threat…</option>
                  {threatClocks.map((c) => <option key={c.Id} value={c.Id}>{c.Title}</option>)}
                </select>
                <input type="number" min={1} className={`tap-inline ${styles.numberInput}`} value={days} onChange={(e) => setDays(Math.max(1, parseInt(e.target.value, 10) || 1))} aria-label="Days at Camp" />
                <button type="button" className={`tap-inline ${modal.primaryAction}`} disabled={!badGuyClockId} onClick={advanceBadGuyClock}>Advance</button>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Eligible for advancement?</div>
            <p className={styles.hint}>
              A full Motif Potential track, Bond Track, or the party&rsquo;s Rapport now advances at your next Make Camp &mdash; look for a &ldquo;Ready to advance&rdquo; button on that track in Motifs or the Connections panel.
            </p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              Camp Actions &mdash; {actionsLeft} of {actionsAllowed} left
            </div>
            {actionsAllowed === 0 && (
              <p className={styles.empty}>No Camp Actions &mdash; the party has no Party Improvements yet.</p>
            )}

            {/* RewritePartyTag */}
            <div className={styles.actionLabel}>{CAMP_ACTIONS[0].Text}</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={partyTagCategory} onChange={(e) => { setPartyTagCategory(e.target.value as 'Skill' | 'Flaw'); setPartyTagExistingIndex(null); setPartyTagText(''); }}>
                <option value="Skill">Skill Tag</option>
                <option value="Flaw">Flaw Tag</option>
              </select>
              <select className={`tap-inline ${styles.select}`} value={partyTagExistingIndex ?? ''} onChange={(e) => setPartyTagExistingIndex(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">Choose a tag…</option>
                {partyTagOptions.map((t, i) => <option key={i} value={i}>Replace “{t}”</option>)}
              </select>
              <input className={`tap-inline ${styles.textInput}`} value={partyTagText} placeholder="New tag…" onChange={(e) => setPartyTagText(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !partyTagText.trim() || partyTagExistingIndex === null} onClick={rewritePartyTag}>Rewrite Party Tag</button>
            </div>

            {/* RewriteHeroTag */}
            <div className={styles.actionLabel}>{CAMP_ACTIONS[1].Text}</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={tagMotifIndex} onChange={(e) => { setTagMotifIndex(Number(e.target.value)); setTagExistingIndex(null); setTagText(''); }}>
                {sheet.Motifs.map((m, i) => <option key={i} value={i}>{m.Name || `Motif ${i + 1}`}</option>)}
              </select>
              <select className={`tap-inline ${styles.select}`} value={tagCategory} onChange={(e) => { setTagCategory(e.target.value as 'Skill' | 'Flaw'); setTagExistingIndex(null); setTagText(''); }}>
                <option value="Skill">Skill Tag</option>
                <option value="Flaw">Flaw Tag</option>
              </select>
              <select className={`tap-inline ${styles.select}`} value={tagExistingIndex ?? ''} onChange={(e) => setTagExistingIndex(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">Choose a tag…</option>
                {existingTags.map((t, i) => <option key={i} value={i}>Replace “{t}”</option>)}
              </select>
              <input className={`tap-inline ${styles.textInput}`} value={tagText} placeholder="New tag…" onChange={(e) => setTagText(e.target.value)} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !tagText.trim() || tagExistingIndex === null} onClick={rewriteHeroTag}>Rewrite Tag</button>
            </div>

            {/* RewriteConnectionTag */}
            <div className={styles.actionLabel}>{CAMP_ACTIONS[2].Text}</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={connectionBondId} onChange={(e) => { setConnectionBondId(e.target.value); setConnectionTagText(''); }} disabled={myBonds.length === 0}>
                <option value="">{myBonds.length === 0 ? 'No Connections yet' : 'Choose a Bond…'}</option>
                {myBonds.map((b) => {
                  const hasPending = b.PendingChange !== null;
                  return (
                    <option key={b.Id} value={b.Id} disabled={hasPending}>
                      {getPartnerName(b)}{hasPending ? ' (pending)' : ''}
                    </option>
                  );
                })}
              </select>
              <input maxLength={80} className={`tap-inline ${styles.textInput}`} value={connectionTagText} placeholder="New tag…" onChange={(e) => setConnectionTagText(e.target.value)} disabled={!connectionBondId} />
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !connectionBondId || !connectionTagText.trim()} onClick={proposeConnectionTag}>Propose new tag</button>
            </div>
            {myBonds.length > 0 && myBonds.some((b) => b.PendingChange) && (
              <p className={styles.hint}>A Bond with a pending change can&rsquo;t be chosen &mdash; the other Hero must respond first.</p>
            )}
            {connectionBondId && (
              <p className={styles.hint}>Your partner will accept or decline this proposal.</p>
            )}

            {/* UsePartyImprovement */}
            <div className={styles.actionLabel}>{CAMP_ACTIONS[3].Text}</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={improvementChoice} onChange={(e) => setImprovementChoice(e.target.value)} disabled={party.RapportImprovementsTaken.length === 0}>
                <option value="">{party.RapportImprovementsTaken.length === 0 ? 'No Party Improvements' : 'Choose a Party Improvement…'}</option>
                {party.RapportImprovementsTaken.map((i) => <option key={i.Id} value={i.Id}>{i.Name}</option>)}
              </select>
              <button type="button" className={`tap-inline ${styles.choice}`} disabled={actionsLeft <= 0 || !improvementChoice} onClick={usePartyImprovement}>Use Improvement</button>
            </div>
            <p className={styles.hint}>The app doesn&rsquo;t apply an Improvement&rsquo;s effect &mdash; you and your table resolve it.</p>

            {/* ProgressProjectClock */}
            <div className={styles.actionLabel}>{CAMP_ACTIONS[4].Text}</div>
            <div className={styles.actionRow}>
              <select className={`tap-inline ${styles.select}`} value={projectClockId} onChange={(e) => setProjectClockId(e.target.value)} disabled={projectClocks.length === 0}>
                <option value="">{projectClocks.length === 0 ? 'No Project Clocks' : 'Choose a project Clock…'}</option>
                {projectClocks.map((c) => <option key={c.Id} value={c.Id}>{c.Title}</option>)}
              </select>
              <TierChoiceRow disabled={actionsLeft <= 0 || !projectClockId} onChoose={progressProjectClock} />
            </div>
            <p className={styles.hint}>Progressing a project is a roll; a 6- gives the GM 1 Misfortune.</p>
          </div>

          <button type="button" className={`tap-inline ${modal.secondaryAction} ${styles.close}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
