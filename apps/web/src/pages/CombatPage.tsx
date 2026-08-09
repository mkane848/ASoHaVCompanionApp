import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useCommitSheet, useCommitParty, useCommitEncounter, useCombatLifecycle } from '../lib/mutations.js';
import { EncounterView } from '../features/combat/EncounterView.js';
import styles from './CombatPage.module.css';

/** Combat is track-and-display, not enforced — see CLAUDE.md's Combat architecture note. This
 *  page is a live shared view of the current Encounter (or a start form if there isn't one),
 *  synced over Supabase Realtime the same way the rest of the Campaign Shell is. */
export default function CombatPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const commitSheet = useCommitSheet(campaignId, boot?.membership.CharacterId ?? undefined);
  const commitParty = useCommitParty(campaignId);
  const commitEncounter = useCommitEncounter(campaignId);
  const lifecycle = useCombatLifecycle(campaignId);
  const [combatGoalDraft, setCombatGoalDraft] = useState('');

  if (isLoading || libLoading || !boot || !library) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const isGM = boot.membership.Role === 'GM';
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);
  const archived = boot.campaign.Status === 'Archived';

  return (
    <div className={styles.page}>
      <Link to={`/c/${campaignId}`} className={styles.back}>
        &larr; {boot.campaign.Name}
      </Link>
      <h1 className={styles.title}>Combat</h1>

      {archived && <p className={styles.archivedNote}>This campaign is archived — Combat is frozen until it's unarchived.</p>}

      {!boot.encounter ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No Combat right now.</p>
          {isGM && !archived && (
            <div className={styles.startForm}>
              <label className={styles.label}>Combat Goal</label>
              <input
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
                  commitParty((d) => { d.Rapport = Math.min(5, d.Rapport + 1); });
                }}
              >
                Start Combat
              </button>
            </div>
          )}
        </div>
      ) : (
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
      )}
    </div>
  );
}
