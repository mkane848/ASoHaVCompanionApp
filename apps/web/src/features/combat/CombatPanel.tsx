import { useState } from 'react';
import type { CampaignBootstrap, Library, MeResponse } from '@asohav/shared';
import { useCommitSheet, useCommitParty, useCommitEncounter, useCombatLifecycle } from '../../lib/mutations.js';
import { EncounterView } from './EncounterView.js';
import styles from './CombatPanel.module.css';

/** The "start form vs. live Encounter" switch, extracted from CombatPage (0.23.0) so it can also
 *  render inline on CampaignPage — Combat moved off its own navbar link and into both the GM and
 *  player views (players are the ones who apply incoming Status offers, Interpose, Recuperate,
 *  Defend, and Help, so a GM-only section would strand them). This component owns no page chrome
 *  (heading, back link, archived banner) — CombatPage and CampaignPage each supply their own,
 *  appropriate to where it's embedded. Combat is track-and-display, not enforced — see CLAUDE.md's
 *  Combat architecture note. */
export function CombatPanel({ me, campaignId, boot, library }: { me: MeResponse; campaignId: string; boot: CampaignBootstrap; library: Library }) {
  const commitSheet = useCommitSheet(campaignId, boot.membership.CharacterId ?? undefined);
  const commitParty = useCommitParty(campaignId);
  const commitEncounter = useCommitEncounter(campaignId);
  const lifecycle = useCombatLifecycle(campaignId);
  const [combatGoalDraft, setCombatGoalDraft] = useState('');

  const isGM = boot.membership.Role === 'GM';
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);
  const archived = boot.campaign.Status === 'Archived';

  if (!boot.encounter) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No Combat right now.</p>
        {isGM && !archived && (
          <div className={styles.startForm}>
            <label className={styles.label} htmlFor="combat-goal">Combat Goal</label>
            <input
              id="combat-goal"
              className={styles.input}
              value={combatGoalDraft}
              onChange={(e) => setCombatGoalDraft(e.target.value)}
              placeholder="What does the party need to do to end this fight?"
            />
            <button
              className={`tap-inline ${styles.startButton}`}
              onClick={() => {
                lifecycle.start(combatGoalDraft.trim());
                setCombatGoalDraft('');
              }}
            >
              Start Combat
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <EncounterView
      encounter={boot.encounter}
      library={library}
      characters={boot.characters}
      mySheet={boot.mySheet}
      myCharacterId={myCharacter?.Id ?? null}
      peekSummaries={boot.peekSummaries}
      party={boot.party}
      isGM={isGM}
      archived={archived}
      commitSheet={commitSheet}
      commitEncounter={commitEncounter}
      commitParty={commitParty}
      onEnd={() => lifecycle.end(boot.encounter!.Id)}
    />
  );
}
