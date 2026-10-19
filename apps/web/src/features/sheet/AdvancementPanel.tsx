import { lazy, Suspense, useState } from 'react';
import type { Character, Library, Party } from '@asohav/shared';
import { aidWithPartyTag, applyPartyRapportAdvance, unusedPartySkillTags } from '@asohav/shared';
import { Panel, PanelHeader, PlayLockedNote } from './Panel.js';
import { Pips } from './Pips.js';
import { AidTagMenu } from '../roll/AidTagMenu.js';
import { HistoryModal, type HistoryEntry } from '../../components/HistoryModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AdvancementPanel.module.css';
// Type-only, so it doesn't pull the lazy chunk below into this one.
import type { PartyAdvanceChoice } from './PartyAdvanceModal.js';

// Lazy — a rarely-triggered modal (only shown once a full Rapport track needs clearing); see
// CharacterSheetPage.tsx's bundle-budget note.
const PartyAdvanceModal = lazy(() => import('./PartyAdvanceModal.js').then((m) => ({ default: m.PartyAdvanceModal })));

/** Party History holds several kinds of entry, told apart by `Action`: a Party advance (`took`),
 *  Rapport spent on Aid (`spent`), a Party Tag used on a roll (`declared`), a Camp Asset used
 *  (`used`), and a note — Keep Watch, or a change to the GM's Drama (`noted`, revised V0.6
 *  slice 2). `By` is a display name when set; a Party advance isn't attributed to one player. */
function historyLabel(e: { Action: string; Name?: string; Effect?: string; By?: string }): string {
  const who = e.By || 'The party';
  if (e.Action === 'spent') return `${who} spent Rapport${e.Effect ? ` — ${e.Effect}` : ''}`;
  if (e.Action === 'noted') return `${e.Name}: ${e.Effect ?? ''}${e.By ? ` (${e.By})` : ''}`;
  if (e.Action === 'declared') return `${who} used the ${e.Name}${e.Effect ? ` “${e.Effect}”` : ''}`;
  if (e.Action === 'used') return `${who} used a ${e.Name}${e.Effect ? `: ${e.Effect}` : ''}`;
  return `${who} took ${e.Name}`;
}

/** `playLocked` (before the GM starts play) disables everything here that moves Rapport — marking
 *  it, Progressing the Party, spending it on Aid — since all three happen in play. The Party
 *  History stays openable. */
export function AdvancementPanel({
  library,
  party,
  characters,
  myCharacterId,
  commitParty,
  playLocked = false,
}: {
  library: Library;
  party: Party;
  characters: Character[];
  myCharacterId: string;
  commitParty: (m: (d: Party) => void) => void;
  playLocked?: boolean;
}) {
  const matcher = useGlossaryMatcher();
  const rTaken = party.RapportImprovementsTaken;
  const rapportLen = library.settings.RapportTrackLength;
  const myName = characters.find((c) => c.Id === myCharacterId)?.Name ?? 'Someone';

  /** Aid (V0.7): invokes one of the Party's unused Skill Tags to give an ally +1. Logged by
   *  `aidWithPartyTag()` rather than silent, since Party tags and Rapport are shared: a teammate
   *  seeing a tag go grey should be able to see who used it and what for. */
  function aidWithTag(tag: string) {
    if (playLocked) return;
    commitParty((d) => {
      aidWithPartyTag(d, tag, myName);
    });
  }
  const [openHistory, setOpenHistory] = useState<{ title: string; entries: HistoryEntry[] } | null>(null);
  const [advancingParty, setAdvancingParty] = useState(false);

  function applyPartyAdvance({ option, tag, improvement, rewrite }: PartyAdvanceChoice) {
    commitParty((d) => {
      applyPartyRapportAdvance(d, option, rapportLen, tag, improvement);
      if (rewrite) {
        const tags = rewrite.kind === 'Skill' ? d.SkillTags : d.FlawTags;
        const at = tags.indexOf(rewrite.from);
        if (at >= 0) tags[at] = rewrite.to;
      }
    });
    setAdvancingParty(false);
  }

  return (
    <Panel id="p-growth" collapseId="growth" primary>
      <PanelHeader>Advancement</PanelHeader>

      <div className={styles.tracksRow}>
        <div className={styles.subBox}>
          <div className={styles.trackHead}>
            <div className={styles.trackNaming}>
              <div className={styles.trackName}>Rapport</div>
              <div className={`${styles.trackMeta} ${styles.trackMetaShared}`}>
                Party · shared · Level {party.PartyLevel ?? 0}
              </div>
            </div>
            <Pips
              count={rapportLen}
              filled={Math.min(party.Rapport, rapportLen)}
              color="var(--gold)"
              onSet={(n) => {
                commitParty((d) => { d.Rapport = n; });
              }}
              disabled={playLocked}
            />
          </div>
          {/* V0.6 slice 7: Rapport may now exceed the cap (WorkPlan-V0.6.md Section A4 item 1) —
              Pips can only ever show `rapportLen` dots, so a maxed row alone can't tell 5 from 15.
              This banked-overflow readout is the fix the plan's own "showing 10/5 legibly" note
              asked for; note a pip click still sets Rapport to that dot's exact value, discarding
              any banked overflow — a deliberately blunt manual override, unchanged from before
              this slice. */}
          {party.Rapport > rapportLen && (
            <p className={styles.rapportOverflow}>
              {party.Rapport} Rapport — {party.Rapport - rapportLen} banked beyond the track, saved for your next Make Camp.
            </p>
          )}
          <p className={styles.rapportNote}>
            One pool for the whole party, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
          </p>
          {playLocked && <PlayLockedNote />}
          {/* V0.6 slice 4: a full Rapport track no longer advances the instant it fills — it
              advances the next time the party Makes Camp, so this is a manual trigger rather than
              an auto-opened modal (WorkPlan-V0.6.md Section A2). */}
          {party.Rapport >= rapportLen && (
            <button type="button" className={`tap-inline ${styles.readyBadge}`} disabled={playLocked} onClick={() => setAdvancingParty(true)}>
              Rapport full — Progress the Party at your next Make Camp
            </button>
          )}
          {/* Aid (V0.7): invoke an unused Party Skill Tag for +1 on an ally's roll, even after the dice
              land. The app can't see "a roll", so it marks the tag used and the Rapport and records who
              did it; the once-per-teammate limit and the +3 cap stay table rules. */}
          <div className={styles.aidRow}>
            <AidTagMenu tags={unusedPartySkillTags(party)} disabled={playLocked} triggerClassName={styles.aidButton} onAid={aidWithTag} />
          </div>
          {rTaken.map((t, i) => (
            <div key={i} className={`${styles.takenRow} ${styles.takenRowTight}`}>
              <div className={styles.takenName}>{t.Name}</div>
              <div className={styles.takenEffect}><GlossaryText text={t.Effect} matcher={matcher} /></div>
            </div>
          ))}
          {party.History.length > 0 && (
            <button
              type="button"
              className={`tap-inline ${styles.historyTrigger}`}
              onClick={() => setOpenHistory({ title: 'Party History', entries: party.History.map((e) => ({ label: historyLabel(e), when: e.At })) })}
            >
              History ({party.History.length})
            </button>
          )}
        </div>
      </div>
      {openHistory && (
        <HistoryModal
          title={openHistory.title}
          entries={openHistory.entries}
          matcher={matcher}
          onClose={() => setOpenHistory(null)}
        />
      )}
      {advancingParty && (
        <Suspense fallback={null}>
          <PartyAdvanceModal party={party} library={library} onChoose={applyPartyAdvance} onClose={() => setAdvancingParty(false)} />
        </Suspense>
      )}
    </Panel>
  );
}
