import type { LibraryCollectionKey } from './types.js';

export type FieldType = 'text' | 'textarea' | 'int' | 'bool' | 'enum' | 'ref' | 'multiref' | 'taglist' | 'json';

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
  { key: 'themes', label: 'Themes', singular: 'Theme', idPrefix: 't', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Description', type: 'textarea' },
    { name: 'StartingQuestId', type: 'ref', collection: 'quests', label: 'Starting Quest' },
    { name: 'QuestIds', type: 'multiref', collection: 'quests', label: 'Available Quests' },
  ] },
  { key: 'quests', label: 'Quests', singular: 'Quest', idPrefix: 'q', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'ThemeId', type: 'ref', collection: 'themes', label: 'Theme' },
    { name: 'Description', type: 'textarea' },
  ] },
  { key: 'skills', label: 'Skills', singular: 'Skill', idPrefix: 's', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Effect', type: 'textarea' },
  ] },
  { key: 'advancements', label: 'Advancements', singular: 'Advancement', idPrefix: 'ad', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Track', type: 'enum', options: ['Potential', 'Rapport'] },
    { name: 'Tier', type: 'int', default: 1, hint: '1–4' },
    { name: 'Repeatable', type: 'bool' },
    { name: 'MaxTimes', type: 'int', hint: 'blank for unlimited' },
    { name: 'Effect', type: 'textarea' },
  ] },
  { key: 'abilities', label: 'Abilities', singular: 'Ability', idPrefix: 'ab', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'RulesText', type: 'textarea', required: true, label: 'Rules Text', hint: 'Authoritative. Always shown to the player.' },
    { name: 'Acquisition', type: 'enum', options: ['Starting', 'Advancement', 'Item', 'Bond', 'Other'] },
    { name: 'Tags', type: 'taglist' },
    { name: 'Effects', type: 'json', hint: 'Optional structured metadata for a future rules engine. Prose above stays authoritative.' },
  ] },
  { key: 'moves', label: 'Moves', singular: 'Move', idPrefix: 'm', fields: [
    { name: 'Name', type: 'text', required: true },
    { name: 'Kind', type: 'enum', options: ['Basic', 'Adventure'] },
    { name: 'VirtueId', type: 'ref', collection: 'virtues', label: 'Virtue', hint: 'Blank for "any Virtue" moves' },
    { name: 'Description', type: 'textarea' },
    { name: 'Results', type: 'json', hint: 'Tier3 = 10+, Tier2 = 7–9, Tier1 = miss' },
    { name: 'PlayerVariantResults', type: 'json', label: 'On a Player', hint: 'Optional second result set' },
  ] },
  { key: 'glossary', label: 'Glossary', singular: 'Term', idPrefix: 'g', fields: [
    { name: 'Name', type: 'text', required: true, hint: 'The canonical, capitalized form matched in text (e.g. "Condition")' },
    { name: 'Aliases', type: 'taglist', hint: 'Other capitalized forms that should link here too, e.g. plurals or "Mark Kin"' },
    { name: 'Definition', type: 'textarea', required: true },
  ] },
];

export const settingsFields: FieldDef[] = [
  { name: 'AbilitiesAtCreation', type: 'int', label: 'Abilities at creation', hint: 'How many Abilities a new character picks.' },
  { name: 'SkillsAtCreation', type: 'int', label: 'Skills at creation', hint: 'How many Skills a new character picks.' },
  { name: 'PotentialTrackLength', type: 'int', label: 'Potential track length' },
  { name: 'RapportTrackLength', type: 'int', label: 'Rapport track length' },
  { name: 'KinTrackLength', type: 'int', label: 'Kin track length' },
  { name: 'StatusMaxRank', type: 'int', label: 'Status max rank', hint: 'A Negative Status reaching this Rank triggers Subdued instead of a normal mark.' },
  { name: 'ConditionFloor', type: 'int', label: 'Condition penalty floor' },
  { name: 'AdvancementTier2At', type: 'int', label: 'Advancements for Tier 2' },
  { name: 'AdvancementTier3At', type: 'int', label: 'Advancements for Tier 3' },
  { name: 'AdvancementTier4At', type: 'int', label: 'Advancements for Tier 4' },
  { name: 'RecoveriesMax', type: 'int', label: 'Recoveries per character', hint: 'Refills at Make Camp. Spent 1-for-1 to heal a Status.' },
];

export function getCollection(key: string): CollectionDef | null {
  return collections.find((c) => c.key === key) ?? null;
}
