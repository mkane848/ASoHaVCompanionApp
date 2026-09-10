import type { Bond, Campaign, Character, CharacterSheet, Invite, Membership, Party, VirtueValue } from './types.js';
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
  rob: 'u-rob',
  dave: 'u-dave',
  tyler: 'u-tyler',
} as const;

export function seedCampaign(): Campaign {
  return { Id: SEED_CAMPAIGN_ID, Name: 'The Long Road South', GmUserId: SEED_USER_IDS.mike, CreatedAt: nowIso(), Status: 'Active', Phase: 'Playing' };
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
    { Id: 'ch-ember', Name: 'Ember', Pronouns: 'she/her', PlayerName: 'Ryan', UserId: SEED_USER_IDS.ryan, CampaignId: c },
    { Id: 'ch-matryoshka', Name: 'Matryoshka', Pronouns: 'they/them', PlayerName: 'Sam', UserId: SEED_USER_IDS.sam, CampaignId: c },
    { Id: 'ch-oleander', Name: 'Oleander', Pronouns: 'she/her', PlayerName: 'Ivy', UserId: SEED_USER_IDS.ivy, CampaignId: c },
    { Id: 'ch-frostbite', Name: 'Frostbite', Pronouns: 'he/him', PlayerName: 'Dax', UserId: SEED_USER_IDS.dax, CampaignId: c },
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
      Looks: 'Soot-stained coat\nClose-cropped hair\nHands that never stop moving.',
      Virtues: virtues([1, 0, 2, 0, -1], ['v-heart']),
      // V0.6 slice 1: Strain[i] is box i+1 (see CharacterSheet in types.ts); a Status is now a
      // named severity-slot injury, and a ranked Positive Status becomes a Boon.
      Strain: [false, true, false, false, false],
      Statuses: [{ Id: 'st-1', Severity: 'Minor', Name: 'Twisted Ankle', Description: 'Turned it scrambling down the ravine.' }],
      HealingTrack: 0,
      Boons: ['Prepared'],
      Banes: ['Indebted to the ferryman'],
      Armor: [
        { Id: 'ar-1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
        { Id: 'ar-2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
        { Id: 'ar-3', ArmorTypeId: 'a-special', Used: false, SourceId: 'i-wardstone', SourceLabel: 'Ward-stone' },
      ],
      Motifs: [
        { MotifId: 'mo-inheritor', Name: 'Inheritor', SkillTags: ['Royal Family'], FlawTags: ['Exiled'], Potential: 3, Quest: 'Prove my worth to my family', ActBreaks: 1, Forsakes: 0 },
        { MotifId: 'mo-sworn', Name: 'Sworn', SkillTags: ['Tracker'], FlawTags: ['Stripped of Honor'], Potential: 0, Quest: 'Capture the Chosen One', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-mystic', Name: 'Mystic', SkillTags: ['Fire Sorcerer'], FlawTags: ['Hot-Headed'], Potential: 0, Quest: 'Defeat my sister', ActBreaks: 0, Forsakes: 0 },
      ],
      Load: { Tier: 'Normal', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-lantern', Carried: true, ChargesUsed: 1 },
        { ItemId: 'i-poultice', Carried: false, ChargesUsed: 2 }, { ItemId: 'i-rope', Carried: false, ChargesUsed: 0 },
        { ItemId: 'i-wardstone', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rations', Carried: false, ChargesUsed: 0 },
      ],
      // Slice 5: a wildcard declaration, Persistent — plot-relevant enough it keeps costing this
      // box past every future Make Camp rather than returning to the ether.
      WildcardDeclarations: [{ Id: 'wc-ember-1', Text: "Her mother's signet ring", Persistent: true }],
      Advancement: { History: [] },
      Improvements: [], Level: 0,
      Scars: [], Wealth: 0, Treasure: 0, Hold: 0,
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-matryoshka', CharacterId: 'ch-matryoshka',
      Looks: 'Layered coats\nNothing underneath you were meant to see.',
      Virtues: virtues([-1, 2, 0, 1, 0], []),
      Strain: [false, false, false, false, false],
      Statuses: [],
      HealingTrack: 0,
      Boons: ['Sharp'],
      Banes: [],
      Armor: [{ Id: 'ar-m1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' }],
      Motifs: [
        { MotifId: 'mo-exalted', Name: 'Exalted/Lowly', SkillTags: ['Royal Spymaster'], FlawTags: ['Mistaken for a Servant'], Potential: 1, Quest: 'Reclaim my family’s honor', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-sage', Name: 'Sage', SkillTags: ['Investigator'], FlawTags: ['Can’t Leave a Mystery Unsolved'], Potential: 0, Quest: 'Learn who really cast me out', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-forged', Name: 'Forged', SkillTags: ['Nothing Left to Lose'], FlawTags: ['I Left Someone Behind'], Potential: 0, Quest: 'Make a place that cannot exile me', ActBreaks: 0, Forsakes: 1 },
      ],
      Load: { Tier: 'Light', LatchedUntilCamp: false },
      Items: [{ ItemId: 'i-bootknife', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-toolkit', Carried: true, ChargesUsed: 1 }],
      WildcardDeclarations: [],
      Advancement: { History: [] },
      Improvements: [], Level: 0,
      Scars: [], Wealth: 0, Treasure: 0, Hold: 0,
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-oleander', CharacterId: 'ch-oleander',
      Looks: 'Tall\nGrey-eyed\nA sword she has never once drawn in anger.',
      Virtues: virtues([0, -1, 1, 2, 0], ['v-mettle', 'v-wit']),
      Strain: [true, false, false, false, false],
      Statuses: [{ Id: 'st-o1', Severity: 'Major', Name: 'Exposed', Description: 'Everyone in the square saw what she did.' }],
      HealingTrack: 2,
      Boons: [],
      Banes: ['Indebted to the ferryman'],
      Armor: [
        { Id: 'ar-o1', ArmorTypeId: 'a-heavy', Used: true, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
        { Id: 'ar-o2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
      ],
      Motifs: [
        { MotifId: 'mo-sworn', Name: 'Sworn', SkillTags: ['Sacred Warden'], FlawTags: ['Cannot Break My Word'], Potential: 4, Quest: 'Keep the oath when it costs me dearly', ActBreaks: 2, Forsakes: 0 },
        { MotifId: 'mo-inheritor', Name: 'Inheritor', SkillTags: ['Heir to the Witch-Queens'], FlawTags: ['Unwanted Inheritance'], Potential: 0, Quest: 'Choose who receives it next', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-exemplar', Name: 'Exemplar', SkillTags: ['Born Leader'], FlawTags: ['Won’t Admit Fear'], Potential: 0, Quest: 'Find the person I swore to', ActBreaks: 0, Forsakes: 0 },
      ],
      Load: { Tier: 'Heavy', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-banner', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-rations', Carried: true, ChargesUsed: 0 },
      ],
      WildcardDeclarations: [],
      Advancement: { History: [] },
      Improvements: [], Level: 0,
      Scars: [{ Id: 'scar-o1', Text: 'A jagged line across one palm — the day the oath was sworn.', At: t }],
      Wealth: 0, Treasure: 0, Hold: 0,
      CreatedAt: t, UpdatedAt: t,
    },
    {
      Id: 'sh-ch-frostbite', CharacterId: 'ch-frostbite',
      Looks: 'Broad\nQuiet\nCarrying someone else’s axe.',
      Virtues: virtues([2, 1, -1, 0, 0], ['v-might']),
      Strain: [false, false, false, false, false],
      Statuses: [],
      HealingTrack: 0,
      Boons: [],
      Banes: [],
      Armor: [
        { Id: 'ar-f1', ArmorTypeId: 'a-heavy', Used: false, SourceId: 'i-mail', SourceLabel: 'Coat of mail' },
        { Id: 'ar-f2', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
        { Id: 'ar-f3', ArmorTypeId: 'a-physical', Used: false, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
      ],
      Motifs: [
        { MotifId: 'mo-forged', Name: 'Forged', SkillTags: ['Forged in War'], FlawTags: ['Afraid It Will Happen Again'], Potential: 0, Quest: 'Use the axe the way they would have', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-exemplar', Name: 'Exemplar', SkillTags: ['Built to Endure'], FlawTags: ['Never Asks for Help'], Potential: 0, Quest: 'Learn what they did with it', ActBreaks: 0, Forsakes: 0 },
        { MotifId: 'mo-mythic', Name: 'Mythic', SkillTags: ['Giantkin Might'], FlawTags: ['Feared on Sight'], Potential: 0, Quest: 'Put it down', ActBreaks: 0, Forsakes: 0 },
      ],
      Load: { Tier: 'Normal', LatchedUntilCamp: false },
      Items: [
        { ItemId: 'i-sword', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-mail', Carried: true, ChargesUsed: 0 },
        { ItemId: 'i-shield', Carried: true, ChargesUsed: 0 }, { ItemId: 'i-rope', Carried: true, ChargesUsed: 0 },
      ],
      // Ordinary — returns to the ether next Make Camp, unlike Ember's persistent signet ring.
      WildcardDeclarations: [{ Id: 'wc-frostbite-1', Text: 'A spare torch', Persistent: false }],
      Advancement: { History: [] },
      Improvements: [], Level: 0,
      Scars: [], Wealth: 0, Treasure: 0, Hold: 0,
      CreatedAt: t, UpdatedAt: t,
    },
  ];
}

export function seedParty(): Party {
  return {
    Id: 'pt-1',
    CampaignId: SEED_CAMPAIGN_ID,
    Rapport: 3,
    RapportImprovementsTaken: [],
    History: [],
    PartyLevel: 0,
    Motif: '',
    Quest: '',
    SkillTags: [],
    WeaknessTags: [],
    Path: '',
    Goal: '',
    CampAssets: [],
    UpdatedAt: nowIso(),
    UpdatedBy: SEED_USER_IDS.sam,
  };
}

// ---------- Second demo campaign: exercises the invite/join flow ----------
// "Seelie" seeds a GM (ryan) and a Pending invite (mike) but no memberships/character for
// mike yet — landing him on the pending-invite + character-creation flow on first login,
// rather than the fully-populated "The Long Road South" demo above.

export const SEED_CAMPAIGN_ID_SEELIE = 'cm-2';

export function seedSeelieCampaign(): Campaign {
  // PartyCreation (not Signup) so the pending invite for mike lands on chargen immediately on
  // accept, demonstrating the full invite -> accept -> create-character flow without an extra
  // "GM closes signup" step in the seed data itself.
  return { Id: SEED_CAMPAIGN_ID_SEELIE, Name: 'Seelie', GmUserId: SEED_USER_IDS.ryan, CreatedAt: nowIso(), Status: 'Active', Phase: 'PartyCreation' };
}

export function seedSeelieMemberships(): Membership[] {
  return [{ Id: 'mb-6', UserId: SEED_USER_IDS.ryan, CampaignId: SEED_CAMPAIGN_ID_SEELIE, Role: 'GM', CharacterId: null }];
}

export function seedSeelieInvites(): Invite[] {
  return [
    {
      Id: 'inv-1',
      CampaignId: SEED_CAMPAIGN_ID_SEELIE,
      Email: 'mike@asohav.dev',
      Code: 'ROAD-4242',
      SentAt: nowIso(),
      Status: 'Pending',
    },
  ];
}

export function seedBonds(): Bond[] {
  const c = SEED_CAMPAIGN_ID, t = nowIso();
  return [
    { Id: 'bd-1', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-matryoshka', BondTrack: 4, BondLevel: 1,
      BondMoves: [{ Level: 1, Text: 'When we fight back to back, the first hit against either of us hits neither.', AuthoredAt: t }],
      PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-2', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-oleander', BondTrack: 2, BondLevel: 0, BondMoves: [],
      PendingChange: { Id: 'pc-1', ProposedBy: 'ch-oleander', Type: 'MarkBond', Payload: { Delta: 1 }, Note: 'You talked me down from the bridge.', ProposedAt: t },
      History: [], UpdatedAt: t },
    { Id: 'bd-3', CampaignId: c, CharacterAId: 'ch-ember', CharacterBId: 'ch-frostbite', BondTrack: 0, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-4', CampaignId: c, CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-oleander', BondTrack: 5, BondLevel: 2, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-5', CampaignId: c, CharacterAId: 'ch-matryoshka', CharacterBId: 'ch-frostbite', BondTrack: 1, BondLevel: 0, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
    { Id: 'bd-6', CampaignId: c, CharacterAId: 'ch-oleander', CharacterBId: 'ch-frostbite', BondTrack: 3, BondLevel: 1, BondMoves: [], PendingChange: null, History: [], UpdatedAt: t },
  ];
}
