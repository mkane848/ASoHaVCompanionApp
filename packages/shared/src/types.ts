/**
 * ASoHaV reconciled data model.
 * Source of truth: Planning Docs handoff README + Character Sheet Plan (§2-4) + design/_shared/*.js.
 * These shapes ARE the wire contract — the JSON a client sends/receives and the eventual
 * GM-tooling import format. Keep them stable; add fields rather than renaming.
 */

// ---------- Content Library (authored in the admin panel, read-only to players) ----------

export interface Virtue {
  Id: string;
  Name: string;
  Tagline: string;
  Essence: string;
  UsageHelperText: string;
}

export type VirtueKey = 'v-might' | 'v-mettle' | 'v-heart' | 'v-wit' | 'v-guile';

export interface Condition {
  Id: string;
  Name: string;
  VirtueId: string;
  RollPenalty: number; // default -2
  ClearAction: string;
}

export type ArmorKey = 'Physical' | 'Heavy' | 'Special';

export interface ArmorType {
  Id: string;
  Name: string;
  Key: ArmorKey;
  Description: string;
}

export interface Item {
  Id: string;
  Name: string;
  Description: string;
  LoadCost: 0 | 1 | 2;
  Charges?: number;
  GrantsArmorTypeId?: string | null;
}

/** A Motif is the core aspect of a Hero — one of three per character, replacing the single Theme
 *  of the pre-V0.5 ruleset. Each Motif is a bucket for that Hero's Skill Tags, Flaw Tags, its own
 *  Potential track, and a Quest. Players choose from the 13 canonical Motifs (or write their own)
 *  and may rename any of them to fit their character's flavor. */
export interface Motif {
  Id: string;
  Name: string;
  Description: string;
  SkillTagExamples: string[];
  FlawTagExamples: string[];
}

/** V0.5's authored Hero Improvements: 11 Combat + 14 Narrative trees (Ruleset-V0.5.md, "Hero
 *  Improvements"). `library.improvementTrees` names and themes them; `library.improvements`
 *  holds their actual nodes. Party and Bond get an "Improvement" mention too (the doc's own
 *  "Party Motif + Improvements"/"Bond Track + Improvements" headers), but neither names any
 *  trees at all — both sections read "Here that is!" with nothing under them — so this slice
 *  only builds the Hero side; see HANDOFF.md open issue 12 for the gap. */
export type ImprovementCategory = 'Combat' | 'Narrative';

export interface ImprovementTree {
  Id: string;
  Name: string;
  Category: ImprovementCategory;
  Description: string;
}

/** One node on an Improvement Tree, replacing the flat Tier-gated `Advancement` list (slice 4).
 *  Gating is DAG-only, per Ruleset-V0.5.md's own current rule (lines 458/489): take a Starting
 *  Improvement on any tree, or one connected to an Improvement you already hold on that same
 *  tree; each takeable once. The doc's separate "Level Up"/"Progress the Party" section names a
 *  Tier-1..4-and-Level gate instead — read as leftover text from an earlier, unreconciled draft
 *  (it pastes the old flat-list gate onto the newer tree model, and nowhere else in the doc
 *  assigns a Tier to a tree node) and deliberately not implemented; confirmed with the repo
 *  owner rather than guessed — see HANDOFF.md open issue 12. `PrerequisiteIds` only ever names
 *  other Improvements on the same `TreeId`; nothing here validates that at the type level, but
 *  `apps/server/src/adminLogic.ts`'s `validateLibrary` does. */
export interface Improvement {
  Id: string;
  TreeId: string;
  Name: string;
  Effect: string;
  IsStarting: boolean;
  PrerequisiteIds: string[];
}

export interface MoveResult {
  Description: string;
  Options: string[];
  ChooseCount: number;
}

export interface MoveResults {
  Tier3: MoveResult; // 10+
  Tier2: MoveResult; // 7-9
  Tier1: MoveResult; // miss
}

export type MoveKind = 'Basic' | 'Adventure';

export interface Move {
  Id: string;
  Name: string;
  Kind: MoveKind;
  VirtueId: string | null;
  Description: string;
  Results: MoveResults;
  PlayerVariantResults?: MoveResults | null;
  /** Hold this Move grants directly on a reported roll tier (V0.5 slice 3) — e.g. Assess the
   *  Situation grants 3 on a 10+. Only the two Moves whose Hold grant is a literal number carry
   *  this; every other Move's Tier results stay freeform reference text with no mechanical hook.
   *  Missing/omitted for a tier means that tier grants no Hold. See `holdGrantForTier()`
   *  (`engine.ts`) for how this is applied once a player reports which tier they hit. */
  HoldGrant?: Partial<Record<'Tier3' | 'Tier2' | 'Tier1', number>>;
}

/** A rules term or phrase whose definition should be reachable as an inline tap-link anywhere it
 *  appears in authored text (move/skill/ability descriptions, etc.) — see `glossary.ts`'s
 *  `buildGlossaryMatcher`/`linkifyText`. Deliberately its own collection rather than borrowing
 *  `Description`-shaped fields off existing entities: general mechanics referenced in prose
 *  ("Condition", "Bond", "Hold") often have no single matching entity — `conditions` holds five
 *  specific per-Virtue Conditions, not the mechanic itself. `Name` doubles as the canonical
 *  matched phrase; `Aliases` covers other forms (plurals, "Mark Bond" vs "Bond") that should link
 *  to the same definition without duplicating it. */
export interface GlossaryTerm {
  Id: string;
  Name: string;
  Aliases: string[];
  Definition: string;
}

export interface GameSettings {
  Id: string;
  PotentialTrackLength: number;
  RapportTrackLength: number;
  BondTrackLength: number;
  /** Boxes on the Strain track (V0.6 slice 1) — was `StatusMaxRank`, the old 6-box ranked-Status
   *  row. The doc's own draft leaves this an open question ("is 5 the right number for these?
   *  Could be 3 + Mettle?") — kept configurable rather than guessed at further. */
  StrainTrackLength: number;
  ConditionFloor: number;
  /** Segments on the Healing Track (V0.6 slice 1) — fills via Recuperate, and downgrades every
   *  held Status by one severity when full (see `advanceHealingTrack`/`downgradeStatuses` in
   *  `engine.ts`). Replaces `RecoveriesMax`/spending Recoveries entirely. */
  HealingTrackLength: number;
  /** Status severity slot counts (V0.6 slice 1) — Minor x3, Major x2, Severe x1 per the doc's own
   *  worked table. Kept configurable, same reasoning as every other track length here. */
  MinorStatusSlots: number;
  MajorStatusSlots: number;
  SevereStatusSlots: number;
  /** Library-wide kill switch for the regex auto-linker in `glossary.ts` (0.24.0). Defaults
   *  `true` so existing authored text keeps linking exactly as it does today. A field with at
   *  least one explicit `[Term]` tag always disables auto-linking for that one field regardless
   *  of this setting; this flag is for retiring the regex matcher library-wide once content has
   *  fully migrated to explicit tags. */
  GlossaryAutoLink: boolean;
}

export interface LoadTierDef {
  Key: 'Light' | 'Normal' | 'Heavy';
  Base: number;
  Note: string;
}

/** How much a Toughness tier blunts an incoming Status Rank in Combat — see
 *  `applyToughness()` in `combat.ts`. 'None' is the default for a rank-and-file enemy. */
export type ToughnessTier = 'None' | 'Medium' | 'Heavy';

export interface EnemyStatusLimit {
  StatusName: string;
  Limit: number;
}

/** A reusable enemy stat block, authored in Content Admin — spawned into a live Encounter as a
 *  `CombatParticipant` (which carries its own copy of Toughness/StatusLimits/Statuses, so a
 *  spawned enemy can be tweaked per-fight without touching the template). Ad-hoc, un-saved
 *  enemies skip this collection entirely and are built directly as a `CombatParticipant`. */
export interface EnemyTemplate {
  Id: string;
  Name: string;
  Description: string;
  IsBoss: boolean;
  Toughness: ToughnessTier;
  StatusLimits: EnemyStatusLimit[];
  /** Boss-only (slice 5): "Boss Enemies have a set number of Gambits they can use (pulling from
   *  the same list of Gambits as the Heroes)" — a plain resource count, not simulated Gambit
   *  content. Undefined/0 for an ordinary enemy. Carried onto the spawned `CombatParticipant` by
   *  `newParticipant()` so it can be decremented per-fight without touching the template. */
  GambitCharges?: number;
}

/** An authored Camp Asset (Ruleset-V0.5.md, "Pick starting Camp Assets" — the party's own "magic
 *  camp item" that levels up through Tiers as they progress). Slice 7 gives this the same
 *  ad-hoc-or-library shape `EnemyTemplate` established for Combat (`0.15.0`): a party can hold one
 *  pulled from this catalog, or a fully custom one typed on the spot — see `PartyCampAsset`. */
export interface CampAssetTemplate {
  Id: string;
  Name: string;
  Description: string;
  Tier: number;
  Effect: string;
}

/** An authored GM stat block for an Adventure's antagonist (slice 8, Ruleset-V0.5.md's "Villain"
 *  section — "Behind every Adventure is some sort of Villain... it might be a monster, person, or
 *  anomaly"). Reuses `ToughnessTier`/`EnemyStatusLimit` from `EnemyTemplate` for the Combat-facing
 *  half of a Villain's stat block ("Define Resistances and Vulnerabilities," "Set Status Limits")
 *  rather than inventing a parallel shape — this app has no Ability system to build "Give them
 *  Attacks"/"List Powers" against (V0.5 itself calls Attacks an "Enemy Ability Menu/Builder" as if
 *  unsure that exists either), so both stay freeform prose, the same treatment Bond Moves and Party
 *  Path got before any structured system existed for those either. This is authored content only
 *  — spawning a Villain into a live Combat Encounter as a Boss `CombatParticipant` is not part of
 *  this slice's scope (see CLAUDE.md's "Architecture: GM stat blocks"). */
export interface Villain {
  Id: string;
  Name: string;
  Aspects: string[];
  Goal: string;
  Scar: string;
  SkillTags: string[];
  /** "A short list of important NPCs, locations, items, secrets, and ties to the Heroes" — kept as
   *  short freeform phrases (a taglist), not `ref`s into `npcs`/`locations`: a Resource here is
   *  named before it necessarily exists as its own authored entity, and Adventures (slice 9) are
   *  where a Villain actually gets linked to specific NPCs/Locations. */
  Resources: string[];
  Powers: string;
  Attacks: string;
  Resistances: string;
  Vulnerabilities: string;
  Toughness: ToughnessTier;
  StatusLimits: EnemyStatusLimit[];
}

/** Ruleset-V0.5.md's nine NPC Types — "a quick reference to help you decide their purpose in the
 *  story... not how they act or what they want to be doing but what their function to you as a GM
 *  is." */
export type NPCType = 'Meddler' | 'Minion' | 'Gossip' | 'Ally' | 'Guard' | 'Opportunist' | 'Skeptic' | 'Victim' | 'Witness';

/** An authored supporting-cast entity (slice 8, Ruleset-V0.5.md's "NPCs" section). `StatusLimits`
 *  only matters when `IsCombatant` is true ("6 for a standard Combatant... likely 1 or 2" if not)
 *  — left on every NPC rather than split into a combatant-only sub-shape, the same "field present
 *  but only sometimes meaningful" treatment `EnemyTemplate.GambitCharges` already gets for
 *  non-Boss enemies. */
export interface NPC {
  Id: string;
  Name: string;
  Aspects: string[];
  /** Usually one of `NPCType`'s nine canonical values, but `schema.ts` marks this field
   *  `allowCustom` (0.37.0) — a write-in string is a deliberate, opt-in escape hatch, not a type
   *  error, since nothing in the app switches on `NPC.Type`. */
  Type: NPCType | string | null;
  Goal: string;
  HeroConnection: string;
  SkillTags: string[];
  IsCombatant: boolean;
  StatusLimits: EnemyStatusLimit[];
}

/** Ruleset-V0.5.md's nine Location Types — "Nexus: to bring people, magic, and things together,"
 *  etc. Named `LocationType` (the field, not just the doc's own "A Type") to avoid colliding in
 *  meaning with `NPC.Type`'s distinct nine-value enum on the same schema-driven admin surface. */
export type LocationType = 'Nexus' | 'Deathtrap' | 'Lair' | 'Citadel' | 'Lab' | 'Archive' | 'Labyrinth' | 'Gaol' | 'Wilds';

/** An authored place the Heroes are expected to spend time (slice 8, Ruleset-V0.5.md's
 *  "Locations" section). `CustomMoves` stays freeform prose ("Optionally, one or more custom
 *  moves") rather than a `Move`-shaped sub-list — a Location's custom move is table-authored flavor
 *  scoped to one place, not a reusable roll the rest of the app's Move machinery needs to know
 *  about, the same "write it together" treatment Bond Moves already get. */
export interface Location {
  Id: string;
  Name: string;
  Aspects: string[];
  /** Usually one of `LocationType`'s nine canonical values, but `schema.ts` marks this field
   *  `allowCustom` (0.37.0) — a write-in string is a deliberate, opt-in escape hatch, not a type
   *  error, since nothing in the app switches on `Location.LocationType`. */
  LocationType: LocationType | string | null;
  CustomMoves: string;
}

// ---------- Adventures (V0.5 slice 9) ----------

/** Ruleset-V0.5.md's six Adventure Types — "determines what kinds of activities the Heroes will
 *  engage in," each with the doc's own "Elements to include" guidance carried in `ADVENTURE_TYPES`
 *  (`adventures.ts`) rather than duplicated here on the type. */
export type AdventureType = 'Offensive' | 'Stand' | 'Race' | 'Mission' | 'Mystery' | 'Journey';

/** A single floating Secret — "a single, evocative sentence... never tie Secrets directly to
 *  specific NPCs, locations, or items" (hence no `LinkedToIds` the way a Status has). `Revealed`
 *  is GM bookkeeping ("has this come up in play yet"), not an access-control gate — this app has
 *  no field-level visibility split between GM and players anywhere else (Villain/NPC/Location
 *  stat blocks are equally readable by any authenticated member once fetched, just never rendered
 *  player-side), and Adventures follow that same precedent rather than inventing one; see
 *  CLAUDE.md's "Architecture: Adventures" for why. */
export interface AdventureSecret {
  Id: string;
  Text: string;
  Revealed: boolean;
}

/** The doc's own Countdown step names — "Divide those thoughts into the following six steps,"
 *  immediately followed by exactly five: Seed, Bloom, Wilt, Wither, Rot. This app doesn't invent a
 *  sixth to make the count match (WorkPlan-V0.5.md Section D item 12) — five is what ships, and
 *  the "six" in the prose stays a documented, carried-forward inconsistency in the source, not a
 *  bug here. */
export const ADVENTURE_COUNTDOWN_STEP_NAMES = ['Seed', 'Bloom', 'Wilt', 'Wither', 'Rot'] as const;
export type AdventureCountdownStepName = (typeof ADVENTURE_COUNTDOWN_STEP_NAMES)[number];

/** One named step of an Adventure's Countdown — GM prep text for "what happens at this stage of
 *  the Villain's plan if the Heroes don't interfere." */
export interface AdventureCountdownStep {
  Name: AdventureCountdownStepName;
  Text: string;
}

/** A GM-authored Adventure (Ruleset-V0.5.md's "Adventures" chapter — the fourth surface, alongside
 *  the Character Sheet, Content Admin, and the Campaign Shell). Campaign play-state, not library
 *  content — unlike `Villain`/`NPC`/`Location` (slice 8, shared authored stat blocks any campaign
 *  could reuse), an Adventure is one GM's specific combination of those for one specific campaign,
 *  so it lives alongside `Encounter`/`Clock` rather than in `Library`. `VillainId`/`NpcIds`/
 *  `LocationIds` are `Ref`s into the campaign's shared `library.villains`/`npcs`/`locations` —
 *  the doc's own "an Adventure references them, it does not redefine them" framing (WorkPlan-V0.5.md
 *  slice 9's Depends-on note). `Status` mirrors `Clock`'s `Open`/`Resolved` naming loosely (`Active`/
 *  `Concluded`) since a campaign may run several Adventures over its life — "the start of a new
 *  Adventure!" once a Villain's Goal is thwarted — the same "no single active row" shape `Clock`
 *  already established, not Combat's "one Active Encounter" shape. GM-authored and GM-only to write
 *  (unlike a Clock, which any campaign member may progress) — see CLAUDE.md's "Architecture:
 *  Adventures" for why this stays GM-only end to end rather than gaining a partial player-facing
 *  view. */
export interface Adventure {
  Id: string;
  CampaignId: string;
  Concept: string;
  Type: AdventureType | null;
  Hook: string;
  VillainId: string | null;
  NpcIds: string[];
  LocationIds: string[];
  Secrets: AdventureSecret[];
  CountdownSteps: AdventureCountdownStep[];
  /** How far the Countdown has progressed — 0 (not begun) through `CountdownSteps.length` (Rot
   *  reached). "A Countdown is a clock variant" (WorkPlan-V0.5.md slice 9 scope) — this reuses
   *  `Clock`'s own tick-and-clamp mechanic (`tickAdventureCountdown()` in `adventures.ts`, the same
   *  clamped-delta shape as `clocks.ts`'s `tickClock()`) rather than the `Clock` type itself.
   *  A real linked `Clock` row was the first design tried and deliberately dropped: every other
   *  Clock in this app is fully player-visible (ClocksPanel, Realtime-synced), but an Adventure's
   *  own Countdown is explicitly the GM's off-screen reference ("what is happening with the
   *  Villain when they are off-screen") — the doc's own distinction from a *Threat* (also
   *  Countdown-kind, but "player facing"), which stays a real, separately-created `Clock` reached
   *  through ClocksPanel as always. Embedding the count directly here keeps it inside the same
   *  GM-only boundary as the rest of the Adventure (never fetched for a Player, never Realtime-
   *  synced) with no new field-level access control needed — see CLAUDE.md's "Architecture:
   *  Adventures". */
  CountdownMarks: number;
  Status: 'Active' | 'Concluded';
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Creating the World (V0.6 slice 8) ----------

/** Step 1 of the five-step collaborative map build ("Where the Adventure Begins") —
 *  `Ruleset-V0.6.md`'s "Creating the World" chapter, adapted from *The Perilous Wilds*. One
 *  starting place per campaign, not a list — every later step (Regions, Places of Interest, ...)
 *  builds outward from it. `Details` is one freeform entry per player introducing a local-area
 *  detail ("a mysterious lighthouse, a thick forest..."); the seven scalar fields are the doc's
 *  own fixed prompts, asked in order, each a short freeform answer rather than a pick from a
 *  list — the doc gives illustrative examples ("prospering, floundering, etc.", "amicable,
 *  competitive, envious, charitable, etc.") for two of them, not an exhaustive set. `Rumors` is
 *  this step's own "each player shares one rumor about the place where the party will start" —
 *  kept separate from `World.Rumors` (Step 5's "a rumor about *any* place on the map"), since the
 *  doc frames them as two different prompts, not one list asked twice. */
export interface StartingPlace {
  Name: string;
  Details: string[];
  FamousFor: string;
  InfamousFor: string;
  ResourceSituation: string;
  ResourceConsequence: string;
  NotableOrganization: string;
  NearestNeighbor: string;
  NeighborRelationship: string;
  Rumors: string[];
}

/** Step 2 — "The Surrounding Regions." `Description` carries the doc's own "terrain type or
 *  political occupant" framing as freeform text rather than a forced two-way enum (a region is
 *  often both at once — "an imperial kingdom" names an occupant but implies terrain too) — the
 *  same "freeform text, no hidden bookkeeping" treatment every other Boon/Bane/Camp-Asset-style
 *  field in this app already gets. `Note` is the doc's own optional "one interesting truth or
 *  rumor about that region... but don't feel pressure to." */
export interface WorldRegion {
  Id: string;
  Name: string;
  Description: string;
  Note: string;
}

/** The doc names exactly three categories for Places of Interest (the step confusingly re-labeled
 *  "Step 2" in the source text a second time — see `World`'s own doc comment) — a real, closed
 *  list, unlike a region's freeform Description, so this is a genuine enum rather than free text. */
export type PlaceOfInterestType = 'Area' | 'Settlement' | 'Landmark';

/** Step 3 (doc's mislabeled second "Step 2") — "Places of Interest." */
export interface PlaceOfInterest {
  Id: string;
  Type: PlaceOfInterestType;
  Name: string;
  Description: string;
}

/** Step 4 — "Personal Places," one per player: "a place they call home or a place that holds some
 *  significance to them," plus "one event that happened there that was important to your
 *  character." The doc's own instructions ("starting with the eldest character," "except the GM")
 *  presuppose characters already exist; this app builds the World during the campaign's Signup
 *  phase, before Party Creation, so there's no `CharacterId` yet to attach one of these to (see
 *  `World`'s own doc comment on the sequencing difference) — `Name`/`Event` stay plain freeform
 *  text a contributor writes in their own words, same as everywhere else in this chapter. */
export interface PersonalPlace {
  Id: string;
  Name: string;
  Event: string;
}

/** Step 5 — "Create Connectors": "anything that helps people or things from A to B... a road, a
 *  river, a secret path, interplanar portals, or an arcane ley line." */
export interface Connector {
  Id: string;
  Name: string;
  Description: string;
}

/** Shared campaign world-building content — `Ruleset-V0.6.md`'s new "Creating the World" chapter
 *  (V0.6 slice 8, `WorkPlan-V0.6.md` Section C's Slice 8 bullet), CATS plus a five-step
 *  collaborative map build adapted from *The Perilous Wilds*. One row per campaign, the same
 *  "single shared JSONB blob" shape `Party` already established, since this is exactly that kind
 *  of content: collaboratively written, visible to and editable by the whole table at once, not
 *  authored library content and not one player's own sheet.
 *
 *  **CATS** (`Concept`/`Aim`/`Tone`/`SubjectMatter`) is a short one-time group discussion, not a
 *  mechanic — captured here as four freeform notes so the table has a durable record of what was
 *  agreed, not because the app enforces any of it.
 *
 *  **The five-step map build is genuinely six sections in the source text, not five — a real doc
 *  inconsistency, carried forward rather than silently fixed, the same discipline this app already
 *  applies to the Adventure Countdown's "five steps, prose promises six."** The chapter's own
 *  headers are "Step 1: Where the Adventure Begins," "Step 2: The Surrounding Regions," "Step 2:
 *  Places of Interest" (reusing "Step 2" a second time — a numbering slip, not a merged step; the
 *  two sections' own instructions are clearly sequential, "Now, starting with the player whose
 *  character is the most traveled..."), "Step 3: Personal Places," "Step 4: Create Connectors,"
 *  and "Step 5: Start Rumors." `WorkPlan-V0.6.md`'s own paraphrase ("starting place and its
 *  questions, surrounding regions, places of interest, personal places, connectors, opening
 *  rumors") lists all six while still calling it "five-step" — this app ships all six sections
 *  exactly as headed, and documents the mismatch rather than merging or dropping one to make the
 *  count match.
 *
 *  **World-building happens before character creation in this app, reversing the doc's own
 *  narrated order.** The chapter's prose has World-building follow Character Creation ("After
 *  you've done this, go ahead and create your characters... Now it is time to place them in a
 *  setting"), but `WorkPlan-V0.6.md`'s own Slice 8 scope calls this "a campaign Signup-phase
 *  surface" — and this app's `Campaign.Phase` model already reserves character creation for
 *  `PartyCreation`, the phase *after* Signup. Rather than reopen that phase ordering, World stays
 *  reachable (not phase-gated at all — see `apps/server/src/routes/world.ts`) for the life of the
 *  campaign, matching the doc's own "you don't need to know everything right now... you can add
 *  more of any of them as your adventure plays out." `PersonalPlace` is the one section this
 *  ordering change actually touches: see its own doc comment. */
export interface World {
  Id: string;
  CampaignId: string;
  Concept: string;
  Aim: string;
  Tone: string;
  SubjectMatter: string;
  StartingPlace: StartingPlace;
  Regions: WorldRegion[];
  PlacesOfInterest: PlaceOfInterest[];
  PersonalPlaces: PersonalPlace[];
  Connectors: Connector[];
  /** Step 5's own rumors — "a rumor their character has heard about any place on the map." See
   *  `StartingPlace.Rumors` for Step 1's separate, narrower rumor prompt. */
  Rumors: string[];
  UpdatedAt: string;
  UpdatedBy: string | null;
}

export interface Library {
  virtues: Virtue[];
  conditions: Condition[];
  armorTypes: ArmorType[];
  items: Item[];
  motifs: Motif[];
  improvementTrees: ImprovementTree[];
  improvements: Improvement[];
  moves: Move[];
  glossary: GlossaryTerm[];
  enemies: EnemyTemplate[];
  campAssets: CampAssetTemplate[];
  villains: Villain[];
  npcs: NPC[];
  locations: Location[];
  settings: GameSettings;
  loadTiers: LoadTierDef[];
}

export type LibraryCollectionKey =
  | 'virtues'
  | 'conditions'
  | 'armorTypes'
  | 'items'
  | 'motifs'
  | 'improvementTrees'
  | 'improvements'
  | 'moves'
  | 'glossary'
  | 'enemies'
  | 'campAssets'
  | 'villains'
  | 'npcs'
  | 'locations';

// ---------- Play state (per campaign) ----------

export type MembershipRole = 'GM' | 'Player';

export type CampaignStatus = 'Active' | 'Archived';

/** Lifecycle stage for the campaign-setup workflow, orthogonal to `Status` (which is purely the
 *  GM's archive/freeze toggle). `Signup`: open for invites, players may accept and join, nobody
 *  has a character yet. `PartyCreation`: the GM has closed signup; players fill out character
 *  sheets and mark themselves ready. `Playing`: the GM has started the campaign proper. Optional
 *  on the type (rather than required) so existing fixtures/tests that don't care about the
 *  campaign-setup workflow don't need updating — treat a missing value as `'PartyCreation'`
 *  everywhere it's read (matches the DB migration's backfill default for pre-existing rows, since
 *  an already-running campaign should keep letting a newly-invited player create a character
 *  rather than being retroactively locked out). */
export type CampaignPhase = 'Signup' | 'PartyCreation' | 'Playing';

export interface Campaign {
  Id: string;
  Name: string;
  GmUserId: string;
  CreatedAt: string;
  Status: CampaignStatus;
  Phase?: CampaignPhase;
}

export interface PublicUser {
  Id: string;
  Name: string;
}

export interface Membership {
  Id: string;
  UserId: string;
  CampaignId: string;
  Role: MembershipRole;
  CharacterId: string | null;
  /** Player has confirmed their character/setup choices are done during the `PartyCreation`
   *  phase — backs the GM's "N / M ready" readout. Optional for the same reason as `Campaign.Phase`
   *  above; treat a missing value as `false`. Meaningless for a GM membership. */
  Ready?: boolean;
}

export type InviteStatus = 'Pending' | 'Accepted' | 'Declined' | 'Revoked';

export interface Invite {
  Id: string;
  CampaignId: string;
  Email: string;
  Code: string;
  SentAt: string;
  Status: InviteStatus;
}

export interface Character {
  Id: string;
  Name: string;
  /** Freeform, same treatment as `Name` — V0.6 slice 5 (`WorkPlan-V0.6.md` Section A4 item 4):
   *  Hero Creation's own "Choose your Name, Pronouns, and Physical Description" names this
   *  alongside Name, but the ruleset gives no option list to pick from, so this is a plain text
   *  field rather than an enum. Set once at character creation and never mutated after — there is
   *  no update route for any `Character` field, `Name` included (see CLAUDE.md's "Virtue scores
   *  and Theme are read-only on the sheet" precedent: an edit affordance here would need the same
   *  kind of explicit repo-owner ask that precedent already required). */
  Pronouns: string;
  PlayerName: string;
  UserId: string;
  CampaignId: string;
}

export interface VirtueValue {
  VirtueId: string;
  Score: number; // -2..3
  ConditionMarked: boolean;
}

/** V0.6 slice 1: Statuses stop being ranked tracks. A Status is now a named lasting injury
 *  sitting in one of three severity slots — Minor (x`GameSettings.MinorStatusSlots`, default 3),
 *  Major (x2), Severe (x1) — replacing the `Marks: boolean[]`/`Polarity` ranked-box model
 *  (`0.28.0`-`0.41.0`). Whenever a Status is relevant to a roll, take its penalty: Minor -1,
 *  Major Disadvantage, Severe roll 1d6 instead of 2d6 — penalties never stack, only the
 *  highest-severity applicable Status counts (see `statusPenalty()`/`computeRollBreakdown()` in
 *  `engine.ts`). `Description` is the lasting-effect text the player writes down when they take
 *  it ("a lasting effect incurred from whatever has occurred"). */
export type StatusSeverity = 'Minor' | 'Major' | 'Severe';

export interface CharacterStatus {
  Id: string;
  Severity: StatusSeverity;
  Name: string;
  Description: string;
}

export interface CharacterArmor {
  Id: string;
  ArmorTypeId: string;
  Used: boolean;
  SourceId: string;
  SourceLabel: string;
}

export interface CharacterLoad {
  Tier: 'Light' | 'Normal' | 'Heavy';
  LatchedUntilCamp: boolean;
}

export interface CharacterItem {
  ItemId: string;
  Carried: boolean;
  ChargesUsed: number;
}

/** V0.6 slice 5, `WorkPlan-V0.6.md` Section A4 item 2 — an unused Load box declared as some
 *  ordinary or notable item on the fly, rather than one of `library.items`' pre-authored entries
 *  (`CharacterItem` above). Each one costs a flat 1 Load — there's no catalog `LoadCost` to look
 *  up for something invented at the table. `Persistent: false` ("ordinary") returns to the ether
 *  at Make Camp, freeing its box back up; `Persistent: true` ("named, magical, or plot-relevant")
 *  survives Make Camp and permanently consumes that Load box going forward — the doc's own
 *  wording for the distinction, which V0.6's own Load text never draws (it only describes the
 *  declaration half: "declare, at any time, that your character has any item ... by checking a
 *  Load Box"). See `carriedLoad()` in `logic.ts` for how these count toward capacity. */
export interface WildcardDeclaration {
  Id: string;
  Text: string;
  Persistent: boolean;
}

/** A held Improvement, recorded wherever it was taken from (a character's own `Improvements`, or
 *  `Party.RapportImprovementsTaken`) — renamed from `TakenAdvancement` (slice 4); no `Tier` field
 *  any more, since gating dropped Tiers entirely in favor of the DAG. */
export interface TakenImprovement {
  Id: string;
  Name: string;
  Effect: string;
  TakenAt: string;
}

export interface AdvancementHistoryEntry {
  Id: string;
  At: string;
  Action: string;
  Name?: string;
  Tier?: number;
  Effect?: string;
  By?: string;
  Note?: string;
}

/** A character's Motifs are fixed at three for life — advancement retitles or rewrites a Motif
 *  but never adds or removes one. `MotifId` is the canonical library Motif this started from
 *  (`null` for a custom one); `Name` is always the player's own wording and may diverge from the
 *  library Name once retitled. `ActBreaks`/`Forsakes` count 0..3, three completing or abandoning
 *  the Quest respectively. */
export interface CharacterMotif {
  MotifId: string | null;
  Name: string;
  SkillTags: string[];
  FlawTags: string[];
  Potential: number;
  Quest: string;
  ActBreaks: 0 | 1 | 2 | 3;
  Forsakes: 0 | 1 | 2 | 3;
}

export interface CharacterAdvancement {
  History: AdvancementHistoryEntry[];
}

/** A near-permanent consequence, free-text by design since the doc's own examples (lost limb,
 *  nightmares, ostracization, vampirism) are as varied as whatever caused them. Under V0.5 this
 *  was one of three choices at Subdued (`resolveRiskDeath` in `engine.ts`, retired in V0.6 slice
 *  1); V0.6 deletes the entire "Limits, Scars, & Death" section — Scars, Risk Death, Blaze of
 *  Glory and Total Party Subdual all vanish with no replacement — but keeps this field's data
 *  alive per the locked repo-owner decision (`Planning Docs/WorkPlan-V0.6.md`), so nothing
 *  already written is lost and a future Last Stand rule has somewhere to land. Nothing currently
 *  writes a new one; it's display-only until/unless a later slice gives it a fresh trigger. */
export interface Scar {
  Id: string;
  Text: string;
  At: string;
}

export interface CharacterSheet {
  Id: string;
  CharacterId: string;
  Looks: string;
  Virtues: VirtueValue[];
  /** A 5-box row (`GameSettings.StrainTrackLength`), same sparse-marking rule as everywhere else
   *  a box row appears in this app (`markRank`/`statusRank` in `engine.ts`): mark the box equal
   *  to the incoming value, or the next unmarked box to its right. Clears completely at the end
   *  of the scene or Combat in which it was taken — this app doesn't track scene boundaries, so
   *  clearing it is a player/GM action, not automatic. Replaces the old ranked-Status-row harm
   *  model (V0.6 slice 1); `Statuses` below now holds severity-slot injuries instead. */
  Strain: boolean[];
  Statuses: CharacterStatus[];
  /** Segments on the Healing Track (0..`GameSettings.HealingTrackLength`) — advances via
   *  Recuperate (`advanceHealingTrack()` in `engine.ts`); filling it downgrades every held Status
   *  by one severity (`downgradeStatuses()`) and clears back to 0, carrying remaining segments
   *  onto the fresh track. Replaces `Recoveries`/spending Recoveries entirely (V0.6 slice 1). */
  HealingTrack: number;
  /** Unranked situational tags (V0.6 slice 1) — more relevant Boons than Banes gives Advantage,
   *  more Banes than Boons gives Disadvantage, equal gives neither. Both clear the moment they
   *  stop applying to the situation; this app has no scene-boundary concept, so clearing either
   *  is a player/GM action rather than automatic. Freeform text, same "author it yourself, no
   *  catalog exists" treatment every other freeform tag list in this app gets. */
  Boons: string[];
  Banes: string[];
  Armor: CharacterArmor[];
  /** Always three Motifs — the fixed slots a Hero's identity lives in. */
  Motifs: CharacterMotif[];
  Load: CharacterLoad;
  Items: CharacterItem[];
  /** Ad-hoc, on-the-fly Load declarations — see `WildcardDeclaration`'s own doc comment (slice 5).
   *  Counted into `carriedLoad()` alongside `Items`; non-`Persistent` entries are cleared at Make
   *  Camp (`StatusesPanel.tsx`'s `makeCamp()`). */
  WildcardDeclarations: WildcardDeclaration[];
  Advancement: CharacterAdvancement;
  /** Hero Improvements this character holds, across every tree — the DAG-availability check
   *  (`improvementAvailability` in `logic.ts`) reads this to decide which nodes are unlockable
   *  next. Gained by clearing a Motif's Potential track and choosing "Gain a Hero Improvement"
   *  (`MotifPanel.tsx`); see `Improvement` in `types.ts` for the gating rule (slice 4). */
  Improvements: TakenImprovement[];
  /** Near-permanent consequences (V0.6 slice 1: "Retire the flow, keep the data" — Scars, Risk
   *  Death, Blaze of Glory and Total Party Subdual all vanish with no replacement, but this field
   *  survives so nothing already written is lost and a future Last Stand rule has somewhere to
   *  land). See `Scar`'s own doc comment. */
  Scars: Scar[];
  /** Personal spendable resources named in the doc (Follow a Lead, Enjoy Downtime, Gear Charges)
   *  — every mention in the doc is a "you"/per-player spend, never a shared party pool like
   *  Rapport, so both live on the character rather than `Party`. `0.17.0` audit found these named
   *  but never modeled; there's no earn mechanic in the doc either, so for now both are just a
   *  freely player/GM-adjusted counter (a `+`/`−` stepper on the sheet) — see HANDOFF.md for the
   *  deferred "should the GM grant these automatically" question. */
  Wealth: number;
  Treasure: number;
  /** A per-player pool, persisted rather than resolved in one sitting. **Granted** by the two
   *  Moves that name a literal Hold grant — Assess the Situation and Discern the Truth, via
   *  `holdGrantForTier()` from `MoveRollHelper.tsx`. **Spent** 1-for-1 through `SpendHoldModal.tsx`
   *  on refreshing a piece of Gear, clearing a Condition, marking a Bond, or marking Potential.
   *
   *  This comment described End the Session's own Hold economy until 0.50.0, five releases after
   *  slice 4 (0.45.0) deleted it. That left the grants with no matching spend anywhere in the
   *  codebase, so the number on the sheet only ever went up — a live broken mechanic rather than
   *  dead data, which is why the spends came back rather than the field being retired. Marking a
   *  Bond still routes through the propose/accept handshake: Hold buys the offer, not the mark. */
  Hold: number;
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Shared, table-owned state ----------

/** A Camp Asset a Party actually holds — `RefId` points at a `library.campAssets` entry when
 *  chosen from the catalog, `''` for a fully custom one typed on the spot (freeSolo). A
 *  point-in-time copy either way, same as a Combat participant's own copy of an `EnemyTemplate`:
 *  a later edit to the library entry doesn't reach a Party that already holds it. */
export interface PartyCampAsset {
  Id: string;
  RefId: string;
  Name: string;
  Description: string;
  Tier: number;
  Effect: string;
}

export interface Party {
  Id: string;
  CampaignId: string;
  /** No longer clamped to `0..GameSettings.RapportTrackLength` as of V0.6 slice 7 (`WorkPlan-V0.6.md`
   *  Section A4 item 1) — Rapport may exceed the cap, and the overflow is banked until the party
   *  Makes Camp, where it can fund more than one advance in the same sitting
   *  (`applyPartyRapportAdvance()` subtracts the cap rather than zeroing the field). Spending
   *  Rapport (Aid) before reaching Camp forfeits any banked overflow instead of spending from it —
   *  see `spendRapportForAid()`'s own doc comment for the worked example. */
  Rapport: number;
  RapportImprovementsTaken: TakenImprovement[];
  History: AdvancementHistoryEntry[];
  /** Same running counter as `CharacterSheet.Level`, party-scoped ("Progress the Party" clearing
   *  a full Rapport track) — gates nothing, see `CharacterSheet.Level`'s doc comment. */
  PartyLevel: number;
  /** The party's own shared identity (Ruleset-V0.5.md, "Define your Party Motif + Quest" /
   *  "Party Advancement — Rapport"), slice 7. No structured catalog exists for any of this in the
   *  source document — nor will one: Playbooks aren't part of the game's systems at all, confirmed
   *  directly by the repo owner (see `Improvement`'s doc comment for the parallel Hero-Improvement
   *  content gap, which is a different, still-open question) — so these are freeform, table-written
   *  text, the same treatment Quests and Bond Moves got before any catalog existed for those
   *  either. `SkillTags`/`WeaknessTags` mirror a Hero Motif's `SkillTags`/`FlawTags` at party scope
   *  (the doc's own wording for this section says "Weakness Tag", not "Flaw Tag" — kept as the
   *  doc's own term rather than forced to match Hero vocabulary). */
  Motif: string;
  Quest: string;
  SkillTags: string[];
  WeaknessTags: string[];
  /** The "PARTY PATH" End the Session question (Ruleset-V0.5.md: "Did we follow our PARTY PATH —
   *  unique for each Party Playbook, comes with a question to lead their playstyle" — a source
   *  quote, not a claim this app has a Playbook system). With no catalog to pick from, this is
   *  just the table's own written question, asked back to them by `EndSessionModal`. Distinct from
   *  `Goal` below: `Path` is a standing identity question, `Goal` is the party's current,
   *  changeable objective. */
  Path: string;
  /** The party's current objective — set or changed as a Camp Action ("Party Goal can be changed
   *  or set here... Rapport is gained at End of Session if they follow that style"). */
  Goal: string;
  CampAssets: PartyCampAsset[];
  UpdatedAt: string;
  UpdatedBy: string | null;
}

export interface BondMoveEntry {
  Level: number;
  Text: string;
  AuthoredAt: string;
}

export type BondChangeType = 'MarkBond' | 'SpendBond' | 'ForgeBond';

export interface BondPendingChange {
  Id: string;
  ProposedBy: string; // CharacterId
  Type: BondChangeType;
  Payload: { Delta?: number; Text?: string };
  Note: string;
  ProposedAt: string;
}

export interface BondHistoryEntry {
  Id: string;
  At: string;
  Action: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'spent';
  Type: BondChangeType;
  By: string;
  Note: string;
}

export interface Bond {
  Id: string;
  CampaignId: string;
  CharacterAId: string;
  CharacterBId: string;
  BondTrack: number; // 0..5
  BondLevel: number; // 0..5
  BondMoves: BondMoveEntry[];
  PendingChange: BondPendingChange | null;
  History: BondHistoryEntry[];
  UpdatedAt: string;
}

// ---------- Combat (play state) ----------

/** Theater-of-the-mind range bands, not a grid — see README's architecture notes for why: a
 *  rendered map is real future scope, not this slice. Ordered near to far;
 *  `COMBAT_RANGE_ORDER` is the canonical ordering `shiftRange()` walks in `combat.ts`. */
export type CombatRange = 'Melee' | 'Close' | 'Far' | 'VeryFar' | 'OutOfRange';

export const COMBAT_RANGE_ORDER: CombatRange[] = ['Melee', 'Close', 'Far', 'VeryFar', 'OutOfRange'];

export type CombatParticipantKind = 'PC' | 'Enemy';

/** An Enemy's own named Strain track (V0.6 slice 1 / `WorkPlan-V0.6.md` Section B1) — B1's own
 *  mapping for "Enemy Status Limits": "Enemies keep a counting track — they have no severity
 *  slots, and V0.6 never gives them any." Unlike a Hero, an Enemy still marks a sparse box row
 *  per named track (`markRank`/`statusRank` in `engine.ts` — kept specifically to serve this),
 *  just no longer carrying a `Polarity`, since every track an Enemy holds is by construction
 *  something inflicted on it. */
export interface EnemyStrainMark {
  Id: string;
  Name: string;
  Marks: boolean[];
}

/** One combatant in a live Encounter. A PC participant is a thin pointer at a real Character —
 *  its Statuses (and Strain) live on that Character's own `CharacterSheet` (single source of
 *  truth, same as everywhere else in the app), so `Statuses`/`Toughness`/`StatusLimits` here are
 *  Enemy-only. An Enemy participant may be spawned from an `EnemyTemplate` (`RefId` set) or built
 *  ad-hoc (`RefId` empty) — either way it carries its own copy of everything, editable per-fight. */
export interface CombatParticipant {
  Id: string;
  Kind: CombatParticipantKind;
  RefId: string;
  Name: string;
  Range: CombatRange;
  ActionPointsRemaining: number;
  /** Whether this participant has acted this round — set by `endTurn()` (slice 5) as each unit
   *  finishes its own turn, cleared for everyone by `startNewRound()` at a new round boundary.
   *  Drives `nextActor()`'s alternating-sides-with-leftovers suggestion; the GM can always pick a
   *  different participant directly, this is a default, not an enforced order. */
  HasActedThisRound: boolean;
  Toughness?: ToughnessTier;
  StatusLimits?: EnemyStatusLimit[];
  /** Enemy-only (see `EnemyStrainMark`) — a Hero's own Strain/Statuses live on their sheet. */
  Statuses?: EnemyStrainMark[];
  Defeated?: boolean;
  /** Boss-only (slice 5) — see `EnemyTemplate.IsBoss`/`GambitCharges`. Carried onto the
   *  participant at spawn so Combat code doesn't need to look the template back up mid-fight. */
  IsBoss?: boolean;
  GambitCharges?: number;
}

/** A minority of the party may declare their own win condition when they disagree with the
 *  group's Combat Goal — achieving it ends Combat on their terms instead. */
export interface DefiantGoal {
  Id: string;
  ParticipantId: string;
  Text: string;
  Achieved: boolean;
}

export type EncounterStatus = 'Active' | 'Ended';

export interface CombatHistoryEntry {
  Id: string;
  At: string;
  Text: string;
}

/** Incoming Strain an attack would deal a PC, waiting on that PC's own player to resolve it.
 *  Needed because a sheet can only ever be written by its own owner (see sheet.ts's PUT
 *  authorization) — an Enemy's attack can't write directly to a PC's CharacterSheet the way it
 *  writes directly to another CombatParticipant's Statuses, so it's offered here instead and the
 *  target resolves it themselves from their own participant card: Resist (roll, reducing the
 *  Amount) or take a Status instead (absorbing a flat 2/4/6 by severity), with whatever's left
 *  landing on their Strain track — see `statusPenalty`/`statusAbsorb`/`markStrain` in
 *  `engine.ts`. Renamed from `PendingStatusOffer` (V0.6 slice 1 / `WorkPlan-V0.6.md` Section B1):
 *  `StatusName`/`Polarity`/`Rank` are gone since an attack no longer names a Status at all — only
 *  the target's own choice to take one, with their own wording, ever does. Anyone can create one
 *  (writing the Encounter); only the target's own player can fulfill it (writing their own
 *  sheet). */
export interface PendingStrainOffer {
  Id: string;
  TargetParticipantId: string;
  Amount: number;
  Note: string;
  /** False for an offer redirected by Interpose — the doc is explicit that interposing means
   *  taking the Strain in the ally's place with no Resist Roll of your own. True for every
   *  ordinary offer. */
  Resistable: boolean;
}

export interface Encounter {
  Id: string;
  CampaignId: string;
  Status: EncounterStatus;
  CombatGoal: string;
  /** V0.6's Combat Loop step 3, slice 3: "When the Heroes achieve the Combat Goal, Combat ends.
   *  Each player marks Potential." Toggled by the GM — mirrors `DefiantGoal.Achieved`'s boolean-
   *  toggle shape, but Encounter-level, since the Combat Goal itself (unlike a Defiant Goal) isn't
   *  a per-participant list entry. Marking Potential itself stays a self-serve per-player action
   *  (`EncounterView.tsx`) once this is true, same "only the sheet's own owner can write it"
   *  constraint as everywhere else in Combat. */
  CombatGoalAchieved: boolean;
  DefiantGoals: DefiantGoal[];
  Round: number;
  /** Which side is due to pick next in the "zipper" order — still a shared reference the GM
   *  operates rather than something the app enforces (see CLAUDE.md's Combat architecture note).
   *  `nextActor()` reads this to suggest who logically acts next; `endTurn()` flips it, staying on
   *  the same side once it has no more not-yet-acted units this round (the "leftover units act
   *  consecutively" rule). */
  ActingSide: 'Party' | 'Enemies' | null;
  /** Whose turn it currently is (slice 5) — `null` between turns, while the GM is picking who
   *  acts next. Setting this doesn't recharge anything by itself; `endTurn()` does that when the
   *  acting participant(s) are done. */
  ActingParticipantId: string | null;
  /** The second participant acting alongside `ActingParticipantId`, for "two Heroes may choose to
   *  move together on a Hero turn" (and its enemy-side mirror) — always at most one partner, per
   *  the doc's own wording. `null` when nobody is paired this turn. */
  PairedParticipantId: string | null;
  Participants: CombatParticipant[];
  PendingStrainOffers: PendingStrainOffer[];
  History: CombatHistoryEntry[];
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Clocks (V0.5 slice 6, restructured V0.6 slice 6) ----------

/** V0.6 rewrote the Clocks chapter (`WorkPlan-V0.6.md` Section C, Slice 6, `0.47.0`) against the
 *  V0.5-era three-`Kind` collapse this type used to describe. `'Basic'` is renamed `'Opposition'`
 *  (same Success/Failure/Headway-risk mechanic, unchanged) — a pure rename, so a legacy `'Basic'`
 *  value is translated forward on read (`normalizeClock()` in `logic.ts`), not dropped. `'Countdown'`
 *  splits into two real Kinds V0.6 actually distinguishes: `'Threat'` (a GM-authored, player-facing
 *  danger — Goal, Skill Tags, Developments, sized 2-4/4-6/7+ by scope) and `'Project'` (a Hero's
 *  own downtime pursuit — Goal and a segment count, progressed via the existing "report which tier
 *  you hit" 3/2/1 flow Enjoy Downtime's Advance and Camp Actions already use). Unlike the Basic
 *  rename, this is a genuine one-to-two split with no way to reconstruct which a given legacy
 *  `'Countdown'` clock was meant to be — `normalizeClock()` defaults it to `'Threat'`, the closer
 *  semantic match (GM-ticked, already used for Camp Actions' "Bad Guy Clock" flow) rather than
 *  guessing per-clock or silently dropping data. `'TugOfWar'` is unchanged. Linked Clocks
 *  (`UnlocksClockId`, `isClockLocked()`) are deleted outright per V0.6's own restructure — there is
 *  no honest translation for a field that no longer has a concept to attach to, so it's simply not
 *  carried forward by `normalizeClock()` (the same "clean break, no migration path" treatment this
 *  migration already gave the legacy ranked-Status shape in slice 1). */
export type ClockKind = 'Opposition' | 'Threat' | 'Project' | 'TugOfWar';

export interface ClockHistoryEntry {
  Id: string;
  At: string;
  Text: string;
}

/** A planned narrative beat on a Threat Clock (V0.6: "Give it Developments... make a Development
 *  for at least each Clock segment, but don't feel attached to their order. Trigger them based on
 *  what best serves the narrative and pacing"). `Triggered` is a GM-toggled flag, not tied
 *  mechanically to `SuccessMarks` — the doc is explicit a Development fires by GM judgment, not by
 *  reaching its "own" segment. Deliberately plain, player-visible text, not GM-only spoiler content
 *  like an Adventure's Secrets: Threat Clocks are the doc's own example of a *player-facing*
 *  Countdown ("Threats are Countdown Clocks that are player facing, showing them how the world is
 *  moving"), and this app has no per-field visibility mechanism on a Clock to hide one from players
 *  without reopening the same Realtime-payload-leak problem "Architecture: Adventures" documents —
 *  building one here would be new, unscoped architecture, not something this slice's bullet asks
 *  for. Flagged as a real, deliberate scoping call, not a silent assumption. */
export interface ClockDevelopment {
  Id: string;
  Text: string;
  Triggered: boolean;
}

/** A player-facing Clock (`Ruleset-V0.6.md`'s "Clocks" chapter) — a GM-created tracker for an
 *  ongoing effort against an obstacle, independent of Combat (the doc's own examples include
 *  "violent skirmishes that don't require Combat"). Track-and-display, same trust model as
 *  `Encounter`: any campaign member may progress one via the whole-document PUT, and the UI (not
 *  the server) decides which controls a given Kind or role actually shows.
 *
 *  `SuccessMarks` is the Opposition Kind's Success track *and* the single track Threat, Project,
 *  and TugOfWar all use — one field name rather than a differently-named field per Kind, since
 *  exactly one of them is ever meaningful for a given Clock. `FailureMarks` only exists for
 *  `'Opposition'`. `Goal`/`SkillTags`/`Developments` are always present regardless of Kind (the
 *  same "field always present, only sometimes meaningful" treatment `NPC.StatusLimits` already
 *  gets) rather than typed optional-per-Kind — `SkillTags`/`Developments` are Threat-specific in
 *  the doc, `Goal` is shared by Threat and Project, and none of the three apply to Opposition or
 *  TugOfWar, but a plain always-array/always-string shape is simpler than a per-Kind union and
 *  costs nothing when unused. */
export interface Clock {
  Id: string;
  CampaignId: string;
  Title: string;
  Kind: ClockKind;
  /** Segments the Clock is divided into — the doc's own guidance is 4 for a basic obstacle,
   *  rising in even numbers for more complex ones; a Threat instead uses 2-4/4-6/7+ by scope (see
   *  `NewClockForm`'s hint text). Not enforced by the type itself (GM judgment call, same as
   *  everything else about a Clock's shape), only by `newClock()`'s default. */
  Segments: number;
  SuccessMarks: number;
  FailureMarks?: number;
  /** GM-authored context — "How will this Threat change the Hero's world for the worse?" for a
   *  Threat; a Project's own stated aim for a Project. Empty string, not undefined, on a Clock
   *  where it doesn't apply. */
  Goal: string;
  /** Threat-only in the doc's own text ("1-3 words or phrases... could be skills, NPCs, locations
   *  — anything to frame how it is ticking toward its Goal"). Freeform, same `TagList` treatment
   *  every other tag list in this app gets — empty on any other Kind. */
  SkillTags: string[];
  /** Threat-only. Empty on any other Kind. */
  Developments: ClockDevelopment[];
  /** GM-only toggle surfacing a Threat on the campaign's player-facing Quest Board — `WorkPlan-
   *  V0.6.md` Section A4 item 3 ("some GM Threats get promoted to visible party quests"), a
   *  meeting-only decision V0.6's own text never describes a board or promotion step for. Every
   *  Clock still displays in the ordinary Open list regardless of this flag — promotion only adds
   *  a second, curated appearance on the Quest Board, it never hides anything (the same "still
   *  shows, just marked" shape a locked Clock used to get). Meaningful only for `'Threat'` in the
   *  UI, but not type-restricted to it, the same "always present" treatment as `Goal` above. */
  PromotedToBoard: boolean;
  Status: 'Open' | 'Resolved';
  /** Set once `Status` is `'Resolved'`. Auto-set for `'Opposition'` the moment a track fills (see
   *  `clockOutcome()`); for `'Threat'`/`'Project'`/`'TugOfWar'` it's only ever set by the GM's own
   *  manual Resolve action, since the doc gives those Kinds no auto-completion semantics to key
   *  off. */
  ResolvedAs?: 'Success' | 'Failure';
  History: ClockHistoryEntry[];
  CreatedAt: string;
  UpdatedAt: string;
}

// ---------- Derived / view models ----------

export interface CharacterSummary {
  Id: string;
  Name: string;
  PlayerName: string;
  Motifs: { Name: string; Potential: number }[];
  Virtues: VirtueValue[];
  ConditionsMarked: string[];
  Strain: boolean[];
  Statuses: CharacterStatus[];
  Load: { Tier: string; Carried: number; Capacity: number };
  ArmorReady: number;
  ArmorTotal: number;
}

// ---------- Change log (admin panel) ----------

export interface ChangeLogEntry {
  Id: string;
  At: string;
  Who: string;
  Action: 'create' | 'update' | 'delete' | 'import' | 'reset';
  Collection: string;
  ObjectId: string;
  ObjectName: string;
  Before: unknown;
  After: unknown;
}

export interface ValidationIssue {
  collection: string;
  label: string;
  objectId: string;
  objectName: string;
  message: string;
}

export interface ReferencedByRow {
  label: string;
  name: string;
  field: string;
}
