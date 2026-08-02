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
} from '@asohav/shared';
import { queryClient } from './lib/queryClient.js';
import App from './App.js';
import './styles/tokens.css';

const params = new URLSearchParams(location.search);
const route = params.get('route') ?? '/';
const as = params.get('as') ?? 'ryan'; // 'ryan' = player, 'mike' = GM/admin

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

queryClient.setQueryData(['me'], me);
queryClient.setQueryData(['library'], library);
queryClient.setQueryData(['bootstrap', campaign.Id], bootstrap);
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
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
