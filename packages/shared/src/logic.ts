import type {
  Bond,
  BondChangeType,
  BondPendingChange,
  Campaign,
  CampaignPhase,
  Character,
  CharacterSheet,
  CharacterSummary,
  Condition,
  GameSettings,
  Invite,
  Item,
  Library,
  LoadTierDef,
  Membership,
} from './types.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(prefix = 'x'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/** score + (marked ? RollPenalty : 0), floored at ConditionFloor (default -3). */
export function effectiveVirtueScore(score: number, conditionMarked: boolean, rollPenalty: number, floor = -3): number {
  return Math.max(score + (conditionMarked ? rollPenalty : 0), floor);
}

/** Capacity = BaseCapacity + Might. Confirmed addition, not multiplication (Issue 2). */
export function loadCapacityFor(tierKey: string, loadTiers: LoadTierDef[], mightScore: number): number {
  const t = loadTiers.find((x) => x.Key === tierKey);
  return t ? t.Base + mightScore : 0;
}

export function carriedLoad(sheet: CharacterSheet, items: Item[]): number {
  return sheet.Items.filter((ci) => ci.Carried).reduce((n, ci) => {
    const it = items.find((x) => x.Id === ci.ItemId);
    return n + (it ? it.LoadCost : 0);
  }, 0);
}

/** Advancement tiers unlock on count of advancements taken alone. Thresholds default to the
 *  historical hardcoded 4/7/10 but are configurable via `GameSettings` (Content Admin -> Game
 *  Settings) — pass `library.settings` explicitly rather than relying on the default once a
 *  `Library` is in scope. */
export function unlockedTier(
  takenCount: number,
  thresholds: { Tier2: number; Tier3: number; Tier4: number } = { Tier2: 4, Tier3: 7, Tier4: 10 },
): 1 | 2 | 3 | 4 {
  if (takenCount >= thresholds.Tier4) return 4;
  if (takenCount >= thresholds.Tier3) return 3;
  if (takenCount >= thresholds.Tier2) return 2;
  return 1;
}

/** Reads the three tier thresholds off `GameSettings` in the shape `unlockedTier` expects. */
export function advancementTierThresholds(settings: GameSettings): { Tier2: number; Tier3: number; Tier4: number } {
  return { Tier2: settings.AdvancementTier2At, Tier3: settings.AdvancementTier3At, Tier4: settings.AdvancementTier4At };
}

/** Quantises a raw count into the 4-tier damage scale used for the parchment-damage overlay. */
export function damageTier(rawCount: number, perTier: number): 0 | 1 | 2 | 3 | 4 {
  if (rawCount <= 0) return 0;
  return Math.min(4, Math.ceil(rawCount / perTier)) as 0 | 1 | 2 | 3 | 4;
}

export const DAMAGE_TIER_OPACITY = [0, 0.16, 0.31, 0.46, 0.62] as const;

export function markedConditionCount(sheet: CharacterSheet): number {
  return sheet.Virtues.filter((v) => v.ConditionMarked).length;
}

export function negativeStatusRankTotal(sheet: CharacterSheet): number {
  return sheet.Statuses.filter((s) => s.Polarity === 'Negative').reduce((n, s) => n + s.Rank, 0);
}

export function isDishonored(sheet: CharacterSheet): boolean {
  return markedConditionCount(sheet) >= 5;
}

/** Derived GM live-peek summary — computed from the real sheet, never a second stored copy. */
export function summaryFor(character: Character, sheet: CharacterSheet, library: Library): CharacterSummary {
  const conds: Condition[] = library.conditions;
  const marked = sheet.Virtues.filter((v) => v.ConditionMarked).map((v) => {
    const c = conds.find((x) => x.VirtueId === v.VirtueId);
    return c ? c.Name : v.VirtueId;
  });
  const tier = library.loadTiers.find((t) => t.Key === sheet.Load.Tier);
  const might = sheet.Virtues.find((v) => v.VirtueId === 'v-might')?.Score ?? 0;
  const capacity = tier ? tier.Base + might : 0;
  const carried = carriedLoad(sheet, library.items);
  const theme = library.themes.find((t) => t.Id === sheet.Theme.ThemeId);
  return {
    Id: character.Id,
    Name: character.Name,
    PlayerName: character.PlayerName,
    Theme: theme ? theme.Name : '—',
    Virtues: sheet.Virtues,
    ConditionsMarked: marked,
    Statuses: sheet.Statuses,
    Load: { Tier: sheet.Load.Tier, Carried: carried, Capacity: capacity },
    Potential: sheet.Advancement.Potential,
    ArmorReady: sheet.Armor.filter((a) => !a.Used).length,
    ArmorTotal: sheet.Armor.length,
  };
}

/** Pip helper: tapping pip n sets rank to n; tapping the currently-filled pip drops to n-1. */
export function nextPipValue(currentFilled: number, tappedIndex: number): number {
  return currentFilled === tappedIndex ? tappedIndex - 1 : tappedIndex;
}

// ---------- Bond handshake ----------

export class BondHandshakeError extends Error {}

export function assertCanPropose(bond: Bond) {
  if (bond.PendingChange) {
    throw new BondHandshakeError('That Bond already has a change awaiting confirmation.');
  }
}

/** How many of `bonds` have a change awaiting `myCharacterId`'s own confirmation — proposed by
 * the other party on a Bond this character is part of. Backs the pending-confirmation badge
 * wherever it appears (Campaign Shell, the sheet's Kin & Bonds section). */
export function pendingBondCountFor(bonds: Bond[], myCharacterId: string): number {
  return bonds.filter(
    (b) =>
      (b.CharacterAId === myCharacterId || b.CharacterBId === myCharacterId) &&
      b.PendingChange &&
      b.PendingChange.ProposedBy !== myCharacterId,
  ).length;
}

export function buildProposal(proposerCharId: string, type: BondChangeType, payload: BondPendingChange['Payload'], note?: string): BondPendingChange {
  return {
    Id: newId('pc'),
    ProposedBy: proposerCharId,
    Type: type,
    Payload: payload || {},
    Note: note || '',
    ProposedAt: nowIso(),
  };
}

/** Advancements.md: "When you place your 5th Kin at Bond 5, your Bond Level locks and can not be
 *  moved down. You can no longer spend Kin on that track." A maxed Bond (Level 5, Kin Track full)
 *  is locked — no stored field needed, it's fully derived from the two numbers already on `Bond`. */
export function isBondLocked(bond: Bond): boolean {
  return bond.BondLevel >= 5 && bond.KinTrack >= 5;
}

/** Spending Kin is unilateral — either partner may do it without the other's approval (the
 * game's rules text says "either PC ... can spend Kin", unlike Forging, which needs both to
 * agree), so it applies immediately rather than going through the propose/accept handshake.
 * Mutates `bond` in place; returns a short detail string for the log. Throws `BondHandshakeError`
 * if the Bond is locked (see `isBondLocked`) rather than silently dropping it back below Level 5. */
export function applySpendKin(bond: Bond, delta = 1): string {
  if (isBondLocked(bond)) {
    throw new BondHandshakeError('This Bond is locked at Level 5 with a full Kin Track — Kin can no longer be spent on it.');
  }
  bond.KinTrack = bond.KinTrack - delta;
  if (bond.KinTrack < 0) {
    bond.BondLevel = Math.max(0, bond.BondLevel - 1);
    bond.KinTrack = 4;
  }
  return 'Kin now ' + bond.KinTrack;
}

/** Mutates `bond` in place per the accepted proposal's type. Returns a short detail string for the log. */
export function resolveAcceptedBond(bond: Bond): string {
  const p = bond.PendingChange;
  if (!p) return '';
  let detail = '';
  if (p.Type === 'MarkKin') {
    bond.KinTrack = Math.min(5, bond.KinTrack + (p.Payload.Delta || 1));
    detail = 'Kin now ' + bond.KinTrack;
  } else if (p.Type === 'SpendKin') {
    // No longer reachable via the normal UI (SpendKin applies immediately — see
    // applySpendKin above) — kept so a proposal created before that change can still resolve.
    detail = applySpendKin(bond, p.Payload.Delta || 1);
  } else if (p.Type === 'ForgeBond') {
    bond.BondLevel = Math.min(5, bond.BondLevel + 1);
    bond.KinTrack = 0;
    bond.BondMoves = (bond.BondMoves || []).concat([{ Level: bond.BondLevel, Text: p.Payload.Text || '', AuthoredAt: nowIso() }]);
    detail = 'Bond Level ' + bond.BondLevel;
  }
  bond.PendingChange = null;
  bond.UpdatedAt = nowIso();
  return detail;
}

// ---------- Character creation ----------

/** The game's five canonical starting Virtue arrays, confirmed directly with the repo owner — a
 * new character picks one, then assigns its five values across the five Virtues however they
 * like, rather than free-allocating points. (seedPlay.ts's premade characters predate this list
 * and use an older single array retired below; that's fine, since this multiset is only ever
 * checked at character-creation time — see isStandardVirtueArray's one call site in
 * apps/server/src/routes/characters.ts.) */
export const STANDARD_VIRTUE_ARRAYS: readonly (readonly number[])[] = [
  [2, 1, 1, 0, -1],
  [2, 2, 1, -1, -1],
  [2, 1, 0, 0, 0],
  [1, 1, 1, 1, -1],
  [1, 1, 1, 0, 0],
] as const;

function matchesMultiset(scores: number[], candidate: readonly number[]): boolean {
  if (scores.length !== candidate.length) return false;
  const remaining: number[] = [...candidate];
  for (const s of scores) {
    const i = remaining.indexOf(s);
    if (i === -1) return false;
    remaining.splice(i, 1);
  }
  return true;
}

export function isStandardVirtueArray(scores: number[]): boolean {
  return STANDARD_VIRTUE_ARRAYS.some((candidate) => matchesMultiset(scores, candidate));
}

// ---------- Invite redemption ----------

export class InviteError extends Error {}

function normalizedEmail(e: string): string {
  return e.trim().toLowerCase();
}

// ---------- Campaign archive freeze ----------

export class CampaignArchivedError extends Error {}

/** Every mutating route that touches a campaign's play state (invites, Bond propose/accept/
 * reject, sheet edits, party edits, character creation) calls this after loading the campaign.
 * Archiving is a GM action, not an admin one — see routes/campaign.ts's PATCH /:id/status. */
export function assertCampaignActive(campaign: Campaign) {
  if (campaign.Status === 'Archived') {
    throw new CampaignArchivedError('This campaign is archived. Unarchive it before making changes.');
  }
}

/** Shared precondition for both redeeming and declining an invite: it must still be Pending,
 * and it must be addressed to the acting user's own email (case-insensitively) — a code alone
 * isn't enough to join, since invites are per-recipient. Throws InviteError to abort. */
export function assertInviteActionable(invite: Invite, userEmail: string) {
  if (invite.Status !== 'Pending') {
    throw new InviteError(`This invite has already been ${invite.Status.toLowerCase()}.`);
  }
  if (normalizedEmail(invite.Email) !== normalizedEmail(userEmail)) {
    throw new InviteError('This invite was sent to a different email address.');
  }
}

// ---------- Campaign setup workflow (Signup -> PartyCreation -> Playing) ----------

/** Treat a campaign with no `Phase` set as `'PartyCreation'` — matches the DB migration's
 *  backfill default for rows that predate this field, so an already-running campaign keeps
 *  letting a newly-invited player create a character rather than being retroactively locked out. */
export function campaignPhase(campaign: Campaign): CampaignPhase {
  return campaign.Phase ?? 'PartyCreation';
}

export class PartyCreationRequiredError extends Error {}

/** Character creation (the multi-field chargen flow) only opens once the GM has closed signup
 *  and moved the campaign into the Party Creation phase — called from routes/characters.ts. */
export function assertPartyCreationPhase(campaign: Campaign) {
  if (campaignPhase(campaign) !== 'PartyCreation') {
    throw new PartyCreationRequiredError('Character creation is only open during the Party Creation phase.');
  }
}

/** Forward-only except PartyCreation can step back to Signup (the GM reopening signup after
 *  closing it early) — Playing is terminal for this control; archiving is a separate mechanism. */
export const CAMPAIGN_PHASE_TRANSITIONS: Record<CampaignPhase, CampaignPhase[]> = {
  Signup: ['PartyCreation'],
  PartyCreation: ['Signup', 'Playing'],
  Playing: [],
};

export class InvalidPhaseTransitionError extends Error {}

export function assertValidPhaseTransition(from: CampaignPhase, to: CampaignPhase) {
  if (!CAMPAIGN_PHASE_TRANSITIONS[from].includes(to)) {
    throw new InvalidPhaseTransitionError(`Cannot move a campaign from ${from} to ${to}.`);
  }
}

/** How many Player memberships (GMs don't have characters, so aren't counted) have marked
 *  themselves ready — backs the GM's "N / M ready" readout during Party Creation. */
export function partyReadiness(members: Membership[]): { ready: number; total: number } {
  const players = members.filter((m) => m.Role === 'Player');
  return { ready: players.filter((m) => m.Ready).length, total: players.length };
}

/** `Recoveries`/`Scars` were added to `CharacterSheet` in `0.13.0` with no backfill — a sheet
 *  saved before then is JSONB missing both keys entirely, which crashes any unguarded
 *  `sheet.Scars.length`/`.map()` read. Called from `repo.ts#getSheet` so every sheet read anywhere
 *  in the server (and by extension every client) sees a fully-populated shape, the same
 *  self-heal-on-read pattern `campaign.ts`'s bootstrap route already uses for a missing `Party`. */
export function normalizeSheet(sheet: CharacterSheet): CharacterSheet {
  return {
    ...sheet,
    Recoveries: sheet.Recoveries ?? 0,
    Scars: sheet.Scars ?? [],
    Wealth: sheet.Wealth ?? 0,
    Treasure: sheet.Treasure ?? 0,
    Hold: sheet.Hold ?? 0,
  };
}

/** Same self-heal-on-read pattern as `normalizeSheet`, applied to the `Library` singleton — a
 *  gap CLAUDE.md already called out as the general rule ("extend `normalizeSheet()` or add its
 *  equivalent") but never actually did for `Library`. `glossary` (`0.9.0`) and `enemies`
 *  (`0.14.0`) default to `[]`; the five `GameSettings` fields added across `0.13.0`/`0.14.0`
 *  default to the same values a fresh project is seeded with. Unlike a missing sheet field, a
 *  missing settings field doesn't crash — it silently breaks real gameplay math instead (new
 *  characters getting 0 Recoveries, the server-side Skill-count cap never triggering, Advancement
 *  Tier progression stuck at Tier 1 forever), which is worse: no error ever points back to the
 *  cause. Called from `repo.ts#getLibrary`. Preserves object identity when nothing needed
 *  backfilling, so callers can cheaply detect "did this need a write-back" the same way
 *  `getSheet` does for `Recoveries`/`Scars`. */
export function normalizeLibrary(library: Library): Library {
  const settings = library.settings;
  const settingsIncomplete =
    settings == null ||
    settings.SkillsAtCreation == null ||
    settings.AdvancementTier2At == null ||
    settings.AdvancementTier3At == null ||
    settings.AdvancementTier4At == null ||
    settings.RecoveriesMax == null;
  return {
    ...library,
    glossary: library.glossary ?? [],
    enemies: library.enemies ?? [],
    settings: settingsIncomplete
      ? {
          ...settings,
          SkillsAtCreation: settings?.SkillsAtCreation ?? 2,
          AdvancementTier2At: settings?.AdvancementTier2At ?? 4,
          AdvancementTier3At: settings?.AdvancementTier3At ?? 7,
          AdvancementTier4At: settings?.AdvancementTier4At ?? 10,
          RecoveriesMax: settings?.RecoveriesMax ?? 6,
        }
      : settings,
  };
}
