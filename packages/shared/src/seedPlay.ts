import type { Bond, Campaign, Character, CharacterSheet, Membership, Party, VirtueValue } from './types.js';
import { nowIso } from './logic.js';

/**
 * Demo campaign seed, ported from design/_shared/store.js `seed()`.
 * User accounts themselves (email/password) are seeded separately by the server —
 * this only carries the play-state shape the prototype demonstrated.
 */

export const SEED_CAMPAIGN_ID = 'cm-1';

export const SEED_USER_IDS = {
  mike: 'u-mike', // GM
  ryan: 'u-ryan',
  sam: 'u-sam',
  ivy: 'u-ivy',
  dax: 'u-dax',
} as const;

export function seedCampaign(): Campaign {
  return { Id: SEED_CAMPAIGN_ID, Name: 'The Long Road South', GmUserId: SEED_USER_IDS.mike, CreatedAt: nowIso() };
}

export function seedMemberships(): Membership[] {
  const c = SEED_CAMPAIGN_ID;
  return [
    { Id: 'mb-1', UserId: SEED_USER_IDS.mike, CampaignId: c, Role: 'GM', CharacterId: null },
    { Id: 'mb-2', UserId: SEED_USER_IDS.ryan, CampaignId: c, Role: 'Player', CharacterId: 'ch-ember' },
    { Id: 'mb-3', UserId: SEED_USER_IDS.sam, CampaignId: c, Role: 'Player', CharacterId: 'ch-matryoshka' },
    { Id: 'mb-4', UserId: SEED_USER_IDS.ivy, CampaignId: c, Role: 'Player', CharacterId: 'ch-oleander' },
    { Id: 'mb-5', UserId: SEED_USER_IDS.dax, CampaignId: c, Role: 'Player', CharacterId: 'ch-frostbite' },
  ];
}

export function seedCharacters(): Character[] {
  const c = SEED_CAMPAIGN_ID;
  return [
    { Id: 'ch-ember', Name: 'Ember', PlayerName: 'Ryan', UserId: SEED_USER_IDS.ryan, CampaignId: c },
    { Id: 'ch-matryoshka', Name: 'Matryoshka', PlayerName: 'Sam', UserId: SEED_USER_IDS.sam, CampaignId: c },
    { Id: 'ch-oleander', Name: 'Oleander', PlayerName: 'Ivy', UserId: SEED_USER_IDS.ivy, CampaignId: c },
    { Id: 'ch-frostbite', Name: 'Frostbite', PlayerName: 'Dax', UserId: SEED_USER_IDS.dax, CampaignId: c },
  ];
}

function virtues(scores: number[], marked: string[]): VirtueValue[] {
  const ids = ['v-might', 'v-mettle', 'v-heart', 'v-wit', 'v-guile'];
  return ids.map((id, i) => ({ VirtueId: id, Score: scores[i], ConditionMarked: marked.includes(id) }));
}

export function seedSheets(): CharacterSheet[] {
  const t = nowIso();
  return [
    {
      Id: 'sh-ch-ember', CharacterId: 'ch-ember',
      Looks: 'Soot-stained coat, close-cropped hair, hands that never stop moving.',
      Virtues: virtues([1, 0, 2, 0, -1], ['v-heart']),
      Statuses: [
        { Id: 'st-1', Name: 'Rattled', Rank: 2, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
        { Id: 'st-2', Name: 'Prepared', Rank: 2, Polarity: 'Positive', LinkedToIds: [], AffectedByIds: [] },
        { Id: 'st-3', Name: 'Indebted to the ferryman', Rank: 1, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
      ],
      Armor: [
        { Id: 'ar-1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
        { Id: 'ar-2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
        { Id: 'ar-3', ArmorTypeId: 'a-special', Used: false, SourceId: 'i-wardstone', SourceLabel: 'Ward-stone' },
      ],
      Theme: { ThemeId: 't-debt', AcceptedQuests: [
        { QuestId: 'q-debt-2', Completed: false, AcceptedAt: t },
        { QuestId: 'q-debt-3', Completed: false, AcceptedAt: t },
      ] },
      Load: { Tier: 'Normal', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-lantern', Carried: true, ChargesUsed: 1 },
        { ItemId: 'i-poultice', Carried: false, ChargesUsed: 2 }, { ItemId: 'i-rope', Carried: false, ChargesUsed: 0 },
        { ItemId: 'i-wardstone', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rations', Carried: false, ChargesUsed: 0 },
      ],
      AbilityIds: ['ab-ironclad', 'ab-readall'], SkillIds: ['s-protect'],
      Advancement: { Potential: 3, PotentialAdvancementsTaken: [], History: [] },
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-matryoshka', CharacterId: 'ch-matryoshka',
      Looks: 'Layered coats, nothing underneath you were meant to see.',
      Virtues: virtues([-1, 2, 0, 1, 0], []),
      Statuses: [{ Id: 'st-m1', Name: 'Sharp', Rank: 1, Polarity: 'Positive', LinkedToIds: [], AffectedByIds: [] }],
      Armor: [{ Id: 'ar-m1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' }],
      Theme: { ThemeId: 't-exile', AcceptedQuests: [{ QuestId: 'q-exile-2', Completed: false, AcceptedAt: t }] },
      Load: { Tier: 'Light', LatchedUntilCamp: false },
      Items: [{ ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-toolkit', Carried: true, ChargesUsed: 1 }],
      AbilityIds: ['ab-quiet'], SkillIds: ['s-trained'],
      Advancement: { Potential: 1, PotentialAdvancementsTaken: [], History: [] },
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-oleander', CharacterId: 'ch-oleander',
      Looks: 'Tall, grey-eyed, a sword she has never once drawn in anger.',
      Virtues: virtues([0, -1, 1, 2, 0], ['v-mettle', 'v-wit']),
      Statuses: [
        { Id: 'st-o1', Name: 'Exposed', Rank: 3, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
        { Id: 'st-o2', Name: 'Indebted to the ferryman', Rank: 1, Polarity: 'Negative', LinkedToIds: [], AffectedByIds: [] },
      ],
      Armor: [
        { Id: 'ar-o1', ArmorTypeId: 'a-heavy', Used: true, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
        { Id: 'ar-o2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
      ],
      Theme: { ThemeId: 't-oath', AcceptedQuests: [
        { QuestId: 'q-oath-1', Completed: true, AcceptedAt: t },
        { QuestId: 'q-oath-2', Completed: false, AcceptedAt: t },
      ] },
      Load: { Tier: 'Heavy', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-banner', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-rations', Carried: true, ChargesUsed: 0 },
      ],
      AbilityIds: ['ab-ward'], SkillIds: ['s-ward'],
      Advancement: { Potential: 4, PotentialAdvancementsTaken: [], History: [] },
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-frostbite', CharacterId: 'ch-frostbite',
      Looks: 'Broad, quiet, carrying someone else’s axe.',
      Virtues: virtues([2, 1, -1, 0, 0], ['v-might']),
      Statuses: [],
      Armor: [
        { Id: 'ar-f1', ArmorTypeId: 'a-heavy', Used: false, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
        { Id: 'ar-f2', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
        { Id: 'ar-f3', ArmorTypeId: 'a-physical', Used: false, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
      ],
      Theme: { ThemeId: 't-inheritance', AcceptedQuests: [{ QuestId: 'q-inh-1', Completed: false, AcceptedAt: t }] },
      Load: { Tier: 'Normal', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rope', Carried: true, ChargesUsed: 0 },
      ],
      AbilityIds: ['ab-ironclad', 'ab-resolve'], SkillIds: ['s-martyr'],
      Advancement: { Potential: 0, PotentialAdvancementsTaken: [], History: [] },
      CreatedAt: t, UpdatedAt: t,
    },
  ];
}

export function seedParty(): Party {
  return { Id: 'pt-1', CampaignId: SEED_CAMPAIGN_ID, Rapport: 3, RapportAdvancementsTaken: [], History: [], UpdatedAt: nowIso(), UpdatedBy: SEED_USER_IDS.sam };
}

export function seedBonds(): Bond[] {
  const c = SEED_CAMPAIGN_ID, t = nowIso();
  return [
    { Id: 'bd-1', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-matryoshka', KinTrack: 4, BondLevel: 1,
      BondMoves: [{ Level: 1, Text: 'When we fight back to back, the first hit against either of us hits neither.', AuthoredAt: t }],
      PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-2', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-oleander', KinTrack: 2, BondLevel: 0, BondMoves: [],
      PendingChange: { Id: 'pc-1', ProposedBy: 'ch-oleander', Type: 'MarkKin', Payload: { Delta: 1 }, Note: 'You talked me down from the bridge.', ProposedAt: t },
      History: [], UpdatedAt: t },
    { Id: 'bd-3', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-frostbite', KinTrack: 0, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-4', CampaignId: c, CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-oleander', KinTrack: 5, BondLevel: 2, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-5', CampaignId: c, CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-frostbite', KinTrack: 1, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-6', CampaignId: c, CharacterAId: 'ch-oleander', CharacterBId: 'ch-frostbite', KinTrack: 3, BondLevel: 1, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
  ];
}
