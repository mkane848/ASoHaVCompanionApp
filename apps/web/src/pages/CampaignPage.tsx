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

export default function CampaignPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const bondActions = useBondActions(campaignId);
  const qc = useQueryClient();

  if (isLoading || libLoading || !boot || !library) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }

  const gm = boot.users.find((u) => u.Id === boot.campaign.GmUserId);
  const isGM = boot.membership.Role === 'GM';
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);

  return (
    <div>
      <div style={{ background: 'var(--ink)', color: 'var(--ink-on-dark)', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>{boot.campaign.Name}</div>
          <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.55 }}>Run by {gm?.Name}</div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 20px 70px' }}>
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
      <div style={{ padding: '12px 16px', marginBottom: 20, background: 'var(--gold-tint)', border: '1px solid var(--gold-line)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>You are running this campaign.</div>
        <p style={{ margin: '2px 0 0', fontSize: 13, color: 'rgba(42,32,26,.72)' }}>
          GMs don't keep a character sheet. Below is every player's sheet, live — this is the same data they see, updating as they change it.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, margin: 0 }}>The party</h2>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
        <span style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>Rapport {boot.party.Rapport} / 5</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {summaries.map((s) => (
          <PeekCard key={s.Id} summary={s} library={library} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '28px 0 12px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 24, margin: 0 }}>Invites</h2>
        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 320px', maxWidth: 420 }}>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', borderTop: '2px solid var(--gold)', padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--ink-45)' }}>Your character</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>{myCharacter?.Name ?? 'No character yet'}</div>
          {myCharacter && (
            <Link to={`/c/${boot.campaign.Id}/sheet`} style={{ display: 'inline-block', marginTop: 12, fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none', background: 'var(--ink)', color: 'var(--ink-on-dark)', padding: '9px 15px' }}>
              Open sheet
            </Link>
          )}
        </div>

        <div style={{ background: 'var(--panel)', border: '1px solid var(--rule)', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 21, margin: 0 }}>Rapport</h2>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>{boot.party.Rapport} / 5</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--ink-55)', fontStyle: 'italic' }}>One pool for the whole party. Anyone can spend it, and it updates for everyone at once.</p>
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
        <div style={{ flex: '2 1 420px', fontStyle: 'italic', color: 'var(--ink-55)' }}>No character on this campaign yet.</div>
      )}
    </div>
  );
}
