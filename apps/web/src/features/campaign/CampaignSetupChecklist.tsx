import { useId } from 'react';
import { Link } from 'react-router';
import { canStartPlaying, type CampaignBootstrap, type CampaignPhase, type Membership } from '@asohav/shared';
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
 *  No new game logic here. Whether the GM may start is `canStartPlaying()` (logic.ts, unit tested,
 *  and the same rule `PATCH /phase` enforces with a 409), so the button and the server can't
 *  disagree; the button is disabled until it passes, with its `reason` shown as text under it.
 *  Close signup waits the same way for at least one Player to have joined. "Ready" counts only
 *  players with a character — the "heroes" that rule is about — since a player who never made one
 *  doesn't block the start (docs/decisions.md item 63). Both phase buttons just call up to
 *  `CampaignPage`, which owns the request and its error toast; `busy` is that request in flight,
 *  so a double tap can't send a second, now-invalid transition. */
export function CampaignSetupChecklist({
  boot,
  phase,
  isGM,
  archived,
  busy,
  myUserId,
  onCloseSignup,
  onStartPlaying,
}: {
  boot: CampaignBootstrap;
  phase: CampaignPhase;
  isGM: boolean;
  archived: boolean;
  busy: boolean;
  myUserId: string;
  onCloseSignup: () => void;
  onStartPlaying: () => void;
}) {
  const signupReasonId = useId();
  const startReasonId = useId();
  const players = boot.members.filter((m) => m.Role === 'Player');
  const heroes = players.filter((m) => !!m.CharacterId);
  const heroesReady = heroes.filter((m) => m.Ready).length;
  const withoutCharacter = players.length - heroes.length;

  if (phase === 'Playing') {
    return (
      <div className={styles.summary}>
        <span className={styles.summaryItem}>{players.length} player{players.length === 1 ? '' : 's'}</span>
        <span className={styles.summaryItem}>{heroes.length} / {players.length} characters created</span>
        <span className={styles.summaryItem}>{heroesReady} / {heroes.length} heroes were ready</span>
      </div>
    );
  }

  const start = canStartPlaying(boot.members);
  const signupBlocked = players.length === 0 ? 'No players have joined yet.' : null;

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
          <>
            <button
              type="button"
              className={`tap-inline ${styles.laneAction}`}
              onClick={onCloseSignup}
              disabled={busy || !!signupBlocked}
              aria-describedby={signupBlocked ? signupReasonId : undefined}
            >
              Close signup &amp; start party creation
            </button>
            {signupBlocked && (
              <p id={signupReasonId} className={styles.blockedReason}>
                {signupBlocked}
              </p>
            )}
          </>
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
                  {/* Keyed off CharacterId like canStartPlaying: a player without a character has no
                      readiness that counts, so showing "Not ready" there would misstate who blocks. */}
                  {!!m.CharacterId && <span className={m.Ready ? styles.rowOk : styles.rowMissing}>{m.Ready ? 'Ready' : 'Not ready'}</span>}
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
        {!archived && phase !== 'Signup' && (
          <Link to={`/c/${boot.campaign.Id}/party`} className={`tap-inline ${styles.laneLink}`}>
            Set up the Party
          </Link>
        )}
        {isGM && !archived && phase === 'PartyCreation' && (
          <>
            <div className={styles.laneFooter}>
              {heroes.length > 0 && (
                <span className={styles.readyTag}>
                  {heroesReady} / {heroes.length} {heroes.length === 1 ? 'hero' : 'heroes'} ready
                </span>
              )}
              <button
                type="button"
                className={`tap-inline ${styles.laneAction}`}
                onClick={onStartPlaying}
                disabled={busy || !start.ok}
                aria-describedby={start.reason ? startReasonId : undefined}
              >
                Start playing
              </button>
            </div>
            {start.reason && (
              <p id={startReasonId} className={styles.blockedReason}>
                {start.reason}
              </p>
            )}
            {heroes.length > 0 && withoutCharacter > 0 && (
              <p className={styles.quietNote}>
                {withoutCharacter} {withoutCharacter === 1 ? 'player has' : 'players have'} no character yet and won't hold up the start.
              </p>
            )}
          </>
        )}
      </div>

      <div className={`${styles.lane} ${styles[laneStatus('Playing', phase)]}`}>
        <div className={styles.laneHead}>Playing</div>
        <p className={styles.laneBody}>Not started yet.</p>
      </div>
    </div>
  );
}
