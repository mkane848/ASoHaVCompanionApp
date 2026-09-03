import type { LibraryCollectionKey } from './types.js';

export type FieldType = 'text' | 'textarea' | 'int' | 'bool' | 'enum' | 'ref' | 'multiref' | 'taglist' | 'json' | 'moveResults';

export interface FieldDef {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  default?: unknown;
  hint?: string;
  options?: string[]; // enum
  collection?: LibraryCollectionKey; // ref / multiref
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
    { name: 'AdvantageTrigger', type: 'enum', options: ['wealthSpend', 'selfReport'], hint: 'Optional — wealthSpend: spending 1 Wealth grants Advantage on this roll. selfReport: a self-reported checkbox grants Advantage. Leave blank for the default informational-only explainer.' },
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
    { name: 'Toughness', type: 'enum', options: ['None', 'Medium', 'Heavy'], hint: 'Medium: -2 to incoming Status Ranks. Heavy: treat as one tier lower.' },
    { name: 'StatusLimits', type: 'json', hint: '[{ "StatusName": "Hurt", "Limit": 4 }, ...] -- defeated once any one is reached.' },
  ] },
];

export const settingsFields: FieldDef[] = [
  { name: 'PotentialTrackLength', type: 'int', label: 'Potential track length' },
  { name: 'RapportTrackLength', type: 'int', label: 'Rapport track length' },
  { name: 'BondTrackLength', type: 'int', label: 'Bond track length' },
  { name: 'StatusMaxRank', type: 'int', label: 'Status boxes', hint: 'Boxes on a Status row. The last one is the Subdued overflow — a Negative Status reaching it triggers Subdued rather than being a normal Rank.' },
  { name: 'ConditionFloor', type: 'int', label: 'Condition penalty floor' },
  { name: 'RecoveriesMax', type: 'int', label: 'Recoveries per character', hint: 'Refills at Make Camp. Spent 1-for-1 to heal a Status.' },
  { name: 'GlossaryAutoLink', type: 'bool', label: 'Glossary auto-linking', hint: 'Off retires the regex term-matcher library-wide. Explicit [Term] tags keep working either way.' },
];

export function getCollection(key: string): CollectionDef | null {
  return collections.find((c) => c.key === key) ?? null;
}
