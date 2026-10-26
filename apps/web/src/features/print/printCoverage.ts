import type {
  Bond,
  BondMoveEntry,
  Character,
  CharacterArmor,
  CharacterItem,
  CharacterLoad,
  CharacterMotif,
  CharacterSheet,
  CharacterStatus,
  Condition,
  ArmorType,
  GameSettings,
  HeroEnding,
  Item,
  Library,
  LoadTierDef,
  Move,
  Party,
  PartyCampAsset,
  Scar,
  SheetReminder,
  TakenImprovement,
  Virtue,
  VirtueValue,
  WildcardDeclaration,
} from '@asohav/shared';

/**
 * The printable sheet's drift guard.
 *
 * The printout is generated from the same types and the same library the live sheet reads, so a
 * rules change in the seed library flows into it with no edit here. What can still drift is the
 * *shape*: a field added to `CharacterSheet` (or to a nested row, or to the library) that the
 * print layout never learns about. Every map below is a `Record<keyof T, Coverage>`, so adding a
 * field to `T` fails `tsc` until somebody decides, here, whether it prints — and `PrintSheet.test.tsx`
 * then holds every `printed: true` entry to account by looking for its value in the rendered page.
 *
 * `printed: false` is a decision, not a gap: it carries the reason, and the reason is read by
 * whoever next wonders why a field is missing from paper.
 *
 * Where the print layout had to choose, it printed what the live sheet already shows; the entries
 * below say so. Nothing here settles a rules question the ruleset leaves open (HANDOFF.md fences).
 */
export type Coverage = { printed: true; where: string } | { printed: false; reason: string };

const yes = (where: string): Coverage => ({ printed: true, where });
const no = (reason: string): Coverage => ({ printed: false, reason });

const BOOKKEEPING = 'Bookkeeping identifier; has no meaning on paper.';

// ---------- CharacterSheet and the rows it nests ----------

export const SHEET_PRINT_COVERAGE: Record<keyof CharacterSheet, Coverage> = {
  Id: no(BOOKKEEPING),
  CharacterId: no(BOOKKEEPING),
  Looks: yes('Background › Looks (one per line)'),
  Virtues: yes('Virtues (score and Condition mark per Virtue)'),
  Strain: yes('Strain & Status › Strain boxes (marked boxes carry their number)'),
  TempStrain: yes('Strain & Status › Temporary Strain'),
  Dying: yes('Strain & Status › Dying / Dead / Retired line (filled sheet only)'),
  DyingChoice: yes('Strain & Status › Dying / Dead / Retired line (the recorded choice)'),
  StrainSecond: yes('Strain & Status › Second Strain (shown when the live sheet shows it: open, or any box marked)'),
  LifeState: yes('Strain & Status › Dying / Dead / Retired line'),
  Ending: yes('Strain & Status › Dying / Dead / Retired line (the recorded words; the Kind is not spelled out)'),
  ResurrectionClockId: no('Points at a Clock on the campaign board; the print carries no Clock data.'),
  StrainBoxBonus: yes('Strain & Status › Strain boxes (the track is longer by this many boxes)'),
  Statuses: yes('Strain & Status › Statuses, grouped by severity'),
  HealingTrack: yes('Strain & Status › Healing Track'),
  Boons: yes('Strain & Status › Boons'),
  Banes: yes('Strain & Status › Banes'),
  Armor: yes('Strain & Status › Armor'),
  Motifs: yes('Background › Motifs'),
  Load: yes('Load & Item Charges › tier'),
  Items: yes('Load & Item Charges › items'),
  WildcardDeclarations: yes('Load & Item Charges › Wildcard items'),
  Advancement: no('Holds only the History log (not printed); the Hero Improvements a Hero holds are `Improvements`.'),
  Improvements: yes('Advancement › Hero Improvements. The live sheet does not list these; a paper sheet needs somewhere to read them.'),
  Reminders: yes('Reminders'),
  CampActionsUsed: no('A per-Camp counter the live sheet shows only inside the Camp Actions dialog; its allowance is a computation the print does not restate.'),
  Scars: yes('Strain & Status › Scars'),
  Wealth: yes('Strain & Status › Wealth'),
  Treasure: yes('Strain & Status › Treasure'),
  Hold: yes('Strain & Status › Hold'),
  HoldByMove: no('Which Move granted the Hold; the live sheet shows only the total (the Spend Hold dialog shows the split).'),
  CreatedAt: no(BOOKKEEPING),
  UpdatedAt: no(BOOKKEEPING),
};

export const VIRTUE_VALUE_PRINT_COVERAGE: Record<keyof VirtueValue, Coverage> = {
  VirtueId: yes('Virtues (selects the Virtue the row is printed under)'),
  Score: yes('Virtues › score'),
  ConditionMarked: yes('Virtues › Condition mark'),
};

export const STATUS_PRINT_COVERAGE: Record<keyof CharacterStatus, Coverage> = {
  Id: no(BOOKKEEPING),
  Severity: yes('Strain & Status › Statuses (the severity group)'),
  Name: yes('Strain & Status › Statuses › name'),
  Description: yes('Strain & Status › Statuses › lasting effect'),
};

export const ARMOR_PRINT_COVERAGE: Record<keyof CharacterArmor, Coverage> = {
  Id: no(BOOKKEEPING),
  ArmorTypeId: yes('Strain & Status › Armor › type'),
  Used: yes('Strain & Status › Armor › box (marked) and Ready / Spent'),
  SourceId: no('Library reference for the granting item or ability; the label is what prints.'),
  SourceLabel: yes('Strain & Status › Armor › "from …"'),
  Effects: yes('Strain & Status › Armor › "Stops" (Special Armor)'),
};

export const MOTIF_PRINT_COVERAGE: Record<keyof CharacterMotif, Coverage> = {
  MotifId: no('Library reference for the Motif the Hero started from; the Hero\'s own Name is what prints.'),
  Name: yes('Background › Motifs › name'),
  SkillTags: yes('Background › Motifs › Skill Tags'),
  FlawTags: yes('Background › Motifs › Flaw Tags'),
  Potential: yes('Background › Motifs › Potential'),
  Quest: yes('Background › Motifs › Quest'),
  ActBreaks: yes('Background › Motifs › Act Breaks'),
  Forsakes: yes('Background › Motifs › Forsakes'),
};

export const LOAD_PRINT_COVERAGE: Record<keyof CharacterLoad, Coverage> = {
  Tier: yes('Load & Item Charges › tier'),
  LatchedUntilCamp: no('Not shown on the live sheet\'s Load panel (it only gates new items until Make Camp).'),
};

export const ITEM_PRINT_COVERAGE: Record<keyof CharacterItem, Coverage> = {
  ItemId: yes('Load & Item Charges › items › name, cost, text (looked up in the library)'),
  Carried: yes('Load & Item Charges › items › carried mark'),
  ChargesUsed: yes('Load & Item Charges › items › Charges'),
};

export const WILDCARD_PRINT_COVERAGE: Record<keyof WildcardDeclaration, Coverage> = {
  Id: no(BOOKKEEPING),
  Text: yes('Load & Item Charges › Wildcard items › text'),
  Persistent: yes('Load & Item Charges › Wildcard items › Persistent / Ordinary'),
};

export const REMINDER_PRINT_COVERAGE: Record<keyof SheetReminder, Coverage> = {
  Id: no(BOOKKEEPING),
  Text: yes('Reminders › text'),
  Value: yes('Reminders › value'),
  Kind: yes('Reminders › Forward / Ongoing'),
  Source: yes('Reminders › source'),
};

export const SCAR_PRINT_COVERAGE: Record<keyof Scar, Coverage> = {
  Id: no(BOOKKEEPING),
  Text: yes('Strain & Status › Scars'),
  At: no('A timestamp; the live sheet lists only the text.'),
};

export const ENDING_PRINT_COVERAGE: Record<keyof HeroEnding, Coverage> = {
  Kind: no('The live banner words each Kind in prose; the print gives the recorded words, not that prose.'),
  Text: yes('Strain & Status › Dying / Dead / Retired line'),
  At: no('A timestamp.'),
};

export const IMPROVEMENT_PRINT_COVERAGE: Record<keyof TakenImprovement, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Advancement › Hero Improvements / Party Improvements › name'),
  Effect: yes('Advancement › Hero Improvements / Party Improvements › effect'),
  TakenAt: no('A timestamp.'),
};

// ---------- The rest of what the live sheet page shows: the Hero, the Party, Connections ----------

export const CHARACTER_PRINT_COVERAGE: Record<keyof Character, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Masthead › Name'),
  Pronouns: yes('Masthead › Pronouns'),
  PlayerName: yes('Masthead › Player'),
  UserId: no(BOOKKEEPING),
  CampaignId: no(BOOKKEEPING),
};

export const PARTY_PRINT_COVERAGE: Record<keyof Party, Coverage> = {
  Id: no(BOOKKEEPING),
  CampaignId: no(BOOKKEEPING),
  Rapport: yes('Party & Connections › Rapport'),
  Drama: no('The GM\'s pool; the live sheet shows it to no player.'),
  RapportImprovementsTaken: yes('Party & Connections › Party Improvements'),
  History: no('A log; the live sheet opens it in a dialog.'),
  PartyLevel: yes('Party & Connections › Rapport (Level)'),
  Motif: yes('Party & Connections › Party Motif'),
  Quest: yes('Party & Connections › Party Quest'),
  SkillTags: yes('Party & Connections › Party Skill Tags'),
  WeaknessTags: no('Deprecated alias; `FlawTags` holds these now.'),
  MotifId: no('Library reference; the party\'s own wording prints.'),
  FlawTags: yes('Party & Connections › Party Flaw Tags'),
  UsedTags: yes('Party & Connections › Party tags marked (used)'),
  QuestKind: no('Not shown on the live sheet.'),
  ActBreaks: yes('Party & Connections › Party Quest'),
  Forsakes: yes('Party & Connections › Party Quest'),
  Path: no('Edited on the Party page; the live sheet does not show it.'),
  Goal: no('Edited on the Party page; the live sheet does not show it.'),
  CampAssets: yes('Party & Connections › Camp Assets'),
  ReplacementHeroFor: no('GM-side replacement-Hero state.'),
  UpdatedAt: no(BOOKKEEPING),
  UpdatedBy: no(BOOKKEEPING),
};

export const CAMP_ASSET_PRINT_COVERAGE: Record<keyof PartyCampAsset, Coverage> = {
  Id: no(BOOKKEEPING),
  RefId: no(BOOKKEEPING),
  Name: yes('Party & Connections › Camp Assets › name'),
  Description: no('Not shown on the live sheet (the Effect is).'),
  Tier: yes('Party & Connections › Camp Assets › Tier'),
  Effect: yes('Party & Connections › Camp Assets › effect'),
};

export const BOND_PRINT_COVERAGE: Record<keyof Bond, Coverage> = {
  Id: no(BOOKKEEPING),
  CampaignId: no(BOOKKEEPING),
  CharacterAId: yes('Party & Connections › Connections › partner (the other Hero\'s name)'),
  CharacterBId: yes('Party & Connections › Connections › partner (the other Hero\'s name)'),
  BondTrack: yes('Party & Connections › Connections › Bond Track'),
  BondLevel: no('Not shown on the live sheet.'),
  ConnectionTag: yes('Party & Connections › Connections › Connection Tag'),
  BondMoves: yes('Party & Connections › Connections › Connection Improvements'),
  PendingChange: no('An unanswered proposal between two players; not a settled fact for paper.'),
  History: no('A log; the live sheet opens it in a dialog.'),
  UpdatedAt: no(BOOKKEEPING),
};

export const BOND_MOVE_PRINT_COVERAGE: Record<keyof BondMoveEntry, Coverage> = {
  Level: no('The Forge count; the live sheet lists the text only.'),
  Text: yes('Party & Connections › Connections › Connection Improvements'),
  AuthoredAt: no('A timestamp.'),
};

// ---------- The library: what the page prints from it ----------

export const LIBRARY_PRINT_COVERAGE: Record<keyof Library, Coverage> = {
  virtues: yes('Virtues'),
  conditions: yes('Virtues › Condition'),
  armorTypes: yes('Strain & Status › Armor (type names and the legend)'),
  items: yes('Load & Item Charges'),
  motifs: no('Creation-time suggestions; the sheet prints the Hero\'s own Motif names and tags.'),
  improvementTrees: no('Reference for taking Improvements; a Hero\'s held ones come from the sheet.'),
  improvements: no('Reference for taking Improvements; a Hero\'s held ones come from the sheet.'),
  moves: yes('Moves reference (after the sheet: the Basic Moves\' names and text by default; every Move with every result on request; or off)'),
  glossary: no('Too long for paper. It is used only to resolve explicit [Term] tags in printed text.'),
  enemies: no('GM material.'),
  campAssets: no('Catalogue; the party\'s held Camp Assets come from the Party.'),
  villains: no('GM material.'),
  npcs: no('GM material.'),
  locations: no('GM material.'),
  partyMotifs: no('Catalogue; the party\'s own Motif prints.'),
  partyImprovements: no('Catalogue; the party\'s held Improvements print.'),
  connectionTags: no('Examples for authoring a tag; the pair\'s own tag prints.'),
  gmReference: no('GM material; the GM Reference has its own printable (PrintGmReference, guarded by printGmReferenceCoverage.ts).'),
  settings: yes('Track lengths and Status slot counts'),
  loadTiers: yes('Load & Item Charges › tiers'),
  SeedVersion: yes('Footer'),
};

export const VIRTUE_PRINT_COVERAGE: Record<keyof Virtue, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Virtues › name'),
  Tagline: yes('Virtues › tagline'),
  Essence: yes('Virtues › essence'),
  UsageHelperText: no('Tooltip-only "Use it when…" guidance on the live sheet; the Essence prints.'),
};

export const CONDITION_PRINT_COVERAGE: Record<keyof Condition, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Virtues › Condition name'),
  VirtueId: yes('Virtues (pairs the Condition with its Virtue)'),
  ClearAction: yes('Virtues › "Clear it"'),
};

export const ARMOR_TYPE_PRINT_COVERAGE: Record<keyof ArmorType, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Strain & Status › Armor legend'),
  Key: yes('Strain & Status › Armor (Special Armor gets its "Stops" line)'),
  Description: yes('Strain & Status › Armor legend'),
};

export const LIBRARY_ITEM_PRINT_COVERAGE: Record<keyof Item, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Load & Item Charges › items › name'),
  Description: yes('Load & Item Charges › items › text'),
  LoadCost: yes('Load & Item Charges › items › cost'),
  Charges: yes('Load & Item Charges › items › Charges'),
  GrantsArmorTypeId: no('Drives the live sheet\'s Armor rows, which the sheet itself lists.'),
};

export const LOAD_TIER_PRINT_COVERAGE: Record<keyof LoadTierDef, Coverage> = {
  Key: yes('Load & Item Charges › tiers'),
  Base: yes('Load & Item Charges › tiers (capacity)'),
  Note: yes('Load & Item Charges › tier note'),
};

export const MOVE_PRINT_COVERAGE: Record<keyof Move, Coverage> = {
  Id: no(BOOKKEEPING),
  Name: yes('Moves reference › name'),
  Kind: yes('Moves reference (Basic Moves print by default; Adventure Moves only in full mode)'),
  VirtueId: yes('Moves reference (the group a Move sits in)'),
  Description: yes('Moves reference › text'),
  Results: yes('Moves reference › results by tier (full mode; the default stops at the Move\'s text)'),
  PlayerVariantResults: yes('Moves reference › "On a Player" (full mode)'),
  HoldGrant: no('The grant is already worded in the Move\'s own result text.'),
};

export const SETTINGS_PRINT_COVERAGE: Record<keyof GameSettings, Coverage> = {
  Id: no(BOOKKEEPING),
  PotentialTrackLength: yes('Background › Motifs › Potential (pip count)'),
  RapportTrackLength: yes('Party & Connections › Rapport (pip count)'),
  BondTrackLength: yes('Party & Connections › Connections › Bond Track (pip count)'),
  StrainTrackLength: yes('Strain & Status › Strain (box count)'),
  HeroRollModifierCap: no('A roll-helper limit; the live sheet does not show it.'),
  HealingTrackLength: yes('Strain & Status › Healing Track (pip count)'),
  MinorStatusSlots: yes('Strain & Status › Statuses (slot count)'),
  MajorStatusSlots: yes('Strain & Status › Statuses (slot count)'),
  SevereStatusSlots: yes('Strain & Status › Statuses (slot count)'),
  GlossaryAutoLink: no('Rendering switch for the live sheet\'s tap-links; printed text has none.'),
};
