/**
 * Resolving a Strain offer on the server (0.86.2, `HANDOFF.md` open issue 27).
 *
 * A `PendingStrainOffer` used to be resolved by two separate saves from the browser: the outcome onto
 * the Hero's sheet, then the offer off the Encounter. Nothing tied them together, so the same offer
 * could be applied twice: from two devices showing it at once, or again after the Encounter save
 * failed and the offer reappeared (state-machine model check, 2026-11-20). The route that replaces
 * them removes the offer first, as one checked save, so only one request can go on to change the
 * sheet. This module is the sheet half: pure, deterministic, shared so the rules live in one place.
 *
 * What the player chose (how they Resisted, which Statuses, which Armor) and the Strain that is left
 * are the player's report, worked out in the browser as before; this applies it. It never rolls.
 */
import { freeStatusSlots, statusPicksFit, takeStatus } from './engine.js';
import { applyStrainToSheet } from './death.js';
import { markCondition, strainTrackLength } from './logic.js';
import type { CharacterSheet, GameSettings, PendingStrainOffer, StatusSeverity } from './types.js';

const SEVERITIES: readonly StatusSeverity[] = ['Minor', 'Major', 'Severe'];
const MAX_STATUS_NAME = 200;

/** What the player reports when resolving one offer. */
export interface ResolveStrainOfferRequest {
  /** Statuses taken to absorb the Strain (Resist with a Status). Empty otherwise. */
  Statuses: { Severity: StatusSeverity; Name: string }[];
  /** The Armor marked to Defend (a Reaction, 1 AP), or null. */
  ArmorId: string | null;
  /** The Strain left to mark after Fortify, Resist and Defend: 0 up to the offer's Amount. */
  Amount: number;
  /** The Encounter log lines, newest first, as the browser words them (at most 3). */
  Log: string[];
  /** A Resist roll of 6- gives the GM a Drama: the note for it, or null. */
  DramaNote: string | null;
}

export type ResolveStrainOfferOutcome = 'Absorbed' | 'Dying' | 'Died';

export interface ResolveStrainOfferResult {
  Outcome: ResolveStrainOfferOutcome;
  /** Marking the attack's Condition found every Condition already marked. */
  Crumbled: boolean;
}

/** 400 (the request is malformed) or 409 (the sheet cannot take it as asked). */
export class OfferRuleError extends Error {
  readonly status: 400 | 409;
  constructor(message: string, status: 400 | 409 = 400) {
    super(message);
    this.name = 'OfferRuleError';
    this.status = status;
  }
}

/** Checks the shape of a request against the offer it resolves, before anything is written.
 *  Returns the request with names trimmed. Throws `OfferRuleError` (400). */
export function checkResolveStrainOfferRequest(body: unknown, offer: PendingStrainOffer): ResolveStrainOfferRequest {
  const b = (body ?? {}) as Partial<ResolveStrainOfferRequest>;
  const amount = b.Amount;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > offer.Amount) {
    throw new OfferRuleError(`The Strain to mark must be a whole number from 0 to ${offer.Amount}.`);
  }
  const statuses = Array.isArray(b.Statuses) ? b.Statuses : [];
  if (statuses.length > 0 && !offer.Resistable) throw new OfferRuleError('This Strain cannot be Resisted, so no Status can absorb it.');
  if (statuses.length > 6) throw new OfferRuleError('Too many Statuses.');
  const cleanStatuses = statuses.map((s) => {
    const name = typeof s?.Name === 'string' ? s.Name.trim() : '';
    if (!SEVERITIES.includes(s?.Severity)) throw new OfferRuleError('Each Status needs a severity.');
    if (!name || name.length > MAX_STATUS_NAME) throw new OfferRuleError('Each Status needs a name.');
    return { Severity: s.Severity, Name: name };
  });
  const armorId = b.ArmorId ?? null;
  if (armorId !== null && typeof armorId !== 'string') throw new OfferRuleError('Unknown Armor.');
  const log = Array.isArray(b.Log) ? b.Log : [];
  if (log.length > 3 || log.some((l) => typeof l !== 'string' || !l.trim() || l.length > 500)) throw new OfferRuleError('Bad log lines.');
  const dramaNote = b.DramaNote ?? null;
  if (dramaNote !== null && (typeof dramaNote !== 'string' || !dramaNote.trim() || dramaNote.length > 200)) throw new OfferRuleError('Bad Drama note.');
  return { Statuses: cleanStatuses, ArmorId: armorId, Amount: amount, Log: log.map((l) => l.trim()), DramaNote: dramaNote?.trim() ?? null };
}

/** Applies a checked request to the Hero's sheet draft, in the order the browser always did: the
 *  Statuses taken, the Armor marked, the attack's Condition, then the Strain left (Temporary box
 *  first; Dying, or death with the second row open, when nothing can take it). Mutates `sheet`.
 *  Throws `OfferRuleError` (409) when the Statuses do not fit the free slots or the Armor is gone
 *  or already marked: the sheet changed after the player chose. */
export function applyStrainOfferToSheet(
  sheet: CharacterSheet,
  offer: PendingStrainOffer,
  req: ResolveStrainOfferRequest,
  settings: Pick<GameSettings, 'MinorStatusSlots' | 'MajorStatusSlots' | 'SevereStatusSlots' | 'StrainTrackLength'>,
): ResolveStrainOfferResult {
  if (req.Statuses.length > 0) {
    const free = freeStatusSlots(sheet.Statuses, {
      Minor: settings.MinorStatusSlots,
      Major: settings.MajorStatusSlots,
      Severe: settings.SevereStatusSlots,
    });
    if (!statusPicksFit(req.Statuses.map((s) => s.Severity), free)) {
      throw new OfferRuleError('Those Statuses no longer fit your free slots. Reload and choose again.', 409);
    }
    for (const s of req.Statuses) sheet.Statuses = takeStatus(sheet.Statuses, { Severity: s.Severity, Name: s.Name, Description: offer.Note });
  }
  if (req.ArmorId) {
    const armor = sheet.Armor.find((a) => a.Id === req.ArmorId);
    if (!armor || armor.Used) throw new OfferRuleError('That Armor is already marked. Reload and choose again.', 409);
    armor.Used = true;
  }
  let crumbled = false;
  if (offer.ConditionVirtueId) crumbled = markCondition(sheet, offer.ConditionVirtueId).Crumbled;
  const { Outcome } = applyStrainToSheet(sheet, req.Amount, strainTrackLength(sheet, settings));
  return { Outcome, Crumbled: crumbled };
}
