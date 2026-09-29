import { lazy, Suspense, useState } from 'react';
import { Link, useParams } from 'react-router';
import { campaignPhase, type CampaignBootstrap, type CampaignPhase, type Character, type Library, type MeResponse } from '@asohav/shared';
import { useBootstrap } from '../lib/useBootstrap.js';
import { useLibrary } from '../lib/useLibrary.js';
import { useBondActions } from '../lib/mutations.js';
import { api, type InviteDelivery } from '../lib/api.js';
import { useQueryClient } from '@tanstack/react-query';
import { PeekCard } from '../features/campaign/PeekCard.js';
import { InvitesPanel } from '../features/campaign/InvitesPanel.js';
import { CampaignBonds } from '../features/campaign/CampaignBonds.js';
import { CampaignSetupChecklist } from '../features/campaign/CampaignSetupChecklist.js';
import { ConfirmModal } from '../components/ConfirmModal.js';
import { SectionHead } from '../components/SectionHead.js';
import { GlossaryDrawer } from '../components/GlossaryDrawer.js';
import { useGlossaryUiStore } from '../store/glossaryUiStore.js';
import { MisfortuneCounter } from '../features/campaign/MisfortuneCounter.js';
import { PHASE_LABEL, isPlaying } from '../lib/phaseLabels.js';
import { useToastStore } from '../store/toastStore.js';
import styles from './CampaignPage.module.css';

// Lazy from here too, not just from CombatPage's own route-level lazy() in App.tsx — CampaignPage
// is a core route every player loads, so importing CombatPanel (which pulls in EncounterView and
// its three modals) eagerly would put all of Combat straight back into the main bundle (see PR #70,
// 674 kB -> 613 kB). As of 0.38.0, Combat is gated on the Playing phase (`isPlaying`) in both GmView
// and PlayerView (see below) — pre-Playing there's no heading and no import at all, GM and player
// alike (superseding the pre-0.38.0 "a GM always needs the start-Encounter form regardless of
// whether one is running" reasoning, since a GM can't start one before Playing either); a
// player's view additionally only imports once boot.encounter is non-null once the gate is open.
const CombatPanel = lazy(() => import('../features/combat/CombatPanel.js').then((m) => ({ default: m.CombatPanel })));

// Same reasoning and split as CombatPanel just above: a GM always needs the New Clock form
// regardless of whether one exists yet, so their view always renders this; a player's view only
// triggers the lazy import once boot.clocks has at least one row (see PlayerView below).
const ClocksPanel = lazy(() => import('../features/clocks/ClocksPanel.js').then((m) => ({ default: m.ClocksPanel })));

// GM Reference drawer — lazy loaded to avoid bundling it in the main Campaign page chunk.
const GmReferenceDrawer = lazy(() => import('../features/gm/GmReferenceDrawer.js').then((m) => ({ default: m.GmReferenceDrawer })));

// The GM's read-only view of one player's sheet, opened from their PeekCard. Lazy for the same
// reason as the three above: a whole sheet's worth of rendering that no player ever needs on this
// core route, and a GM only once they open one — first-load JS already sits close to
// bundle-budget.mjs's cap, so an eager import here would be the one that breaks it.
const PeekSheetModal = lazy(() => import('../features/campaign/PeekSheetModal.js').then((m) => ({ default: m.PeekSheetModal })));

export default function CampaignPage({ me }: { me: MeResponse }) {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { data: boot, isLoading } = useBootstrap(campaignId);
  const { data: library, isLoading: libLoading } = useLibrary();
  const bondActions = useBondActions(campaignId);
  const qc = useQueryClient();
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [phaseBusy, setPhaseBusy] = useState(false);
  const [gmReferenceOpen, setGmReferenceOpen] = useState(false);
  const openGlossary = useGlossaryUiStore((s) => s.openDrawer);
  const showToast = useToastStore((s) => s.show);

  if (isLoading || libLoading || !boot || !library) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const gm = boot.users.find((u) => u.Id === boot.campaign.GmUserId);
  const isGM = boot.membership.Role === 'GM';
  const isArchived = boot.campaign.Status === 'Archived';
  const phase = campaignPhase(boot.campaign);
  const myCharacter = boot.characters.find((c) => c.UserId === me.user.Id);

  function invalidate() {
    return qc.invalidateQueries({ queryKey: ['bootstrap', campaignId] });
  }

  // The server refuses these with a readable reason — a 409 when the party isn't ready to start,
  // or the campaign was archived elsewhere — so say it. A refusal usually means this view was
  // stale, so it refetches either way rather than leaving the stale state on screen.
  function refused(fallback: string) {
    return (err: unknown) => {
      showToast(err instanceof Error && err.message ? err.message : fallback);
      return invalidate();
    };
  }

  function setStatus(status: 'Active' | 'Archived') {
    return api.campaign.setStatus(campaignId!, status).then(invalidate, refused("Couldn't change the campaign's status — try again."));
  }

  function setPhase(next: CampaignPhase) {
    setPhaseBusy(true);
    return api.campaign
      .setPhase(campaignId!, next)
      .then(invalidate, refused("Couldn't change the campaign's phase — try again."))
      .finally(() => setPhaseBusy(false));
  }

  return (
    <div>
      <div className={styles.banner}>
        <div>
          <h1 className={styles.campaignName}>
            {boot.campaign.Name}
            {isArchived && <span className={styles.archivedBadge}>Archived</span>}
            {!isArchived && <span className={styles.phaseBadge}>{PHASE_LABEL[phase]}</span>}
          </h1>
          <div className={styles.runBy}>Run by {gm?.Name}</div>
        </div>
        <div className={styles.bannerActions}>
          <button type="button" className={`tap-inline ${styles.glossaryButton}`} onClick={() => openGlossary()}>
            Glossary
          </button>
          {isGM && (
            <button type="button" className={`tap-inline ${styles.glossaryButton}`} onClick={() => setGmReferenceOpen(true)}>
              GM Reference
            </button>
          )}
          <Link to={`/c/${campaignId}/world`} className={`tap-inline ${styles.adventureButton}`}>
            Creating the World
          </Link>
          <Link to={`/c/${campaignId}/party`} className={`tap-inline ${styles.adventureButton}`}>
            The Party
          </Link>
          {isGM && (
            <Link to={`/c/${campaignId}/adventure`} className={`tap-inline ${styles.adventureButton}`}>
              Adventure Prep
            </Link>
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
        <CampaignSetupChecklist
          boot={boot}
          phase={phase}
          isGM={isGM}
          archived={isArchived}
          busy={phaseBusy}
          myUserId={me.user.Id}
          onCloseSignup={() => setPhase('PartyCreation')}
          onStartPlaying={() => setPhase('Playing')}
        />
        {isGM ? (
          <GmView
            boot={boot}
            library={library}
            me={me}
            campaignId={campaignId!}
            archived={isArchived}
            onInvite={(email) => api.campaign.invite(campaignId!, email).then((r) => { invalidate(); return r.delivery; })}
            onResend={(inviteId) => api.campaign.resendInvite(campaignId!, inviteId).then((r) => r.delivery)}
            onRevoke={(id) => api.campaign.revokeInvite(campaignId!, id).then(invalidate)}
          />
        ) : (
          <PlayerView
            boot={boot}
            myCharacter={myCharacter}
            bondActions={bondActions}
            archived={isArchived}
            phase={phase}
            me={me}
            campaignId={campaignId!}
            library={library}
            onSetReady={(ready) => api.campaign.setReady(campaignId!, ready).then(invalidate, refused("Couldn't update your ready status — try again."))}
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

      <GlossaryDrawer library={library} />

      {gmReferenceOpen && isGM && (
        <Suspense fallback={null}>
          <GmReferenceDrawer library={library} onClose={() => setGmReferenceOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}

function GmView({
  boot,
  library,
  me,
  campaignId,
  archived,
  onInvite,
  onResend,
  onRevoke,
}: {
  boot: CampaignBootstrap;
  library: Library;
  me: MeResponse;
  campaignId: string;
  archived: boolean;
  onInvite: (email: string) => Promise<InviteDelivery>;
  onResend: (id: string) => Promise<InviteDelivery>;
  onRevoke: (id: string) => void;
}) {
  const summaries = Object.values(boot.peekSummaries);
  // Rapport and Misfortune are play resources: before the GM starts play there is nothing to
  // spend them on, so neither the tag nor the controls exist yet (docs/decisions.md item 63).
  const playing = isPlaying(boot.campaign);
  const [peekingId, setPeekingId] = useState<string | null>(null);
  // Both keyed by character id (a CharacterSummary's `Id` is its character's); either can vanish
  // under a live refetch while the modal is open, and then it simply closes.
  const peekCharacter = peekingId ? boot.characters.find((c) => c.Id === peekingId) : undefined;
  const peekSheet = peekingId ? boot.peekSheets[peekingId] : undefined;
  return (
    <>
      <div className={styles.gmNotice}>
        <div className={styles.gmNoticeTitle}>You are running this campaign.</div>
        <p className={styles.gmNoticeText}>
          GMs don't keep a character sheet. Below is every player's sheet, live — this is the same data they see, updating as they change it.
        </p>
      </div>

      <SectionHead
        title="The party"
        collapseId="campaign.party"
        extra={playing && <span className={styles.rapportTag}>Rapport {boot.party.Rapport} / {library.settings.RapportTrackLength}</span>}
      >
        {playing && (
          <MisfortuneCounter
            campaignId={campaignId}
            misfortune={boot.party.Misfortune}
            isGM={true}
            archived={archived}
          />
        )}

        <div className={styles.peekGrid}>
          {summaries.map((s) => (
            <PeekCard key={s.Id} summary={s} library={library} onOpen={() => setPeekingId(s.Id)} />
          ))}
        </div>
      </SectionHead>

      {playing && (
        <SectionHead title="Combat" spaced collapseId="campaign.combat">
          <Suspense fallback={<div className={styles.panelLoading}>Loading…</div>}>
            <CombatPanel me={me} campaignId={campaignId} boot={boot} library={library} />
          </Suspense>
        </SectionHead>
      )}

      <SectionHead title="Clocks" spaced collapseId="campaign.clocks">
        <Suspense fallback={<div className={styles.panelLoading}>Loading…</div>}>
          <ClocksPanel campaignId={campaignId} boot={boot} />
        </Suspense>
      </SectionHead>

      <SectionHead title="Invites" spaced collapseId="campaign.invites">
        <InvitesPanel invites={boot.invites} onSend={onInvite} onResend={onResend} onRevoke={onRevoke} />
      </SectionHead>

      {peekCharacter && peekSheet && (
        <Suspense fallback={null}>
          <PeekSheetModal character={peekCharacter} sheet={peekSheet} boot={boot} library={library} onClose={() => setPeekingId(null)} />
        </Suspense>
      )}
    </>
  );
}

function PlayerView({
  boot,
  myCharacter,
  bondActions,
  archived,
  phase,
  me,
  campaignId,
  library,
  onSetReady,
}: {
  boot: CampaignBootstrap;
  myCharacter: Character | undefined;
  bondActions: ReturnType<typeof useBondActions>;
  archived: boolean;
  phase: CampaignPhase;
  me: MeResponse;
  campaignId: string;
  library: Library;
  onSetReady: (ready: boolean) => void;
}) {
  const isReady = !!boot.membership.Ready;
  // Same gate as GmView's: Rapport and Misfortune only mean something once play has started.
  const playing = isPlaying(boot.campaign);
  return (
    <>
      {playing && (
        <SectionHead title="Combat" collapseId="campaign.combat">
          {boot.encounter ? (
            <Suspense fallback={<div className={styles.panelLoading}>Loading…</div>}>
              <CombatPanel me={me} campaignId={campaignId} boot={boot} library={library} />
            </Suspense>
          ) : (
            <p className={styles.panelEmpty}>No Combat right now.</p>
          )}
        </SectionHead>
      )}

      <SectionHead title="Clocks" spaced={playing} collapseId="campaign.clocks">
        {boot.clocks.length > 0 ? (
          <Suspense fallback={<div className={styles.panelLoading}>Loading…</div>}>
            <ClocksPanel campaignId={campaignId} boot={boot} />
          </Suspense>
        ) : (
          <p className={styles.panelEmpty}>No Clocks right now.</p>
        )}
      </SectionHead>

      <div className={`${styles.playerLayout} ${styles.playerLayoutSpaced}`}>
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

          {playing && (
            <>
              <div className={styles.rapportCard}>
                <div className={styles.rapportHead}>
                  <h2 className={styles.rapportTitle}>Rapport</h2>
                  <div className={styles.rule} />
                  <span className={styles.rapportValue}>{boot.party.Rapport} / {library.settings.RapportTrackLength}</span>
                </div>
                <p className={styles.rapportNote}>One pool for the whole party. Anyone can spend it, and it updates for everyone at once.</p>
              </div>

              <MisfortuneCounter
                campaignId={campaignId}
                misfortune={boot.party.Misfortune}
                isGM={false}
                archived={archived}
              />
            </>
          )}
        </div>

        {myCharacter ? (
          <CampaignBonds
            bonds={boot.bonds}
            characters={boot.characters}
            myCharacterId={myCharacter.Id}
            archived={archived}
            bondTrackLength={library.settings.BondTrackLength}
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
    </>
  );
}
