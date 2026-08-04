import { Link, useParams } from 'react-router-dom';
import type { CampaignBootstrap, Character, Library, MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useBondActions } from '../lib/mutations.js';
import { api } from '../lib/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { PeekCard } from '../features/campaign/PeekCard.js';
import { InvitesPanel } from '../features/campaign/InvitesPanel.js';
import { CampaignBonds } from '../features/campaign/CampaignBonds.js';
import styles from './CampaignPage.module.css';

export default function CampaignPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const bondActions = useBondActions(campaignId);
  const qc = useQueryClient();

  if (isLoading || libLoading || !boot || !library) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const gm = boot.users.find((u) => u.Id === boot.campaign.GmUserId);
  const isGM = boot.membership.Role === 'GM';
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);

  return (
    <div>
      <div className={styles.banner}>
        <div>
          <div className={styles.campaignName}>{boot.campaign.Name}</div>
          <div className={styles.runBy}>Run by {gm?.Name}</div>
        </div>
      </div>

      <div className={styles.page}>
        {isGM ? (
          <GmView boot={boot} library={library} onInvite={(email) => api.campaign.invite(campaignId!, email).then(() => qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] }))} onRevoke={(id) => api.campaign.revokeInvite(campaignId!, id).then(() => qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] }))} />
        ) : (
          <PlayerView boot={boot} myCharacter={myCharacter} bondActions={bondActions} />
        )}
      </div>
    </div>
  );
}

function GmView({ boot, library, onInvite, onRevoke }: { boot: CampaignBootstrap; library: Library; onInvite: (email: string) => void; onRevoke: (id: string) => void }) {
  const summaries = Object.values(boot.peekSummaries);
  return (
    <>
      <div className={styles.gmNotice}>
        <div className={styles.gmNoticeTitle}>You are running this campaign.</div>
        <p className={styles.gmNoticeText}>
          GMs don't keep a character sheet. Below is every player's sheet, live — this is the same data they see, updating as they change it.
        </p>
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
}: {
  boot: CampaignBootstrap;
  myCharacter: Character | undefined;
  bondActions: ReturnType<typeof useBondActions>;
}) {
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
          onPropose={(bondId, type, payload, note) => bondActions.propose(bondId, type, payload, note)}
          onAccept={(bondId) => bondActions.accept(bondId)}
          onReject={(bondId, withdrawn) => bondActions.reject(bondId, withdrawn)}
        />
      ) : (
        <div className={styles.noCharacter}>
          <p>No character on this campaign yet.</p>
          <Link to={`/c/${boot.campaign.Id}/create-character`} className={styles.openSheet}>
            Create your character
          </Link>
        </div>
      )}
    </div>
  );
}
