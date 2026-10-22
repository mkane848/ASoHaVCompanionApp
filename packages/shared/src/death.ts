/**
 * The Dying choice, the second Strain mark, Scars and the end of a Hero (V0.7 slice 8b,
 * Ruleset-V0.7.md L609-656; owner rulings of 2026-10-22, `docs/decisions.md`).
 *
 * Nothing here rolls anything. Risk Death's roll+Nothing happens at the table; the player reports
 * the tier (`RollTier`) and these functions apply the consequence, exactly as every other move in
 * the engine does. All functions mutate the sheet draft they are given (the same convention as
 * `applyMotifAdvanceBonus` in `logic.ts`), so a client `commit()` and a server route can share them.
 */
import { emptyMarks, secondStrainOpen, statusRank, takeStrainHit, type RollTier } from './engine.js';
import { newId } from './ids.js';
import type { CharacterSheet, DyingChoiceKind, HeroEnding, HeroEndingKind, Scar } from './types.js';

/** "If your Hero has three Scars and would mark a fourth, give them that final Scar and begin to
 *  retire your Hero" (L621). */
export const MAX_SCARS = 4;

/** Longest free text a Scar, last words, final achievement or retirement note may hold. */
export const MAX_DEATH_TEXT = 1000;

/** A request the rules refuse: the Hero is not Dying, has already chosen, is out of play, or the
 *  required text is missing. Routes map it to 409 (state) or 400 (input). */
export class DeathRuleError extends Error {
  readonly status: 400 | 409;
  constructor(message: string, status: 400 | 409 = 409) {
    super(message);
    this.name = 'DeathRuleError';
    this.status = status;
  }
}

/** Whether the Hero has left play (Dead or Retired): the sheet is read-only and Combat drops them. */
export function isHeroOut(sheet: { LifeState?: string }): boolean {
  return sheet.LifeState === 'Dead' || sheet.LifeState === 'Retired';
}

/** Ends Dying by hand or by Risk Death 10+: the choice and every second mark go with it. */
export function clearDyingState(sheet: CharacterSheet): void {
  sheet.Dying = false;
  sheet.DyingChoice = null;
  sheet.StrainSecond = emptyMarks(sheet.Strain.length);
}

/** "Remove 1 Strain" (Risk Death 10+, L638) = clear the highest marked box, a second-row mark before
 *  a first-row one (owner ruling 2026-10-22). Does nothing when no box is marked. */
export function removeOneStrain(sheet: CharacterSheet): void {
  const second = [...(sheet.StrainSecond ?? [])];
  const s2 = statusRank({ Marks: second });
  if (s2 > 0) {
    second[s2 - 1] = false;
    sheet.StrainSecond = second;
    return;
  }
  const first = [...sheet.Strain];
  const s1 = statusRank({ Marks: first });
  if (s1 > 0) {
    first[s1 - 1] = false;
    sheet.Strain = first;
  }
}

function end(sheet: CharacterSheet, state: 'Dead' | 'Retired', kind: HeroEndingKind, text: string, now: string): void {
  sheet.LifeState = state;
  sheet.Ending = { Kind: kind, Text: text, At: now } satisfies HeroEnding;
}

/** Lands a hit on a Hero (after Resist, Status and Armor have reduced it): Temporary box, then the
 *  first row, then — only while the second row is open — the second. A hit nothing can take makes the
 *  Hero Dying, or, with the second row already open, kills them (L650-652: "your Hero dies"). */
export function applyStrainToSheet(
  sheet: CharacterSheet,
  amount: number,
  boxes: number,
  now: string = new Date().toISOString(),
): { Outcome: 'Absorbed' | 'Dying' | 'Died' } {
  const open = secondStrainOpen(sheet);
  const hit = takeStrainHit(sheet.Strain, sheet.TempStrain ?? 0, amount, boxes, open ? sheet.StrainSecond : null);
  sheet.Strain = hit.Strain;
  sheet.TempStrain = hit.TempStrain;
  if (open) sheet.StrainSecond = hit.StrainSecond;
  if (!hit.Exhausted) return { Outcome: 'Absorbed' };
  if (open) {
    end(sheet, 'Dead', 'StrainDeath', '', now);
    return { Outcome: 'Died' };
  }
  sheet.Dying = true;
  return { Outcome: 'Dying' };
}

/** Records a Scar. The fourth is the last: the Hero is Retired, a state distinct from Dead (owner
 *  ruling 2026-10-22), with `note` as the retirement note. Returns whether that happened. */
export function addScar(sheet: CharacterSheet, text: string, now: string = new Date().toISOString(), note = ''): { Scar: Scar; Retired: boolean } {
  const scar: Scar = { Id: newId('scar'), Text: text.trim(), At: now };
  sheet.Scars = [...(sheet.Scars ?? []), scar];
  const retired = sheet.Scars.length >= MAX_SCARS;
  if (retired) end(sheet, 'Retired', 'FourthScar', note.trim(), now);
  return { Scar: scar, Retired: retired };
}

/** Scar reversal (L629: "Some Scars may be able to be reversed through great feats"): a manual
 *  removal. It never un-retires a Hero. Returns whether a Scar was removed. */
export function removeScar(sheet: CharacterSheet, scarId: string): boolean {
  const before = (sheet.Scars ?? []).length;
  sheet.Scars = (sheet.Scars ?? []).filter((s) => s.Id !== scarId);
  return sheet.Scars.length < before;
}

/** What a Dying Hero's player (or the GM) reports. Risk Death's `Tier` is what the table rolled. */
export type DyingChoiceInput =
  | { Choice: 'Scar'; ScarText: string; Note?: string }
  | { Choice: 'RiskDeath'; Tier: RollTier; ScarText?: string; Accept?: boolean; Text?: string; Note?: string }
  | { Choice: 'BlazeOfGlory'; Text: string };

export type DyingChoiceOutcome = 'ScarTaken' | 'Survived' | 'Died' | 'Retired';

function required(text: string | undefined, what: string): string {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) throw new DeathRuleError(`${what} is required.`, 400);
  if (t.length > MAX_DEATH_TEXT) throw new DeathRuleError(`${what} is too long.`, 400);
  return t;
}

function optional(text: string | undefined): string {
  const t = typeof text === 'string' ? text.trim() : '';
  if (t.length > MAX_DEATH_TEXT) throw new DeathRuleError('That text is too long.', 400);
  return t;
}

/** Applies the Dying choice (L615-656):
 *  - **Take a Scar**: record it; the Hero stays Dying and the second Strain marks unlock.
 *  - **Risk Death** at the reported tier: 10+ remove 1 Strain and stop being Dying; 7-9 the GM's Scar
 *    is accepted (recorded, still Dying, second marks unlock) or the Hero dies; 6- the Hero dies.
 *  - **Blaze of Glory**: the final achievement is recorded and the Hero dies.
 *  A fourth Scar from either route retires the Hero instead. Throws `DeathRuleError` when the Hero is
 *  out of play, not Dying, or has already chosen for this bout of Dying. */
export function applyDyingChoice(sheet: CharacterSheet, input: DyingChoiceInput, now: string = new Date().toISOString()): DyingChoiceOutcome {
  if (isHeroOut(sheet)) throw new DeathRuleError('This Hero is no longer in play.');
  if (!sheet.Dying) throw new DeathRuleError('Only a Dying Hero makes this choice.');
  if (sheet.DyingChoice) throw new DeathRuleError('This Hero has already made their Dying choice.');

  const choice: DyingChoiceKind = input.Choice;
  if (choice === 'BlazeOfGlory') {
    end(sheet, 'Dead', 'BlazeOfGlory', required((input as { Text?: string }).Text, 'The final heroic achievement'), now);
    return 'Died';
  }
  if (input.Choice === 'Scar') {
    const text = required(input.ScarText, 'The Scar');
    const note = optional(input.Note);
    sheet.DyingChoice = 'Scar';
    return addScar(sheet, text, now, note).Retired ? 'Retired' : 'ScarTaken';
  }
  if (input.Choice !== 'RiskDeath') throw new DeathRuleError('Unknown Dying choice.', 400);

  if (input.Tier === 'Tier3') {
    removeOneStrain(sheet);
    clearDyingState(sheet);
    return 'Survived';
  }
  if (input.Tier === 'Tier2') {
    if (input.Accept === false) {
      end(sheet, 'Dead', 'ScarRefused', optional(input.Text), now);
      return 'Died';
    }
    const text = required(input.ScarText, 'The Scar the GM chose');
    const note = optional(input.Note);
    sheet.DyingChoice = 'RiskDeath';
    return addScar(sheet, text, now, note).Retired ? 'Retired' : 'ScarTaken';
  }
  if (input.Tier !== 'Tier1') throw new DeathRuleError('Unknown Risk Death result.', 400);
  end(sheet, 'Dead', 'RiskDeathFailed', optional(input.Text), now);
  return 'Died';
}
