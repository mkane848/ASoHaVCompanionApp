import { useState } from 'react';
import type { Character, Library, Party } from '@asohav/shared';
import { aidWithPartyTag, unusedPartySkillTags } from '@asohav/shared';
import { Panel, PanelHeader, PlayLockedNote } from './Panel.js';
import { Pips } from './Pips.js';
import { AidTagMenu } from '../roll/AidTagMenu.js';
import { HistoryModal, type HistoryEntry } from '../../components/HistoryModal.js';
import { GlossaryText } from '../../components/GlossaryText.js';
import { useGlossaryMatcher } from '../../lib/useGlossaryMatcher.js';
import styles from './AdvancementPanel.module.css';
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
 *  it and Aid — since both happen in play. Progressing the Party is not offered here at all: V0.7
 *  makes it a step of Make Camp (`MakeCampModal`, owner rulings D4/D7). The Party
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
      aidWithPartyTag(d, tag, myName, undefined, rapportLen);
    });
  }
  const [openHistory, setOpenHistory] = useState<{ title: string; entries: HistoryEntry[] } | null>(null);

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
          <p className={styles.rapportNote}>
            One pool for the whole party, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
          </p>
          {playLocked && <PlayLockedNote />}
          {/* V0.7: Rapport holds at most the track length (marking at 5 just stops), and a full track is
              spent at Make Camp (L2041), where the Party advance is a step of the Make Camp dialog (owner
              rulings D4/D7) — so this is a reminder, not a trigger. */}
          {party.Rapport >= rapportLen && (
            <p className={styles.readyBadge}>Rapport full — Progress the Party when you Make Camp</p>
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
    </Panel>
  );
}
