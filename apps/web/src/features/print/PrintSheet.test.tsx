// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import {
  normalizeBond,
  normalizeParty,
  normalizeSheet,
  seedBonds,
  seedCharacters,
  seedLibrary,
  seedParty,
  seedSheets,
  type Bond,
  type Character,
  type CharacterSheet,
  type Library,
  type Party,
} from '@asohav/shared';
import { PrintSheet } from './PrintSheet.js';
import {
  ARMOR_PRINT_COVERAGE,
  ARMOR_TYPE_PRINT_COVERAGE,
  BOND_MOVE_PRINT_COVERAGE,
  BOND_PRINT_COVERAGE,
  CAMP_ASSET_PRINT_COVERAGE,
  CHARACTER_PRINT_COVERAGE,
  CONDITION_PRINT_COVERAGE,
  ENDING_PRINT_COVERAGE,
  IMPROVEMENT_PRINT_COVERAGE,
  ITEM_PRINT_COVERAGE,
  LIBRARY_ITEM_PRINT_COVERAGE,
  LIBRARY_PRINT_COVERAGE,
  LOAD_PRINT_COVERAGE,
  LOAD_TIER_PRINT_COVERAGE,
  MOTIF_PRINT_COVERAGE,
  MOVE_PRINT_COVERAGE,
  PARTY_PRINT_COVERAGE,
  REMINDER_PRINT_COVERAGE,
  SCAR_PRINT_COVERAGE,
  SETTINGS_PRINT_COVERAGE,
  SHEET_PRINT_COVERAGE,
  STATUS_PRINT_COVERAGE,
  VIRTUE_PRINT_COVERAGE,
  VIRTUE_VALUE_PRINT_COVERAGE,
  WILDCARD_PRINT_COVERAGE,
  type Coverage,
} from './printCoverage.js';

/**
 * The drift guard for the printable sheet.
 *
 *  (a) the filled print, built from the demo sheet and the seed library, contains the value of
 *      every field `printCoverage.ts` marks `printed: true`;
 *  (b) the blank print contains every library-driven label, box count and Move;
 *  (c) each coverage map names exactly the fields the real data has.
 *
 * The other half of (c) is the compiler: every map is `Record<keyof T, Coverage>`, so a field added
 * to a type fails `npm run typecheck` until it is listed. This file is what catches the case
 * where it is listed `printed: true` and the layout never learned to print it.
 */

afterEach(cleanup);

// ---------- Fixtures: the demo sheet and seed library, with distinctive values added ----------

const library: Library = seedLibrary();
const characters: Character[] = seedCharacters();
const ember = characters.find((c) => c.Id === 'ch-ember')!;
const NOW = '2026-10-25T00:00:00.000Z';

function richSheet(): CharacterSheet {
  const s = normalizeSheet(structuredClone(seedSheets().find((x) => x.CharacterId === 'ch-ember')!));
  s.Strain = [false, true, false, false, false, true]; // five boxes + one earned by a Motif advance
  s.StrainBoxBonus = 1;
  s.TempStrain = 2;
  s.Dying = true;
  s.DyingChoice = 'Scar';
  s.StrainSecond = [false, false, true, false, false, false];
  s.HealingTrack = 3;
  s.Wealth = 7;
  s.Treasure = 4;
  s.Hold = 9;
  s.Looks = 'Soot-stained coat\nA scar through one eyebrow\nHands that never stop moving';
  s.Statuses = [
    { Id: 'st-a', Severity: 'Minor', Name: 'Bruised Ribs', Description: 'Every breath reminds her.' },
    { Id: 'st-b', Severity: 'Major', Name: 'Frostnip', Description: 'Two fingers gone white.' },
    { Id: 'st-c', Severity: 'Severe', Name: 'Shattered Wrist', Description: 'Cannot grip a blade.' },
  ];
  s.Boons = ['Prepared', 'Well-lit'];
  s.Banes = ['Indebted to the ferryman'];
  s.Armor = [
    { Id: 'ar-1', ArmorTypeId: 'a-physical', Used: false, SourceId: 'ab-ironclad', SourceLabel: 'Ironclad' },
    { Id: 'ar-2', ArmorTypeId: 'a-physical', Used: true, SourceId: 'i-shield', SourceLabel: 'Kite shield' },
    { Id: 'ar-3', ArmorTypeId: 'a-special', Used: false, SourceId: 'i-wardstone', SourceLabel: 'Ward-stone', Effects: ['hexfire', 'cold iron'] },
  ];
  s.Motifs[0] = { ...s.Motifs[0], Name: 'Inheritor of Cinders', Potential: 4, Quest: 'Prove my worth to the Cinder Court', ActBreaks: 2, Forsakes: 1 };
  s.Load = { Tier: 'Heavy', LatchedUntilCamp: false };
  s.WildcardDeclarations = [{ Id: 'wc-1', Text: 'A hidden skeleton key', Persistent: true }, { Id: 'wc-2', Text: 'A ball of twine', Persistent: false }];
  s.Reminders = [
    { Id: 'rem-1', Text: 'Acting on what the old maps showed', Value: 2, Kind: 'Ongoing', Source: 'Consult the Past' },
    { Id: 'rem-2', Text: 'Shaken by the bridge', Value: -1, Kind: 'Forward', Source: 'Stand Defiant' },
  ];
  s.Scars = [{ Id: 'sc-1', Text: 'Brand of the Ashen Pass', At: NOW }];
  s.Improvements = [{ Id: 'imp-1', Name: 'Cinderstep', Effect: 'Walk unharmed through banked embers.', TakenAt: NOW }];
  return s;
}

function deadSheet(): CharacterSheet {
  const s = richSheet();
  s.Dying = false;
  s.DyingChoice = null;
  s.StrainSecond = s.StrainSecond.map(() => false);
  s.LifeState = 'Dead';
  s.Ending = { Kind: 'RiskDeathFailed', Text: 'Tell them I tried', At: NOW };
  return s;
}

function richParty(): Party {
  const p = normalizeParty(structuredClone(seedParty()));
  p.Rapport = 4;
  p.PartyLevel = 2;
  p.Motif = 'The Ember Compact';
  p.Quest = 'Carry the lantern to Hollow Bend';
  p.ActBreaks = 2;
  p.Forsakes = 1;
  p.SkillTags = ['Lantern Bearers', 'Road-wise'];
  p.FlawTags = ['Debts Unpaid'];
  p.UsedTags = ['Skill:Lantern Bearers'];
  p.RapportImprovementsTaken = [{ Id: 'pimp-1', Name: 'Shared Hearth', Effect: 'Any Hero may Keep Watch for two.', TakenAt: NOW }];
  p.CampAssets = [{ Id: 'pca-1', RefId: '', Name: 'Hidden Cellar', Description: 'Dry and cold.', Tier: 2, Effect: 'Safe to Make Camp in, even in town.' }];
  return p;
}

const bonds: Bond[] = seedBonds().map(normalizeBond);
const party = richParty();

/** Everything a visitor can read on the page, text and accessible names alike, one string. Text nodes
 *  are joined with a space so "Wealth" beside a box holding "7" reads "Wealth 7". */
function pageText(root: HTMLElement): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? '');
  root.querySelectorAll('[aria-label]').forEach((e) => parts.push(e.getAttribute('aria-label') ?? ''));
  return parts.join(' ').replace(/\s+/g, ' ');
}

function renderFilled(sheet: CharacterSheet): string {
  const { container } = render(
    <PrintSheet library={library} sheet={sheet} character={ember} party={party} bonds={bonds} characters={characters} moves="off" />,
  );
  return pageText(container);
}

function renderBlank(): string {
  const { container } = render(<PrintSheet library={library} sheet={null} moves="full" />);
  return pageText(container);
}

const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Every string must appear in the page; reports which did not. */
function missing(text: string, expected: string[]): string[] {
  return expected.map(norm).filter((e) => e && !text.includes(e));
}

type Probes<K extends string> = Partial<Record<K, () => string[]>>;

/** The rule: each key marked `printed: true` has a probe, and what the probe expects is on the page. */
function checkCoverage<K extends string>(name: string, coverage: Record<K, Coverage>, probes: Probes<K>, text: string, textFor: Partial<Record<K, string>> = {}) {
  const problems: string[] = [];
  for (const key of Object.keys(coverage) as K[]) {
    const c = coverage[key];
    if (!c.printed) continue;
    const probe = probes[key];
    if (!probe) {
      problems.push(`${name}.${key} is marked printed (${c.where}) but this test has no probe for it`);
      continue;
    }
    const expected = probe();
    if (expected.length === 0) problems.push(`${name}.${key} has an empty probe`);
    const gone = missing(textFor[key] ?? text, expected);
    if (gone.length) problems.push(`${name}.${key} is marked printed (${c.where}) but the page lacks: ${gone.map((g) => JSON.stringify(g)).join(', ')}`);
  }
  expect(problems).toEqual([]);
}

/** A coverage map and a real value must name the same fields. Returns the differences. */
function keyMismatch(coverage: Record<string, unknown>, sample: object, mode: 'exact' | 'subset' = 'exact'): string[] {
  const covKeys = Object.keys(coverage);
  const sampleKeys = Object.keys(sample);
  const lacking = sampleKeys.filter((k) => !covKeys.includes(k)).map((k) => `data has "${k}", coverage map does not`);
  const extra = mode === 'exact' ? covKeys.filter((k) => !sampleKeys.includes(k)).map((k) => `coverage map has "${k}", data does not`) : [];
  return [...lacking, ...extra];
}

// ---------- (a) the filled print ----------

describe('printable sheet — filled', () => {
  const sheet = richSheet();

  it('prints every CharacterSheet field marked printed', () => {
    const text = renderFilled(sheet);
    const dead = pageText(render(<PrintSheet library={library} sheet={deadSheet()} character={ember} party={party} bonds={bonds} characters={characters} moves="off" />).container);
    const virtueName = (id: string) => library.virtues.find((v) => v.Id === id)!.Name;
    const itemName = (id: string) => library.items.find((i) => i.Id === id)!.Name;

    checkCoverage('CharacterSheet', SHEET_PRINT_COVERAGE, {
      Looks: () => ['Soot-stained coat', 'A scar through one eyebrow', 'Hands that never stop moving'],
      Virtues: () => sheet.Virtues.map((v) => `${virtueName(v.VirtueId)} score ${sign(v.Score)}`),
      Strain: () => ['Strain: boxes 2, 6 marked, of 6'],
      TempStrain: () => ['Temporary Strain 2'],
      Dying: () => ['Dying'],
      DyingChoice: () => ['choice made: a Scar'],
      StrainSecond: () => ['Second Strain: boxes 3 marked, of 6'],
      LifeState: () => ['Dead'],
      Ending: () => ['Tell them I tried'],
      StrainBoxBonus: () => ['of 6'],
      Statuses: () => sheet.Statuses.flatMap((s) => [s.Name, s.Description]),
      HealingTrack: () => ['Healing Track: 3 of 5', 'Healing Track — 3 / 5'],
      Boons: () => sheet.Boons,
      Banes: () => sheet.Banes,
      Armor: () => ['Ironclad', 'Kite shield', 'Ward-stone', 'Spent', 'Ready'],
      Motifs: () => sheet.Motifs.map((m) => m.Name),
      Load: () => ['Heavy Load: marked', 'Normal Load: not marked'],
      Items: () => sheet.Items.map((i) => itemName(i.ItemId)),
      WildcardDeclarations: () => ['A hidden skeleton key', 'A ball of twine'],
      Improvements: () => ['Cinderstep', 'Walk unharmed through banked embers.'],
      Reminders: () => ['Acting on what the old maps showed', 'Shaken by the bridge'],
      Scars: () => ['Brand of the Ashen Pass'],
      Wealth: () => ['Wealth 7'],
      Treasure: () => ['Treasure 4'],
      Hold: () => ['Hold 9'],
    }, text, { LifeState: dead, Ending: dead });
  });

  it('prints every nested sheet row field marked printed', () => {
    const text = renderFilled(sheet);
    const dead = pageText(render(<PrintSheet library={library} sheet={deadSheet()} character={ember} party={party} bonds={bonds} characters={characters} moves="off" />).container);
    const virtueName = (id: string) => library.virtues.find((v) => v.Id === id)!.Name;
    const condName = (id: string) => library.conditions.find((c) => c.VirtueId === id)!.Name;
    const typeName = (id: string) => library.armorTypes.find((t) => t.Id === id)!.Name;
    const item = (id: string) => library.items.find((i) => i.Id === id)!;
    const [m1] = sheet.Motifs;

    checkCoverage('VirtueValue', VIRTUE_VALUE_PRINT_COVERAGE, {
      VirtueId: () => sheet.Virtues.map((v) => virtueName(v.VirtueId)),
      Score: () => sheet.Virtues.map((v) => sign(v.Score)),
      ConditionMarked: () => sheet.Virtues.map((v) => `${condName(v.VirtueId)}: ${v.ConditionMarked ? 'marked' : 'not marked'}`),
    }, text);

    checkCoverage('CharacterStatus', STATUS_PRINT_COVERAGE, {
      Severity: () => ['Minor (1 / 3)', 'Major (1 / 2)', 'Severe (1 / 1)'],
      Name: () => sheet.Statuses.map((s) => s.Name),
      Description: () => sheet.Statuses.map((s) => s.Description),
    }, text);

    checkCoverage('CharacterArmor', ARMOR_PRINT_COVERAGE, {
      ArmorTypeId: () => [typeName('a-physical'), typeName('a-special')],
      Used: () => [`${typeName('a-physical')} Armor from Kite shield: marked`, `${typeName('a-physical')} Armor from Ironclad: not marked`, 'Spent', 'Ready'],
      SourceLabel: () => ['from Ironclad', 'from Kite shield', 'from Ward-stone'],
      Effects: () => ['Stops: hexfire, cold iron'],
    }, text);

    checkCoverage('CharacterMotif', MOTIF_PRINT_COVERAGE, {
      Name: () => ['Inheritor of Cinders'],
      SkillTags: () => sheet.Motifs.flatMap((m) => m.SkillTags),
      FlawTags: () => sheet.Motifs.flatMap((m) => m.FlawTags),
      Potential: () => ['Motif 1 Potential: 4 of 5'],
      Quest: () => ['Prove my worth to the Cinder Court'],
      ActBreaks: () => ['Motif 1 Act Breaks: 2 of 3'],
      Forsakes: () => ['Motif 1 Forsakes: 1 of 3'],
    }, text);
    expect(m1.Name).toBe('Inheritor of Cinders');

    checkCoverage('CharacterLoad', LOAD_PRINT_COVERAGE, {
      Tier: () => ['Heavy Load: marked'],
    }, text);

    const carried = sheet.Items.find((i) => i.Carried)!;
    const charged = sheet.Items.find((i) => (item(i.ItemId).Charges ?? 0) > 0 && i.ChargesUsed > 0)!;
    checkCoverage('CharacterItem', ITEM_PRINT_COVERAGE, {
      ItemId: () => sheet.Items.flatMap((i) => [item(i.ItemId).Name, norm(item(i.ItemId).Description)]),
      Carried: () => [`${item(carried.ItemId).Name} carried: marked`, ...sheet.Items.filter((i) => !i.Carried).map((i) => `${item(i.ItemId).Name} carried: not marked`)],
      ChargesUsed: () => [`${item(charged.ItemId).Name} Charges used: ${charged.ChargesUsed} of ${item(charged.ItemId).Charges}`],
    }, text);

    checkCoverage('WildcardDeclaration', WILDCARD_PRINT_COVERAGE, {
      Text: () => ['A hidden skeleton key', 'A ball of twine'],
      Persistent: () => ['A hidden skeleton key · Persistent', 'A ball of twine · Ordinary'],
    }, text);

    checkCoverage('SheetReminder', REMINDER_PRINT_COVERAGE, {
      Text: () => ['Acting on what the old maps showed'],
      Value: () => ['+2', '−1'],
      Kind: () => ['Ongoing', 'Forward'],
      Source: () => ['Consult the Past', 'Stand Defiant'],
    }, text);

    checkCoverage('Scar', SCAR_PRINT_COVERAGE, { Text: () => ['Brand of the Ashen Pass'] }, text);
    checkCoverage('HeroEnding', ENDING_PRINT_COVERAGE, { Text: () => ['Tell them I tried'] }, text, { Text: dead });
    checkCoverage('TakenImprovement', IMPROVEMENT_PRINT_COVERAGE, {
      Name: () => ['Cinderstep', 'Shared Hearth'],
      Effect: () => ['Walk unharmed through banked embers.', 'Any Hero may Keep Watch for two.'],
    }, text);
  });

  it('prints the Hero, the Party and the Connections the live sheet page shows', () => {
    const text = renderFilled(sheet);
    const partner = (b: Bond) => characters.find((c) => c.Id === (b.CharacterAId === 'ch-ember' ? b.CharacterBId : b.CharacterAId))!;
    const mine = bonds.filter((b) => b.CharacterAId === 'ch-ember' || b.CharacterBId === 'ch-ember');

    checkCoverage('Character', CHARACTER_PRINT_COVERAGE, {
      Name: () => ['Name Ember'],
      Pronouns: () => ['Pronouns she/her'],
      PlayerName: () => ['Player Ryan'],
    }, text);

    checkCoverage('Party', PARTY_PRINT_COVERAGE, {
      Rapport: () => ['Rapport: 4 of 5'],
      RapportImprovementsTaken: () => ['Shared Hearth'],
      PartyLevel: () => ['Level 2'],
      Motif: () => ['The Ember Compact'],
      Quest: () => ['Carry the lantern to Hollow Bend'],
      SkillTags: () => ['Road-wise'],
      FlawTags: () => ['Debts Unpaid'],
      UsedTags: () => ['Lantern Bearers (used)'],
      ActBreaks: () => ['2 Act Breaks'],
      Forsakes: () => ['1 Forsake'],
      CampAssets: () => ['Hidden Cellar'],
    }, text);

    checkCoverage('PartyCampAsset', CAMP_ASSET_PRINT_COVERAGE, {
      Name: () => ['Hidden Cellar'],
      Tier: () => ['Tier 2'],
      Effect: () => ['Safe to Make Camp in, even in town.'],
    }, text);

    checkCoverage('Bond', BOND_PRINT_COVERAGE, {
      CharacterAId: () => mine.map((b) => partner(b).Name),
      CharacterBId: () => mine.map((b) => partner(b).Name),
      BondTrack: () => mine.map((b) => `Bond Track with ${partner(b).Name}: ${b.BondTrack} of 5`),
      ConnectionTag: () => mine.filter((b) => b.ConnectionTag).map((b) => b.ConnectionTag),
      BondMoves: () => mine.flatMap((b) => b.BondMoves.map((m) => m.Text)),
    }, text);
    checkCoverage('BondMoveEntry', BOND_MOVE_PRINT_COVERAGE, { Text: () => mine.flatMap((b) => b.BondMoves.map((m) => m.Text)) }, text);

    // Someone else's Connection must not be on my sheet.
    expect(text).not.toContain('Unexpected Confidants');
  });

  it('prints the Dying state of a Dying Hero and the Second Strain row only when the live sheet shows it', () => {
    const calm = richSheet();
    calm.Dying = false;
    calm.DyingChoice = null;
    calm.StrainSecond = calm.StrainSecond.map(() => false);
    calm.TempStrain = 0;
    const text = renderFilled(calm);
    expect(text).not.toContain('Second Strain');
    expect(text).not.toContain('Temporary Strain');
    expect(text).not.toContain('Dying');
  });
});

// ---------- (b) the blank print ----------

describe('printable sheet — blank', () => {
  it('prints every library-driven label, box count and Move', () => {
    const text = renderBlank();
    const s = library.settings;

    checkCoverage('Library', LIBRARY_PRINT_COVERAGE, {
      virtues: () => library.virtues.map((v) => v.Name),
      conditions: () => library.conditions.map((c) => c.Name),
      armorTypes: () => library.armorTypes.map((t) => t.Name),
      items: () => library.items.map((i) => i.Name),
      moves: () => library.moves.map((m) => m.Name),
      settings: () => [`Strain: no boxes marked, of ${s.StrainTrackLength}`],
      loadTiers: () => library.loadTiers.map((t) => t.Key),
      SeedVersion: () => [`library seed ${library.SeedVersion}`],
    }, text);

    checkCoverage('Virtue', VIRTUE_PRINT_COVERAGE, {
      Name: () => library.virtues.map((v) => v.Name),
      Tagline: () => library.virtues.map((v) => v.Tagline),
      Essence: () => library.virtues.map((v) => v.Essence),
    }, text);

    checkCoverage('Condition', CONDITION_PRINT_COVERAGE, {
      Name: () => library.conditions.map((c) => c.Name),
      VirtueId: () => library.conditions.map((c) => `${c.Name}: not marked`),
      ClearAction: () => library.conditions.map((c) => `Clear it: ${c.ClearAction}`),
    }, text);

    checkCoverage('ArmorType', ARMOR_TYPE_PRINT_COVERAGE, {
      Name: () => library.armorTypes.map((t) => t.Name),
      Key: () => library.armorTypes.map((t) => `${t.Name} — ${t.Description}`),
      Description: () => library.armorTypes.map((t) => t.Description),
    }, text);

    checkCoverage('Item', LIBRARY_ITEM_PRINT_COVERAGE, {
      Name: () => library.items.map((i) => i.Name),
      Description: () => library.items.map((i) => i.Description),
      LoadCost: () => library.items.map((i) => (i.LoadCost === 0 ? 'concealed' : `${i.LoadCost} load`)),
      Charges: () => library.items.filter((i) => (i.Charges ?? 0) > 0).map((i) => `${i.Name} Charges used: 0 of ${i.Charges}`),
    }, text);

    checkCoverage('LoadTierDef', LOAD_TIER_PRINT_COVERAGE, {
      Key: () => library.loadTiers.map((t) => t.Key),
      Base: () => library.loadTiers.map((t) => `${t.Base} + Might`),
      Note: () => library.loadTiers.map((t) => t.Note),
    }, text);

    const everyMoveText = (pick: (m: (typeof library.moves)[number]) => string[]) => library.moves.flatMap(pick);
    checkCoverage('Move', MOVE_PRINT_COVERAGE, {
      Name: () => everyMoveText((m) => [m.Name]),
      Kind: () => ['Adventure'],
      VirtueId: () => library.virtues.map((v) => v.Name),
      Description: () => everyMoveText((m) => [m.Description]),
      Results: () => everyMoveText((m) => [m.Results.Tier3.Description, m.Results.Tier2.Description, m.Results.Tier1.Description, ...m.Results.Tier2.Options, ...m.Results.Tier3.Options, ...m.Results.Tier1.Options]),
      PlayerVariantResults: () => {
        const withVariant = library.moves.filter((m) => m.PlayerVariantResults);
        return withVariant.length ? ['On a Player', ...withVariant.map((m) => m.PlayerVariantResults!.Tier3.Description)] : ['(no Move in this library has a player variant)'];
      },
    }, text);

    checkCoverage('GameSettings', SETTINGS_PRINT_COVERAGE, {
      PotentialTrackLength: () => [`Motif 1 Potential: 0 of ${s.PotentialTrackLength}`],
      RapportTrackLength: () => [`Rapport: 0 of ${s.RapportTrackLength}`],
      BondTrackLength: () => [`Bond Track: 0 of ${s.BondTrackLength}`],
      StrainTrackLength: () => [`Strain: no boxes marked, of ${s.StrainTrackLength}`],
      HealingTrackLength: () => [`Healing Track: 0 of ${s.HealingTrackLength}`],
      MinorStatusSlots: () => [`Minor ×${s.MinorStatusSlots}`],
      MajorStatusSlots: () => [`Major ×${s.MajorStatusSlots}`],
      SevereStatusSlots: () => [`Severe ×${s.SevereStatusSlots}`],
    }, text);
  });

  it('carries no character values', () => {
    const text = renderBlank();
    for (const leaked of ['Ember', 'Soot-stained', 'Twisted Ankle', 'Indebted to the ferryman']) expect(text).not.toContain(leaked);
  });

  it('follows a changed library: a renamed Virtue, an edited Move and a longer Strain track reach the page', () => {
    const edited = structuredClone(library);
    edited.virtues[0].Name = 'Brawn';
    edited.moves[0].Name = 'Stand Fast';
    edited.settings.StrainTrackLength = 7;
    const { container } = render(<PrintSheet library={edited} sheet={null} moves="full" />);
    const text = pageText(container);
    expect(text).toContain('Brawn');
    expect(text).toContain('Stand Fast');
    expect(text).toContain('Strain: no boxes marked, of 7');
    expect(text).not.toContain('Stand Defiant');
  });

  it('prints the Moves reference as a summary by default, in full on request, and not at all when off', () => {
    const moveTier = library.moves[0].Results.Tier3.Description;
    const text = (moves?: 'off' | 'summary' | 'full') => pageText(render(<PrintSheet library={library} sheet={null} moves={moves} />).container);
    const summary = text();
    const basic = library.moves.filter((m) => m.Kind === 'Basic');
    for (const m of basic) expect(summary).toContain(norm(m.Name));
    for (const m of basic) expect(summary).toContain(norm(m.Description));
    for (const m of library.moves.filter((x) => x.Kind === 'Adventure')) expect(summary).not.toContain(norm(m.Description));
    expect(summary).not.toContain(norm(moveTier));
    cleanup();
    expect(text('full')).toContain(norm(moveTier));
    cleanup();
    expect(text('off')).not.toContain(library.moves[0].Name);
  });
});

// ---------- (c) the maps name exactly the fields the data has ----------

describe('print coverage maps', () => {
  it('list exactly the fields of the aggregates', () => {
    const sheet = normalizeSheet(structuredClone(seedSheets()[0]));
    expect(keyMismatch(SHEET_PRINT_COVERAGE, sheet)).toEqual([]);
    expect(keyMismatch(LIBRARY_PRINT_COVERAGE, library)).toEqual([]);
    expect(keyMismatch(PARTY_PRINT_COVERAGE, normalizeParty(structuredClone(seedParty())))).toEqual([]);
    expect(keyMismatch(BOND_PRINT_COVERAGE, normalizeBond(seedBonds()[0]))).toEqual([]);
    expect(keyMismatch(CHARACTER_PRINT_COVERAGE, characters[0])).toEqual([]);
    expect(keyMismatch(SETTINGS_PRINT_COVERAGE, library.settings)).toEqual([]);
    expect(keyMismatch(VIRTUE_PRINT_COVERAGE, library.virtues[0])).toEqual([]);
    expect(keyMismatch(CONDITION_PRINT_COVERAGE, library.conditions[0])).toEqual([]);
    expect(keyMismatch(ARMOR_TYPE_PRINT_COVERAGE, library.armorTypes[0])).toEqual([]);
    expect(keyMismatch(LOAD_TIER_PRINT_COVERAGE, library.loadTiers[0])).toEqual([]);
  });

  it('cover every key of the nested rows (a key in the data but not the map fails; optional keys may be absent from a row)', () => {
    const sheet = richSheet();
    const rows: [string, Record<string, unknown>, object[]][] = [
      ['VirtueValue', VIRTUE_VALUE_PRINT_COVERAGE, sheet.Virtues],
      ['CharacterStatus', STATUS_PRINT_COVERAGE, sheet.Statuses],
      ['CharacterArmor', ARMOR_PRINT_COVERAGE, sheet.Armor],
      ['CharacterMotif', MOTIF_PRINT_COVERAGE, sheet.Motifs],
      ['CharacterLoad', LOAD_PRINT_COVERAGE, [sheet.Load]],
      ['CharacterItem', ITEM_PRINT_COVERAGE, sheet.Items],
      ['WildcardDeclaration', WILDCARD_PRINT_COVERAGE, sheet.WildcardDeclarations],
      ['SheetReminder', REMINDER_PRINT_COVERAGE, sheet.Reminders],
      ['Scar', SCAR_PRINT_COVERAGE, sheet.Scars],
      ['HeroEnding', ENDING_PRINT_COVERAGE, [deadSheet().Ending!]],
      ['TakenImprovement', IMPROVEMENT_PRINT_COVERAGE, sheet.Improvements],
      ['PartyCampAsset', CAMP_ASSET_PRINT_COVERAGE, party.CampAssets],
      ['BondMoveEntry', BOND_MOVE_PRINT_COVERAGE, bonds.flatMap((b) => b.BondMoves)],
      ['Item', LIBRARY_ITEM_PRINT_COVERAGE, library.items],
      ['Move', MOVE_PRINT_COVERAGE, library.moves],
    ];
    const problems = rows.flatMap(([name, cov, samples]) => samples.flatMap((s) => keyMismatch(cov, s, 'subset').map((p) => `${name}: ${p}`)));
    expect(problems).toEqual([]);
  });

  it('notice a missing or a surplus key (the check itself works)', () => {
    const sheet = normalizeSheet(structuredClone(seedSheets()[0]));
    const withoutLooks = { ...SHEET_PRINT_COVERAGE } as Record<string, Coverage>;
    delete withoutLooks.Looks;
    expect(keyMismatch(withoutLooks, sheet)).toEqual(['data has "Looks", coverage map does not']);
    const withGhost = { ...SHEET_PRINT_COVERAGE, Ghost: { printed: true, where: 'nowhere' } } as Record<string, Coverage>;
    expect(keyMismatch(withGhost, sheet)).toEqual(['coverage map has "Ghost", data does not']);
  });

  it('give every unprinted field a reason and every printed one a place', () => {
    const all: Record<string, Coverage>[] = [
      SHEET_PRINT_COVERAGE, VIRTUE_VALUE_PRINT_COVERAGE, STATUS_PRINT_COVERAGE, ARMOR_PRINT_COVERAGE, MOTIF_PRINT_COVERAGE,
      LOAD_PRINT_COVERAGE, ITEM_PRINT_COVERAGE, WILDCARD_PRINT_COVERAGE, REMINDER_PRINT_COVERAGE, SCAR_PRINT_COVERAGE,
      ENDING_PRINT_COVERAGE, IMPROVEMENT_PRINT_COVERAGE, CHARACTER_PRINT_COVERAGE, PARTY_PRINT_COVERAGE, CAMP_ASSET_PRINT_COVERAGE,
      BOND_PRINT_COVERAGE, BOND_MOVE_PRINT_COVERAGE, LIBRARY_PRINT_COVERAGE, VIRTUE_PRINT_COVERAGE, CONDITION_PRINT_COVERAGE,
      ARMOR_TYPE_PRINT_COVERAGE, LIBRARY_ITEM_PRINT_COVERAGE, LOAD_TIER_PRINT_COVERAGE, MOVE_PRINT_COVERAGE, SETTINGS_PRINT_COVERAGE,
    ];
    const empty = all.flatMap((m) => Object.entries(m).filter(([, c]) => (c.printed ? !c.where.trim() : !c.reason.trim())).map(([k]) => k));
    expect(empty).toEqual([]);
  });
});
