/* Screenshot harness: renders the real pages against seed fixtures with no server.
   Not part of the app build — `vite build` only sees index.html. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  seedCampaign,
  seedMemberships,
  seedCharacters,
  seedSheets,
  seedParty,
  seedBonds,
  seedLibrary,
  summaryFor,
  newId,
  markRank,
  emptyMarks,
  SEED_USER_IDS,
  type Adventure,
  type CampaignBootstrap,
  type CampaignOverview,
  type CampaignOverviewBond,
  type CampaignOverviewMember,
  type CharacterSummary,
  type Clock,
  type Encounter,
  type MeResponse,
  type Membership,
  type MyInvite,
} from '@asohav/shared';
import { queryClient } from './lib/queryClient.js';
/* Stylesheets first, and layers.css before all of them.
 *
 * @layer order is fixed by where each layer name is FIRST seen. ES imports are
 * evaluated in source order, so importing App above these would pull in every
 * component's .module.css — and their `@layer components` blocks — before this
 * declaration ran. `components` would then be registered as the first, and
 * therefore weakest, layer, and base.css's `a { color: var(--gold) }` would
 * beat a component's own colour. */
import './styles/layers.css';
import './styles/tokens.css';
import './styles/appearances.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/surfaces.css';
import App from './App.js';
import LoginPage from './pages/LoginPage.js';

const params = new URLSearchParams(location.search);
const route = params.get('route') ?? '/';
const as = params.get('as') ?? 'ryan'; // 'ryan' = player, 'mike' = GM/admin
/* ?anon=1 renders the signed-out screen. App decides that from a failed /me
   request, which needs a server, so the harness mounts LoginPage directly. */
const anon = params.get('anon') === '1';
// ?archived=1 flips the demo campaign's Status — exercises the archived badge/label and the
// hidden propose/accept/withdraw controls on the campaign and character-sheet routes without a
// third synthetic campaign.
const archived = params.get('archived') === '1';
// ?phase=signup|partycreation|playing overrides cm-1's Phase (0.38.0 item 8) — exercises the
// CampaignSetupChecklist's three lane states and Combat's pre-Playing hidden state.
// seedCampaign() already sets cm-1 to 'Playing', so the default path is unchanged.
const phaseParam = params.get('phase');
const PHASE_PARAM_MAP: Record<string, 'Signup' | 'PartyCreation' | 'Playing'> = {
  signup: 'Signup',
  partycreation: 'PartyCreation',
  playing: 'Playing',
};
// ?encounter=1 seeds a live Active Encounter with a PC and an Enemy participant, so the Combat
// route's in-fight UI (not just its "no active encounter" state) gets responsive-smoke coverage.
const withEncounter = params.get('encounter') === '1';
// ?clocks=1 seeds a couple of open Clocks (one Basic mid-progress, one Countdown), same reasoning
// as ?encounter=1 above — exercises ClocksPanel's populated state, not just its empty one.
const withClocks = params.get('clocks') === '1';
// ?adventures=1 seeds one Adventure (GM fixture only — see below) referencing slice 8's own
// Grizza/Rosa/Skreel/Hollow Bend seed content, mid-Countdown with one revealed and one
// unrevealed Secret — exercises AdventuresPanel's populated state, same reasoning as
// ?encounter=1/?clocks=1 above.
const withAdventures = params.get('adventures') === '1';

const library = seedLibrary();
const campaign = seedCampaign();
if (archived) campaign.Status = 'Archived';
if (phaseParam && PHASE_PARAM_MAP[phaseParam]) campaign.Phase = PHASE_PARAM_MAP[phaseParam];
const memberships = seedMemberships();
const characters = seedCharacters();
const sheets = seedSheets();
const party = seedParty();
const bonds = seedBonds();

const userId = SEED_USER_IDS[as as keyof typeof SEED_USER_IDS];
const membership = memberships.find((m) => m.UserId === userId)!;
const users = [
  { Id: SEED_USER_IDS.mike, Name: 'Mike' },
  { Id: SEED_USER_IDS.ryan, Name: 'Ryan' },
  { Id: SEED_USER_IDS.sam, Name: 'Sam' },
  { Id: SEED_USER_IDS.ivy, Name: 'Ivy' },
  { Id: SEED_USER_IDS.dax, Name: 'Dax' },
];

const peekSummaries: Record<string, CharacterSummary> = {};
if (membership.Role === 'GM') {
  for (const sheet of sheets) {
    const character = characters.find((c) => c.Id === sheet.CharacterId);
    if (character) peekSummaries[sheet.CharacterId] = summaryFor(character, sheet, library);
  }
}

const encounter: Encounter | null = withEncounter
  ? {
      Id: 'enc-harness',
      CampaignId: campaign.Id,
      Status: 'Active',
      CombatGoal: 'Drive the raiders off the bridge before the wagon burns.',
      DefiantGoals: [],
      Round: 1,
      ActingSide: 'Party',
      ActingParticipantId: null,
      PairedParticipantId: null,
      PendingStrainOffers: [],
      Participants: [
        {
          Id: 'cp-1',
          Kind: 'PC',
          RefId: characters[0]?.Id ?? 'ch-ember',
          Name: characters[0]?.Name ?? 'Ember',
          Range: 'Melee',
          ActionPointsRemaining: 2,
          HasActedThisRound: false,
          },
        {
          Id: 'cp-2',
          Kind: 'Enemy',
          RefId: 'en-brigand',
          Name: 'Brigand',
          Range: 'Melee',
          ActionPointsRemaining: 3,
          HasActedThisRound: false,
            Toughness: 'None',
          StatusLimits: [{ StatusName: 'Hurt', Limit: 4 }],
          Statuses: [{ Id: newId('esm'), Name: 'Hurt', Marks: markRank(emptyMarks(5), 2, 5) }],
        },
      ],
      History: [],
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
    }
  : null;

const clocks: Clock[] = withClocks
  ? [
      {
        Id: 'clk-harness-1',
        CampaignId: campaign.Id,
        Title: 'Castle',
        Kind: 'Basic',
        Segments: 6,
        SuccessMarks: 3,
        FailureMarks: 1,
        Status: 'Open',
        History: [{ Id: newId('clh'), At: new Date().toISOString(), Text: 'Risked 2 Headway, rolled 7–9.' }],
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      },
      {
        Id: 'clk-harness-2',
        CampaignId: campaign.Id,
        Title: 'The Watch Grows Suspicious',
        Kind: 'Countdown',
        Segments: 4,
        SuccessMarks: 2,
        Status: 'Open',
        History: [],
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      },
    ]
  : [];

const adventures: Adventure[] = withAdventures
  ? [
      {
        Id: 'adv-harness-1',
        CampaignId: campaign.Id,
        Concept: 'In a small hamlet, a pack of goblins, led by Grizza the Tall, steal the blacksmith’s daughter in order to sacrifice her in an appeasement to their god.',
        Type: 'Mystery',
        Hook: 'Devastated and desperate for help, Rosa the Blacksmith barges into wherever the Heroes are, pleading for someone capable to travel into the woods and find where the goblins dragged off her daughter.',
        VillainId: 'vil-grizza',
        NpcIds: ['npc-rosa', 'npc-skreel'],
        LocationIds: ['loc-hollow-bend', 'loc-sunken-tomb', 'loc-whispering-wood'],
        Secrets: [
          { Id: 'sec-1', Text: 'Grizza was cast out by her old clan — this new one doesn’t know that yet.', Revealed: false },
          { Id: 'sec-2', Text: 'Skreel would sell out Grizza’s plans for the right price.', Revealed: true },
        ],
        CountdownSteps: [
          { Name: 'Seed', Text: 'Grizza sends scouts to confirm the tomb’s wardstones are truly weakening.' },
          { Name: 'Bloom', Text: 'The goblins begin the binding ritual over Rosa’s daughter.' },
          { Name: 'Wilt', Text: 'The tomb’s wards crack — something ancient stirs beneath Hollow Bend.' },
          { Name: 'Wither', Text: '' },
          { Name: 'Rot', Text: '' },
        ],
        CountdownMarks: 2,
        Status: 'Active',
        CreatedAt: new Date().toISOString(),
        UpdatedAt: new Date().toISOString(),
      },
    ]
  : [];

const bootstrap: CampaignBootstrap = {
  campaign,
  membership,
  members: memberships,
  users,
  characters,
  party,
  bonds,
  invites:
    membership.Role === 'GM'
      ? [
          { Id: 'iv-1', CampaignId: campaign.Id, Email: 'newplayer@asohav.dev', Code: 'abc123', SentAt: new Date().toISOString(), Status: 'Pending' },
          { Id: 'iv-2', CampaignId: campaign.Id, Email: 'a-really-long-email-address@some-long-domain.example', Code: 'def456', SentAt: new Date().toISOString(), Status: 'Pending' },
        ]
      : [],
  mySheet: membership.CharacterId ? sheets.find((s) => s.CharacterId === membership.CharacterId) ?? null : null,
  peekSheets: {},
  peekSummaries,
  encounter,
  clocks,
  // GM-only, mirroring campaign.ts's bootstrap route exactly — a Player fixture never gets
  // Adventure data, same as `invites` above.
  adventures: membership.Role === 'GM' ? adventures : [],
};

// Mirrors auth.ts's /me route closely enough for the smoke test to actually exercise the tile
// grid's content (GM, roster, Rapport, Bonds) rather than rendering it empty for the wrong reason
// (see WorkPlan-0.23.0.md item A's "watch for" note). seedBonds() gives ch-ember a real Bond Track with
// two other characters, so the 'ryan' fixture (playing ch-ember) shows a non-empty Bond list too.
function overviewFor(m: Membership): CampaignOverview {
  const gmMembership = memberships.find((cm) => cm.Role === 'GM');
  const gmName = (gmMembership && users.find((u) => u.Id === gmMembership.UserId)?.Name) || '';

  const roster: CampaignOverviewMember[] = [];
  for (const cm of memberships) {
    if (cm.Role !== 'Player' || !cm.CharacterId) continue;
    const character = characters.find((c) => c.Id === cm.CharacterId);
    if (!character) continue;
    roster.push({ CharacterId: character.Id, CharacterName: character.Name, PlayerName: character.PlayerName, IsYou: cm.UserId === userId });
  }

  const kin: CampaignOverviewBond[] = [];
  for (const b of bonds) {
    if (b.BondTrack <= 0) continue;
    if (b.CharacterAId !== m.CharacterId && b.CharacterBId !== m.CharacterId) continue;
    const otherId = b.CharacterAId === m.CharacterId ? b.CharacterBId : b.CharacterAId;
    const other = characters.find((c) => c.Id === otherId);
    kin.push({ CharacterName: other?.Name ?? 'Unknown', BondTrack: b.BondTrack });
  }

  return { GmName: gmName, Roster: roster, Rapport: party.Rapport, Bonds: kin, LastPlayedAt: party.UpdatedAt ?? null };
}

const me: MeResponse = {
  user: {
    Id: userId,
    Name: users.find((u) => u.Id === userId)!.Name,
    Email: `${as}@asohav.dev`,
    IsAdmin: as === 'mike' || as === 'ryan',
  },
  memberships: memberships
    .filter((m) => m.UserId === userId)
    .map((m) => ({ ...m, Ready: m.Ready ?? false, CampaignName: campaign.Name, CampaignStatus: campaign.Status, CampaignPhase: campaign.Phase ?? 'PartyCreation', Overview: overviewFor(m) })),
};

// A pending invite for the 'mike' fixture — exercises the HomePage "Pending invites" row
// (Accept/Decline) without a server; other fixtures render the plain "Join a campaign" state.
const myInvites: MyInvite[] =
  as === 'mike'
    ? [{ Id: 'iv-mine-1', CampaignId: 'cm-2', Email: 'mike@asohav.dev', Code: 'ROAD-4242', SentAt: new Date().toISOString(), Status: 'Pending', CampaignName: 'Seelie' }]
    : [];

// A second, synthetic campaign for the character-creation route: a Player membership with no
// CharacterId yet, which is what actually gates that screen — not part of the "real" seed data
// above (there, nobody is mid-chargen), so it's built directly here like the rest of harness.tsx.
const chargenMembership: Membership = { Id: 'mb-chargen', UserId: SEED_USER_IDS.dax, CampaignId: 'cm-3', Role: 'Player', CharacterId: null };
const chargenBootstrap: CampaignBootstrap = {
  campaign: { Id: 'cm-3', Name: 'Seelie', GmUserId: SEED_USER_IDS.ryan, CreatedAt: new Date().toISOString(), Status: 'Active' },
  membership: chargenMembership,
  members: [chargenMembership, { Id: 'mb-chargen-gm', UserId: SEED_USER_IDS.ryan, CampaignId: 'cm-3', Role: 'GM', CharacterId: null }],
  users,
  characters: [],
  party: { Id: 'pt-chargen', CampaignId: 'cm-3', Rapport: 0, RapportImprovementsTaken: [], History: [], PartyLevel: 0, Motif: '', Quest: '', SkillTags: [], WeaknessTags: [], Path: '', Goal: '', CampAssets: [], UpdatedAt: new Date().toISOString(), UpdatedBy: null },
  bonds: [],
  invites: [],
  mySheet: null,
  peekSheets: {},
  peekSummaries: {},
  encounter: null,
  clocks: [],
  adventures: [],
};

queryClient.setQueryData(['me'], me);
queryClient.setQueryData(['library'], library);
queryClient.setQueryData(['bootstrap', campaign.Id], bootstrap);
queryClient.setQueryData(['bootstrap', 'cm-3'], chargenBootstrap);
queryClient.setQueryData(['invites', 'mine'], myInvites);
queryClient.setQueryDefaults(['invites'], { staleTime: Infinity });
// AdminPanelPage fires these unconditionally for an admin user regardless of which nav item is
// selected (they're not gated by `view`), so the 'content admin' route needs fixtures for them
// even though nothing currently deep-links into the Users/Campaigns/Character Sheets views
// themselves — same as History/Validation/Data, which the harness also only exercises via their
// nav button, not their content.
queryClient.setQueryData(['admin', 'users'], [
  { Id: SEED_USER_IDS.mike, Email: 'mike@asohav.dev', Name: 'Mike', IsAdmin: true, CreatedAt: new Date().toISOString(), LastSignInAt: new Date().toISOString() },
  { Id: SEED_USER_IDS.ryan, Email: 'ryan@asohav.dev', Name: 'Ryan', IsAdmin: true, CreatedAt: new Date().toISOString(), LastSignInAt: null },
]);
queryClient.setQueryData(['admin', 'campaigns'], [
  { ...campaign, GmName: 'Mike', MemberCount: memberships.length },
]);
queryClient.setQueryData(['admin', 'characters'], characters.map((c) => ({ ...c, CampaignName: campaign.Name })));
queryClient.setQueryDefaults(['admin'], { staleTime: Infinity });
queryClient.setQueryData(['validation'], []);
queryClient.setQueryData(['changelog'], [
  {
    Id: 'cl-1',
    At: new Date().toISOString(),
    Who: 'Mike',
    Action: 'update',
    Collection: 'moves',
    ObjectId: 'mv-1',
    ObjectName: 'Stand Fast',
    Before: { Text: 'the old wording of this move, which runs fairly long' },
    After: { Text: 'the new wording of this move, which also runs fairly long' },
  },
]);
queryClient.setQueryDefaults(['bootstrap'], { staleTime: Infinity });
queryClient.setQueryDefaults(['library'], { staleTime: Infinity });
queryClient.setQueryDefaults(['me'], { staleTime: Infinity });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{anon ? <LoginPage /> : <App />}</MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
