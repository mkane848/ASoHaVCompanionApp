import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { campaignPhase, partyReadiness, type CampaignBootstrap, type CampaignPhase, type Character, type Library, type MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useBondActions } from '../lib/mutations.js';
import { api } from '../lib/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { PeekCard } from '../features/campaign/PeekCard.js';
import { InvitesPanel } from '../features/campaign/InvitesPanel.js';
import { CampaignBonds } from '../features/campaign/CampaignBonds.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import styles from './CampaignPage.module.css';

const PHASE_LABEL: Record<CampaignPhase, string> = { Signup: 'Signup open', PartyCreation: 'Party creation', Playing: 'Playing' };

export default function CampaignPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const bondActions = useBondActions(campaignId);
  const qc = useQueryClient();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingStart, setConfirmingStart] = useState(false);

  if (isLoading || libLoading || !boot || !library) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const gm = boot.users.find((u) => u.Id === boot.campaign.GmUserId);
  const isGM = boot.membership.Role === 'GM';
  const isArchived = boot.campaign.Status === 'Archived';
  const phase = campaignPhase(boot.campaign);
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);
  const readiness = partyReadiness(boot.members);

  function invalidate() {
    return qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
  }

  function setStatus(status: 'Active' | 'Archived') {
    return api.campaign.setStatus(campaignId!, status).then(invalidate);
  }

  function setPhase(next: CampaignPhase) {
    return api.campaign.setPhase(campaignId!, next).then(invalidate);
  }

  return (
    <div>
      <div className={styles.banner}>
        <div>
          <div className={styles.campaignName}>
            {boot.campaign.Name}
            {isArchived && <span className={styles.archivedBadge}>Archived</span>}
            {!isArchived && <span className={styles.phaseBadge}>{PHASE_LABEL[phase]}</span>}
          </div>
          <div className={styles.runBy}>Run by {gm?.Name}</div>
        </div>
        <div className={styles.bannerActions}>
          <Link to={`/c/${boot.campaign.Id}/combat`} className={`tap-inline ${styles.combatLink}`}>
            Combat
          </Link>
          {isGM && !isArchived && phase === 'Signup' && (
            <button className={`tap-inline ${styles.phaseButton}`} onClick={() => setPhase('PartyCreation')}>
              Close signup &amp; start party creation
            </button>
          )}
          {isGM && !isArchived && phase === 'PartyCreation' && (
            <>
              <span className={styles.readyTag}>
                {readiness.ready} / {readiness.total} ready
              </span>
              <button
                className={`tap-inline ${styles.phaseButton}`}
                onClick={() => (readiness.total > 0 && readiness.ready === readiness.total ? setPhase('Playing') : setConfirmingStart(true))}
              >
                Start playing
              </button>
            </>
          )}
          {isGM && (
            <button
              className={`tap-inline ${styles.archiveButton}`}
              onClick={() => (isArchived ? setStatus('Active') : setConfirmingArchive(true))}
            >
              {isArchived ? 'Unarchive campaign' : 'Archive campaign'}
            </button>
          )}
        </div>
      </div>

      <div className={styles.page}>
        {isGM ? (
          <GmView
            boot={boot}
            library={library}
            phase={phase}
            readiness={readiness}
            onInvite={(email) => api.campaign.invite(campaignId!, email).then(invalidate)}
            onRevoke={(id) => api.campaign.revokeInvite(campaignId!, id).then(invalidate)}
          />
        ) : (
          <PlayerView
            boot={boot}
            myCharacter={myCharacter}
            bondActions={bondActions}
            archived={isArchived}
            phase={phase}
            onSetReady={(ready) => api.campaign.setReady(campaignId!, ready).then(invalidate)}
          />
        )}
      </div>

      {confirmingArchive && (
        <ConfirmModal
          title="Archive this campaign?"
          body="Players will still be able to see it, but no one — including you — can send invites, propose or answer Bond changes, or edit sheets/party until it's unarchived."
          confirmLabel="Archive campaign"
          onConfirm={() => { setStatus('Archived'); setConfirmingArchive(false); }}
          onCancel={() => setConfirmingArchive(false)}
        />
      )}

      {confirmingStart && (
        <ConfirmModal
          title="Start playing anyway?"
          body={`Not every player has marked themselves ready (${readiness.ready} / ${readiness.total}). You can still start the campaign now.`}
          confirmLabel="Start playing"
          onConfirm={() => { setPhase('Playing'); setConfirmingStart(false); }}
          onCancel={() => setConfirmingStart(false)}
        />
      )}
    </div>
  );
}

function GmView({
  boot,
  library,
  phase,
  readiness,
  onInvite,
  onRevoke,
}: {
  boot: CampaignBootstrap;
  library: Library;
  phase: CampaignPhase;
  readiness: { ready: number; total: number };
  onInvite: (email: string) => void;
  onRevoke: (id: string) => void;
}) {
  const summaries = Object.values(boot.peekSummaries);
  return (
    <>
      <div className={styles.gmNotice}>
        <div className={styles.gmNoticeTitle}>You are running this campaign.</div>
        <p className={styles.gmNoticeText}>
          GMs don't keep a character sheet. Below is every player's sheet, live — this is the same data they see, updating as they change it.
        </p>
        {phase === 'Signup' && (
          <p className={styles.gmNoticeText}>Players can accept invites and join now. Close signup above once everyone's in.</p>
        )}
        {phase === 'PartyCreation' && (
          <p className={styles.gmNoticeText}>
            Players are creating characters and confirming setup. {readiness.ready} of {readiness.total} are ready.
          </p>
        )}
      </div>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>The party</h2>
        <div className={styles.rule} />
        <span className={styles.rapportTag}>Rapport {boot.party.Rapport} / 5</span>
      </div>

      <div className={styles.peekGrid}>
        {summaries.map((s) => (
          <PeekCard key={s.Id} summary={s} library={library} />
        ))}
      </div>

      <div className={`${styles.sectionHead} ${styles.sectionHeadSpaced}`}>
        <h2 className={styles.sectionTitle}>Invites</h2>
        <div className={styles.rule} />
      </div>
      <InvitesPanel invites={boot.invites} onSend={onInvite} onRevoke={onRevoke} />
    </>
  );
}

function PlayerView({
  boot,
  myCharacter,
  bondActions,
  archived,
  phase,
  onSetReady,
}: {
  boot: CampaignBootstrap;
  myCharacter: Character | undefined;
  bondActions: ReturnType<typeof useBondActions>;
  archived: boolean;
  phase: CampaignPhase;
  onSetReady: (ready: boolean) => void;
}) {
  const isReady = !!boot.membership.Ready;
  return (
    <div className={styles.playerLayout}>
      <div className={styles.playerAside}>
        <div className={styles.characterCard}>
          <div className={styles.characterLabel}>Your character</div>
          <div className={styles.characterName}>{myCharacter?.Name ?? 'No character yet'}</div>
          {myCharacter && (
            <Link to={`/c/${boot.campaign.Id}/sheet`} className={styles.openSheet}>
              Open sheet
            </Link>
          )}
          {myCharacter && !archived && phase === 'PartyCreation' && (
            <button className={`tap-inline ${styles.readyButton}`} onClick={() => onSetReady(!isReady)}>
              {isReady ? "You're ready — tap to undo" : "I'm ready"}
            </button>
          )}
        </div>

        <div className={styles.rapportCard}>
          <div className={styles.rapportHead}>
            <h2 className={styles.rapportTitle}>Rapport</h2>
            <div className={styles.rule} />
            <span className={styles.rapportValue}>{boot.party.Rapport} / 5</span>
          </div>
          <p className={styles.rapportNote}>One pool for the whole party. Anyone can spend it, and it updates for everyone at once.</p>
        </div>
      </div>

      {myCharacter ? (
        <CampaignBonds
          bonds={boot.bonds}
          characters={boot.characters}
          myCharacterId={myCharacter.Id}
          archived={archived}
          onPropose={(bondId, type, payload, note) => bondActions.propose(bondId, type, payload, note)}
          onAccept={(bondId) => bondActions.accept(bondId)}
          onReject={(bondId, withdrawn) => bondActions.reject(bondId, withdrawn)}
        />
      ) : (
        <div className={styles.noCharacter}>
          {phase === 'Signup' && <p>The GM hasn't started party creation yet.</p>}
          {phase !== 'Signup' && (
            <>
              <p>No character on this campaign yet.</p>
              {!archived && phase === 'PartyCreation' && (
                <Link to={`/c/${boot.campaign.Id}/create-character`} className={styles.openSheet}>
                  Create your character
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
