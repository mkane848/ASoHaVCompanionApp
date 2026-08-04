/* Screenshot harness: renders the real pages against seed fixtures with no server.
   Not part of the app build — `vite build` only sees index.html. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
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
  SEED_USER_IDS,
  type CampaignBootstrap,
  type CharacterSummary,
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
import './styles/base.css';
import './styles/layout.css';
import App from './App.js';
import LoginPage from './pages/LoginPage.js';

const params = new URLSearchParams(location.search);
const route = params.get('route') ?? '/';
const as = params.get('as') ?? 'ryan'; // 'ryan' = player, 'mike' = GM/admin
/* ?anon=1 renders the signed-out screen. App decides that from a failed /me
   request, which needs a server, so the harness mounts LoginPage directly. */
const anon = params.get('anon') === '1';

const library = seedLibrary();
const campaign = seedCampaign();
const memberships = seedMemberships();
const characters = seedCharacters();
const sheets = seedSheets();

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

const bootstrap: CampaignBootstrap = {
  campaign,
  membership,
  members: memberships,
  users,
  characters,
  party: seedParty(),
  bonds: seedBonds(),
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
};

const me: MeResponse = {
  user: {
    Id: userId,
    Name: users.find((u) => u.Id === userId)!.Name,
    Email: `${as}@asohav.dev`,
    IsAdmin: as === 'mike' || as === 'ryan',
  },
  memberships: memberships
    .filter((m) => m.UserId === userId)
    .map((m) => ({ ...m, CampaignName: campaign.Name })),
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
  campaign: { Id: 'cm-3', Name: 'Seelie', GmUserId: SEED_USER_IDS.ryan, CreatedAt: new Date().toISOString() },
  membership: chargenMembership,
  members: [chargenMembership, { Id: 'mb-chargen-gm', UserId: SEED_USER_IDS.ryan, CampaignId: 'cm-3', Role: 'GM', CharacterId: null }],
  users,
  characters: [],
  party: { Id: 'pt-chargen', CampaignId: 'cm-3', Rapport: 0, RapportAdvancementsTaken: [], History: [], UpdatedAt: new Date().toISOString(), UpdatedBy: null },
  bonds: [],
  invites: [],
  mySheet: null,
  peekSheets: {},
  peekSummaries: {},
};

queryClient.setQueryData(['me'], me);
queryClient.setQueryData(['library'], library);
queryClient.setQueryData(['bootstrap', campaign.Id], bootstrap);
queryClient.setQueryData(['bootstrap', 'cm-3'], chargenBootstrap);
queryClient.setQueryData(['invites', 'mine'], myInvites);
queryClient.setQueryDefaults(['invites'], { staleTime: Infinity });
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
