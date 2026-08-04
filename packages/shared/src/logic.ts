import type {
  Bond,
  BondChangeType,
  BondPendingChange,
  Character,
  CharacterSheet,
  CharacterSummary,
  Condition,
  Item,
  Library,
  LoadTierDef,
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

/** Advancement tiers unlock on count of advancements taken alone: Tier 2 at 4, Tier 3 at 7, Tier 4 at 10. */
export function unlockedTier(takenCount: number): 1 | 2 | 3 | 4 {
  if (takenCount >= 10) return 4;
  if (takenCount >= 7) return 3;
  if (takenCount >= 4) return 2;
  return 1;
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
  return sheet.Statuses.filter((s) => s.Polarity !== 'Positive').reduce((n, s) => n + s.Rank, 0);
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

/** Spending Kin is unilateral — either partner may do it without the other's approval (the
 * game's rules text says "either PC ... can spend Kin", unlike Forging, which needs both to
 * agree), so it applies immediately rather than going through the propose/accept handshake.
 * Mutates `bond` in place; returns a short detail string for the log. */
export function applySpendKin(bond: Bond, delta = 1): string {
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
