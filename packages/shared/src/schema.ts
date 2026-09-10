import type { LibraryCollectionKey } from './types.js';

export type FieldType = 'text' | 'textarea' | 'int' | 'bool' | 'enum' | 'ref' | 'multiref' | 'taglist' | 'json' | 'moveResults' | 'statusLimits';

export interface FieldDef {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  default?: unknown;
  hint?: string;
  options?: string[]; // enum
  collection?: LibraryCollectionKey; // ref / multiref
  /** enum only — lets an author type a value not in `options` instead of being confined to the
   *  list. Opt-in per field, never a blanket loosening of `FieldType: 'enum'`: some enums (e.g.
   *  `Toughness`) drive branching game logic, and a write-in there would silently degrade to "no
   *  effect" with no error. Only set this on a field the code never switches on. */
  allowCustom?: boolean;
}

export interface CollectionDef {
  key: LibraryCollectionKey;
  label: string;
  singular: string;
  idPrefix: string;
  fields: FieldDef[];
}

/**
 * Field definitions for every library collection, ported from design/_shared/schema.js.
 * The admin panel's CRUD screens are generated from this — a new game object type is an
 * entry here, not a new screen.
 */
export const collections: CollectionDef[] = [
  { key: 'virtues', label: 'Virtues', singular: 'Virtue', idPrefix: 'v', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Tagline', type: 'text' },
    { name: 'Essence', type: 'textarea' },
    { name: 'UsageHelperText', type: 'textarea', label: 'Use it when you want…' },
  ] },
  { key: 'conditions', label: 'Conditions', singular: 'Condition', idPrefix: 'c', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'VirtueId', type: 'ref', collection: 'virtues', label: 'Virtue' },
    { name: 'RollPenalty', type: 'int', default: -2 },
    { name: 'ClearAction', type: 'textarea' },
  ] },
  { key: 'armorTypes', label: 'Armor Types', singular: 'Armor Type', idPrefix: 'a', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Key', type: 'enum', options: ['Physical', 'Heavy', 'Special'] },
    { name: 'Description', type: 'textarea' },
  ] },
  { key: 'items', label: 'Items', singular: 'Item', idPrefix: 'i', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Description', type: 'textarea' },
    { name: 'LoadCost', type: 'int', default: 1, hint: '0 concealable · 1 standard · 2 cumbersome' },
    { name: 'Charges', type: 'int', default: 0, hint: '0 for no charges' },
    { name: 'GrantsArmorTypeId', type: 'ref', collection: 'armorTypes', label: 'Grants Armor' },
  ] },
  { key: 'motifs', label: 'Motifs', singular: 'Motif', idPrefix: 'mo', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Description', type: 'textarea' },
    { name: 'SkillTagExamples', type: 'taglist', label: 'Skill Tag Examples' },
    { name: 'FlawTagExamples', type: 'taglist', label: 'Flaw Tag Examples' },
  ] },
  { key: 'improvementTrees', label: 'Improvement Trees', singular: 'Improvement Tree', idPrefix: 'it', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Category', type: 'enum', options: ['Combat', 'Narrative'] },
    { name: 'Description', type: 'textarea' },
  ] },
  { key: 'improvements', label: 'Improvements', singular: 'Improvement', idPrefix: 'im', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'TreeId', type: 'ref', collection: 'improvementTrees', label: 'Tree', required: true },
    { name: 'IsStarting', type: 'bool', label: 'Starting Improvement', hint: 'No prerequisite needed — always available on this tree.' },
    { name: 'PrerequisiteIds', type: 'multiref', collection: 'improvements', label: 'Prerequisites', hint: 'Must be on the same tree — holding any one of these unlocks this node.' },
    { name: 'Effect', type: 'textarea' },
  ] },
  { key: 'moves', label: 'Moves', singular: 'Move', idPrefix: 'm', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Kind', type: 'enum', options: ['Basic', 'Adventure'] },
    { name: 'VirtueId', type: 'ref', collection: 'virtues', label: 'Virtue', hint: 'Blank for "any Virtue" moves' },
    { name: 'Description', type: 'textarea' },
    { name: 'Results', type: 'moveResults', required: true, hint: 'Tier3 = 10+, Tier2 = 7–9, Tier1 = miss' },
    { name: 'PlayerVariantResults', type: 'moveResults', label: 'On a Player', hint: 'Optional second result set' },
    { name: 'HoldGrant', type: 'json', hint: 'Optional — { "Tier3": 3, "Tier2": 1 }. Only for Moves that grant Hold directly on a roll (e.g. Assess the Situation, Discern the Truth).' },
  ] },
  { key: 'glossary', label: 'Glossary', singular: 'Term', idPrefix: 'g', fields: [
    { name: 'Name', type: 'text', required: true, hint: 'The canonical, capitalized form matched in text (e.g. "Condition")' },
    { name: 'Aliases', type: 'taglist', hint: 'Other capitalized forms that should link here too, e.g. plurals or "Mark Bond"' },
    { name: 'Definition', type: 'textarea', required: true },
  ] },
  { key: 'campAssets', label: 'Camp Assets', singular: 'Camp Asset', idPrefix: 'ca', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Description', type: 'textarea' },
    { name: 'Tier', type: 'int', default: 1, hint: 'Higher tiers grant more protection as the party progresses.' },
    { name: 'Effect', type: 'textarea' },
  ] },
  { key: 'enemies', label: 'Enemies', singular: 'Enemy', idPrefix: 'en', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Description', type: 'textarea' },
    { name: 'IsBoss', type: 'bool' },
    { name: 'GambitCharges', type: 'int', hint: 'Boss enemies only — a numbered Gambit-charge pool, pulling from the same Gambit list as Heroes.' },
    { name: 'Toughness', type: 'enum', options: ['None', 'Medium', 'Heavy'], hint: 'Medium: -2 to incoming Strain. Heavy: treat as one tier lower.' },
    { name: 'StatusLimits', type: 'statusLimits', hint: 'Defeated once any one Status reaches its Limit.' },
  ] },
  { key: 'villains', label: 'Villains', singular: 'Villain', idPrefix: 'vil', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Aspects', type: 'taglist', hint: '2-3 short tags — a notable physical feature, how they carry themselves.' },
    { name: 'Goal', type: 'textarea', hint: 'What concrete objective are they presently trying to accomplish?' },
    { name: 'Scar', type: 'textarea', hint: 'The psychological or environmental wound driving their behavior.' },
    { name: 'SkillTags', type: 'taglist', label: 'Skill Tags', hint: '3-5 words or phrases — powers, behaviors, or habits.' },
    { name: 'Resources', type: 'taglist', hint: 'Important NPCs, locations, items, secrets, and ties to the Heroes — things the party might try to remove from their control.' },
    { name: 'Powers', type: 'textarea', hint: 'Unique ways they impact the world even outside Combat.' },
    { name: 'Attacks', type: 'textarea', hint: 'Two or three Combat Attacks — freeform, since this app has no Ability system to build a structured attack list against.' },
    { name: 'Resistances', type: 'textarea', hint: 'What cannot affect them without special positioning.' },
    { name: 'Vulnerabilities', type: 'textarea', hint: 'What can disrupt that protection.' },
    { name: 'Toughness', type: 'enum', options: ['None', 'Medium', 'Heavy'], hint: 'Medium: -2 to incoming Strain. Heavy: treat as one tier lower.' },
    { name: 'StatusLimits', type: 'statusLimits', label: 'Status Limits', hint: 'How they can be defeated, converted, driven away, contained, exposed, or otherwise removed from the conflict.' },
  ] },
  { key: 'npcs', label: 'NPCs', singular: 'NPC', idPrefix: 'npc', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Aspects', type: 'taglist', hint: '2-3 details that make their presence memorable.' },
    { name: 'Type', type: 'enum', options: ['Meddler', 'Minion', 'Gossip', 'Ally', 'Guard', 'Opportunist', 'Skeptic', 'Victim', 'Witness'], allowCustom: true, hint: 'Their function to you as a GM — not how they act or what they want. Pick one, or type your own.' },
    { name: 'Goal', type: 'textarea', hint: 'A simple statement of what they want.' },
    { name: 'HeroConnection', type: 'textarea', label: 'Hero Connection', hint: 'Optional — an interesting tie to one or more Heroes’ Background, Goals, or Quests.' },
    { name: 'SkillTags', type: 'taglist', label: 'Skill Tags', hint: '3-5 words or phrases — powers, behaviors, or habits.' },
    { name: 'IsCombatant', type: 'bool', label: 'Combatant?', hint: 'If capable in Combat, set Status Limits below (6 for a standard Combatant, likely 1-2 otherwise).' },
    { name: 'StatusLimits', type: 'statusLimits', label: 'Status Limits' },
  ] },
  { key: 'locations', label: 'Locations', singular: 'Location', idPrefix: 'loc', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Aspects', type: 'taglist', hint: '3 tags describing important, notable, or useful features the Heroes can interact with.' },
    { name: 'LocationType', type: 'enum', label: 'Type', options: ['Nexus', 'Deathtrap', 'Lair', 'Citadel', 'Lab', 'Archive', 'Labyrinth', 'Gaol', 'Wilds'], allowCustom: true, hint: 'Pick one, or type your own.' },
    { name: 'CustomMoves', type: 'textarea', label: 'Custom Moves', hint: 'Optional — one or more custom moves specific to this Location.' },
  ] },
];

export const settingsFields: FieldDef[] = [
  { name: 'PotentialTrackLength', type: 'int', label: 'Potential track length' },
  { name: 'RapportTrackLength', type: 'int', label: 'Rapport track length' },
  { name: 'BondTrackLength', type: 'int', label: 'Bond track length' },
  { name: 'StrainTrackLength', type: 'int', label: 'Strain boxes', hint: 'Boxes on the Strain track. No higher box free (and no Status can absorb the rest) triggers Subdued.' },
  { name: 'ConditionFloor', type: 'int', label: 'Condition penalty floor' },
  { name: 'HealingTrackLength', type: 'int', label: 'Healing Track segments', hint: 'Filling it downgrades every held Status by one severity, then clears.' },
  { name: 'MinorStatusSlots', type: 'int', label: 'Minor Status slots' },
  { name: 'MajorStatusSlots', type: 'int', label: 'Major Status slots' },
  { name: 'SevereStatusSlots', type: 'int', label: 'Severe Status slots' },
  { name: 'GlossaryAutoLink', type: 'bool', label: 'Glossary auto-linking', hint: 'Off retires the regex term-matcher library-wide. Explicit [Term] tags keep working either way.' },
];

export function getCollection(key: string): CollectionDef | null {
  return collections.find((c) => c.key === key) ?? null;
}
