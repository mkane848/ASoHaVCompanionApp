import { lazy, Suspense, useState } from 'react';
import type { Character, Library, Party } from '@asohav/shared';
import { applyPartyRapportAdvance, newId, nowIso, spendRapportForAid } from '@asohav/shared';
import { Panel, PanelHeader } from './Panel.js';
import { Pips } from './Pips.js';
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
 *  (`used`), and a note — Keep Watch, or a change to the GM's Misfortune (`noted`, revised V0.6
 *  slice 2). `By` is a display name when set; a Party advance isn't attributed to one player. */
function historyLabel(e: { Action: string; Name?: string; Effect?: string; By?: string }): string {
  const who = e.By || 'The party';
  if (e.Action === 'spent') return `${who} spent Rapport${e.Effect ? ` — ${e.Effect}` : ''}`;
  if (e.Action === 'noted') return `${e.Name}: ${e.Effect ?? ''}${e.By ? ` (${e.By})` : ''}`;
  if (e.Action === 'declared') return `${who} used the ${e.Name}${e.Effect ? ` “${e.Effect}”` : ''}`;
  if (e.Action === 'used') return `${who} used a ${e.Name}${e.Effect ? `: ${e.Effect}` : ''}`;
  return `${who} took ${e.Name}`;
}

export function AdvancementPanel({
  library,
  party,
  characters,
  myCharacterId,
  commitParty,
}: {
  library: Library;
  party: Party;
  characters: Character[];
  myCharacterId: string;
  commitParty: (m: (d: Party) => void) => void;
}) {
  const matcher = useGlossaryMatcher();
  const rTaken = party.RapportImprovementsTaken;
  const rapportLen = library.settings.RapportTrackLength;
  const myName = characters.find((c) => c.Id === myCharacterId)?.Name ?? 'Someone';

  /** Spends Rapport on Aid and records it. Logged rather than silent: Rapport is shared, so a
   *  teammate seeing the pool drop should be able to see who spent it and what for. Routes
   *  through `spendRapportForAid()` (V0.6 slice 7) so spending before Camp forfeits any banked
   *  overflow rather than spending from it — see that function's own doc comment. Always 1 Rapport
   *  since the revision (slice 8): the 2-Rapport Risk Death spend went with Risk Death itself. */
  function spendRapportOnAid() {
    if (party.Rapport < 1) return;
    commitParty((d) => {
      spendRapportForAid(d, 1, rapportLen);
      d.History.unshift({
        Id: newId('h'),
        At: nowIso(),
        Action: 'spent',
        Name: 'Aid',
        Effect: '+1 to an ally\u2019s roll',
        By: myName,
      });
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
            One pool for the whole party — anyone can spend it, and it updates for everyone at once. Last edited {new Date(party.UpdatedAt).toLocaleString()}.
          </p>
          {/* V0.6 slice 4: a full Rapport track no longer advances the instant it fills — it
              advances the next time the party Makes Camp, so this is a manual trigger rather than
              an auto-opened modal (WorkPlan-V0.6.md Section A2). */}
          {party.Rapport >= rapportLen && (
            <button type="button" className={`tap-inline ${styles.readyBadge}`} onClick={() => setAdvancingParty(true)}>
              Rapport full — Progress the Party at your next Make Camp
            </button>
          )}
          {/* Aid (V0.5): 1 Rapport for +1 on another Hero's roll, spendable even after the dice
              land, double during Risk Death. The app can't see "a roll", so it moves the currency
              and records who spent it; the once-per-teammate limit stays a table rule. V0.6
              deleted Risk Death, so its 2-Rapport button is gone (revised V0.6 slice 8), and the
              revision's +3 cap on Aid is the roll helper's to apply, not this button's. */}
          <div className={`action-grid ${styles.aidRow}`} style={{ '--action-min': '150px' } as React.CSSProperties}>
            <button
              type="button"
              className={`tap-inline ${styles.aidButton}`}
              disabled={party.Rapport <= 0}
              onClick={spendRapportOnAid}
            >
              Aid (&minus;1 Rapport)
            </button>
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
