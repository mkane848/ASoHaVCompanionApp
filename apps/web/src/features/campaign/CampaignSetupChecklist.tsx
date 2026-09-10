import { Link } from 'react-router';
import type { CampaignBootstrap, CampaignPhase, Membership } from '@asohav/shared';
import styles from './CampaignSetupChecklist.module.css';

type LaneStatus = 'done' | 'current' | 'upcoming';

const PHASE_ORDER: CampaignPhase[] = ['Signup', 'PartyCreation', 'Playing'];

function laneStatus(lane: CampaignPhase, phase: CampaignPhase): LaneStatus {
  const laneIdx = PHASE_ORDER.indexOf(lane);
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  if (laneIdx < phaseIdx) return 'done';
  if (laneIdx === phaseIdx) return 'current';
  return 'upcoming';
}

/** The review round's core ask: "the whole 'where is the campaign in its setup' story feels
 *  disjointed; the GM side and Player side each lack a sense of 'what am I waiting on.'"
 *  (WorkPlan-0.38.0.md item 5). Renders **once**, shared by both `GmView` and `PlayerView` —
 *  rendering a second copy inside either branch would let the two drift.
 *
 *  Collapses to a one-line summary once `phase === 'Playing'` rather than unmounting, so the
 *  three lanes stay legible mid-campaign as a "how we got here" record.
 *
 *  No new game logic here — `readiness`/`phase` are computed by the caller from
 *  `partyReadiness()`/`campaignPhase()`, both already unit tested; the "Start playing anyway?"
 *  confirm flow stays owned by `CampaignPage`, reached only through `onStartPlaying`. */
export function CampaignSetupChecklist({
  boot,
  phase,
  readiness,
  isGM,
  archived,
  myUserId,
  onCloseSignup,
  onStartPlaying,
}: {
  boot: CampaignBootstrap;
  phase: CampaignPhase;
  readiness: { ready: number; total: number };
  isGM: boolean;
  archived: boolean;
  myUserId: string;
  onCloseSignup: () => void;
  onStartPlaying: () => void;
}) {
  const players = boot.members.filter((m) => m.Role === 'Player');
  const charactersCreated = players.filter((m) => !!m.CharacterId).length;

  if (phase === 'Playing') {
    return (
      <div className={styles.summary}>
        <span className={styles.summaryItem}>{players.length} player{players.length === 1 ? '' : 's'}</span>
        <span className={styles.summaryItem}>{charactersCreated} / {players.length} characters created</span>
        <span className={styles.summaryItem}>{readiness.ready} / {readiness.total} were ready</span>
      </div>
    );
  }

  const userName = (id: string) => boot.users.find((u) => u.Id === id)?.Name ?? 'Unknown';
  const characterFor = (m: Membership) => (m.CharacterId ? boot.characters.find((c) => c.Id === m.CharacterId) : undefined);

  return (
    <div className={styles.lanes}>
      <div className={`${styles.lane} ${styles[laneStatus('Signup', phase)]}`}>
        <div className={styles.laneHead}>Signup</div>
        <p className={styles.laneBody}>{players.length} player{players.length === 1 ? '' : 's'} joined.</p>
        {!archived && (
          <Link to={`/c/${boot.campaign.Id}/world`} className={`tap-inline ${styles.laneLink}`}>
            Build the world together
          </Link>
        )}
        {isGM && !archived && phase === 'Signup' && (
          <button type="button" className={`tap-inline ${styles.laneAction}`} onClick={onCloseSignup}>
            Close signup &amp; start party creation
          </button>
        )}
      </div>

      <div className={`${styles.lane} ${styles[laneStatus('PartyCreation', phase)]}`}>
        <div className={styles.laneHead}>Party Creation</div>
        {phase !== 'Signup' && (
          <div className={styles.rows}>
            {players.map((m) => {
              const character = characterFor(m);
              const isMe = m.UserId === myUserId;
              return (
                <div key={m.Id} className={styles.row}>
                  <span className={styles.rowName}>{userName(m.UserId)}</span>
                  <span className={character ? styles.rowOk : styles.rowMissing}>{character ? character.Name : 'No character'}</span>
                  <span className={m.Ready ? styles.rowOk : styles.rowMissing}>{m.Ready ? 'Ready' : 'Not ready'}</span>
                  {isMe && !character && !archived && phase === 'PartyCreation' && (
                    <Link to={`/c/${boot.campaign.Id}/create-character`} className={`tap-inline ${styles.createCta}`}>
                      Create your character
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {isGM && !archived && phase === 'PartyCreation' && (
          <div className={styles.laneFooter}>
            <span className={styles.readyTag}>{readiness.ready} / {readiness.total} ready</span>
            <button type="button" className={`tap-inline ${styles.laneAction}`} onClick={onStartPlaying}>
              Start playing
            </button>
          </div>
        )}
      </div>

      <div className={`${styles.lane} ${styles[laneStatus('Playing', phase)]}`}>
        <div className={styles.laneHead}>Playing</div>
        <p className={styles.laneBody}>Not started yet.</p>
      </div>
    </div>
  );
}
