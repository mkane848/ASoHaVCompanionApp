# Handoff: ASoHaV Character Sheet, Content Admin & Campaign Shell

## Overview

**ASoHaV** is a Powered-by-the-Apocalypse tabletop RPG in early development. This handoff covers the **player-facing digital toolset**: a character sheet companion app, a content admin panel for the two designers authoring the game's rules objects, and a campaign shell handling multi-user membership and shared state.

The three surfaces are:

| Surface | Who uses it | What it does |
|---|---|---|
| **Character Sheet** | Players, at the table | The live sheet — Virtues, Conditions, Statuses, Armor, Theme & Quests, Load, Advancement, and a Moves reference |
| **Content Admin** | The two game designers | CRUD over every rules object, game settings, change history, reference validation, bulk JSON |
| **Campaign Shell** | Everyone | Roster, invites, GM live-peek at every PC sheet, and the Bond confirmation handshake |

The GM side of the system is being designed separately by the other designer. The campaign shell's GM view here is a **placeholder that proves the role model** — eventually the GM's tooling replaces it entirely.

---

## About the Design Files

**The files in `design/` are design references created in HTML. They are prototypes showing intended look and behavior — not production code to copy directly.**

Your task is to **recreate these designs in the target codebase**, using its established patterns and libraries. The stack has already been chosen by the team (see *Target Architecture* below).

Two specific cautions about the prototype files:

1. **They are "Design Components" (`.dc.html`)** — a prototyping format with a template section and a logic class. The templating syntax (`sc-for`, `sc-if`, `{{ hole }}`) is an artifact of that environment. **Do not port the templating approach.** Read them for layout, styling, copy, and behavior; express all of it in idiomatic React.

2. **All styling is inline.** That was a constraint of the prototype format, not a recommendation. Extract the values in *Design Tokens* below into whatever the codebase uses.

The `design/_shared/store.js` and `library.js` files are, however, **worth reading closely** — they encode the reconciled data model and the seeded game content, and both should survive the port largely intact (as types + API contract, and as seed data respectively).

---

## Fidelity

**High-fidelity.** Colors, typography, spacing, copy, and interaction behavior are final and should be recreated faithfully. Every hex value, font size, and letter-spacing in this document is what the prototype actually renders.

Two deliberate exceptions where you should use judgment rather than copy:
- The prototypes persist to `localStorage`. Production is server-backed — see *Target Architecture*.
- The "signed in as" / "editing as" dropdowns are prototype affordances for demoing role switching. Production uses real auth.

---

## Target Architecture

Decided by the team; not up for rediscovery.

- **Vite + React 19 + TypeScript**
- **zustand** for local/UI state
- **TanStack Query** for server state
- **Real-time sync required** for shared resources (Rapport, Bonds) — WebSockets or SSE behind the Query cache. A backend-as-a-service with subscriptions would remove most of this work.
- **Offline support is NOT required.** Logged as a possible future improvement. The app may assume connectivity.

### Authorization rules

- A player may edit **their own sheet**, and either side of a **Bond they are part of**.
- A GM may **read every sheet** in their campaign, and has **no character sheet of their own**.
- Bond writes are the sharp case — two people can write one record. This is handled by a handshake (below), and the rule must be enforced **server-side**, not as a UI convention.

---

## Data Model

Two datasets. The split is deliberate and should be preserved.

### 1. Content Library — authored in the admin panel, read-only to players

Reference source: `design/_shared/library.js` (contains full seeded content), `design/_shared/schema.js` (field definitions).

| Entity | Fields |
|---|---|
| `Virtue` | `Id, Name, Tagline, Essence, UsageHelperText` — exactly 5: Might, Mettle, Heart, Wit, Guile |
| `Condition` | `Id, Name, VirtueId, RollPenalty (default −2), ClearAction` — one per Virtue |
| `ArmorType` | `Id, Name, Key: 'Physical'\|'Heavy'\|'Special', Description` |
| `Item` | `Id, Name, Description, LoadCost: 0\|1\|2, Charges: int, GrantsArmorTypeId?` |
| `Theme` | `Id, Name, Description, StartingQuestId, QuestIds[]` |
| `Quest` | `Id, Name, ThemeId, Description` |
| `Skill` | `Id, Name, Effect` |
| `Advancement` | `Id, Name, Track: 'Potential'\|'Rapport', Tier: 1–4, Repeatable: bool, MaxTimes: int?, Effect` |
| `Ability` | `Id, Name, RulesText (required, authoritative), Acquisition, Tags[], Effects: AbilityEffect[]` |
| `Move` / `AdventureMove` | `Id, Name, Kind, VirtueId?, Description, Results, PlayerVariantResults?` |
| `Result` | `Description, Options[], ChooseCount` |
| `GameSettings` | `AbilitiesAtCreation (=2), PotentialTrackLength, RapportTrackLength, KinTrackLength, StatusMaxRank, ConditionFloor` |

**Move result tiers:** `Tier3` = 10+, `Tier2` = 7–9, `Tier1` = miss. Some moves carry a second `PlayerVariantResults` set used when the target is another PC.

**`AbilityEffect` — the one genuinely designed piece.** Abilities must express the full PbtA range (permanent Virtue boosts, +2 Ongoing, move modifications, hold, purely narrative effects). The model:

> **Prose is authoritative; structure is optional metadata.**

Every Ability has required `RulesText` that is always displayed and always correct. Alongside sits zero or more structured `Effects` a future rules engine can act on. An ability that doesn't fit the structure still works perfectly — write the prose, add no effects.

```ts
type AbilityEffect = {
  Kind: 'VirtueBoost' | 'RollBonus' | 'GrantArmor' | 'GrantMove' | 'ModifyMove'
      | 'GrantStatus' | 'ResourceChange' | 'Hold' | 'Narrative';
  Duration?: 'Permanent' | 'Ongoing' | 'Forward' | 'Instant' | 'WhileConditionHolds';
  TriggerText?: string;
  VirtueId?: string; Value?: number;              // VirtueBoost, RollBonus
  ArmorTypeId?: string; Count?: number;           // GrantArmor, Hold
  MoveId?: string; AddedOptions?: string[];       // GrantMove, ModifyMove
  StatusName?: string; Polarity?: string; Rank?: number;  // GrantStatus
  Resource?: 'Load'|'Potential'|'Kin'|'Rapport'|'Recovery'; // ResourceChange
  Text?: string; SpendText?: string;
  Uses?: number; RechargeOn?: string;
};
```

**What the sheet does with Effects in v1:** applies `VirtueBoost` at `Permanent`, materialises `GrantArmor` boxes with the ability as their source, adds `GrantMove` entries to the Moves drawer. Everything else *displays* as an annotation chip beside the relevant panel without altering any number.

### 2. Play State — per campaign

Reference source: `design/_shared/store.js`.

```
Campaign      { Id, Name, GmUserId, CreatedAt }
User          { Id, Name }
Membership    { Id, UserId, CampaignId, Role: 'GM'|'Player', CharacterId? }
Invite        { Id, CampaignId, Email, Code, SentAt, Status }
Character     { Id, Name, PlayerName, UserId, CampaignId }        // lightweight public identity
CharacterSheet{ Id, CharacterId, Looks, Virtues[], Statuses[], Armor[],
                Theme, Load, Items[], AbilityIds[], SkillIds[], Advancement }
VirtueValue   { VirtueId, Score, ConditionMarked: bool }
CharacterStatus { Id, Name, Rank: 1–6, Polarity, LinkedToIds[], AffectedByIds[] }
CharacterArmor  { Id, ArmorTypeId, Used: bool, SourceId, SourceLabel }
CharacterTheme  { ThemeId, AcceptedQuests: [{QuestId, Completed, AcceptedAt}] }
CharacterLoad   { Tier: 'Light'|'Normal'|'Heavy', LatchedUntilCamp: bool }
CharacterItem   { ItemId, Carried: bool, ChargesUsed: int }
Advancement     { Potential: 0–5, PotentialAdvancementsTaken[], History[] }
```

**Shared, table-owned — stored once, never per sheet:**

```
Party  { Id, CampaignId, Rapport: 0–5, RapportAdvancementsTaken[], History[], UpdatedAt, UpdatedBy }
Bond   { Id, CharacterAId, CharacterBId, KinTrack: 0–5, BondLevel: 0–5,
         BondMoves: [{Level, Text, AuthoredAt}],
         PendingChange: {Id, ProposedBy, Type, Payload, Note, ProposedAt} | null,
         History[], UpdatedAt }
```

### Critical modelling notes

- **There is no `Level` and no `PartyLevel`.** This is not that kind of game. Advancement tiers unlock on **count of advancements taken alone**: Tier 2 at 4 taken, Tier 3 at 7, Tier 4 at 10. `Bond.BondLevel` and `BondMoves[].Level` are a different thing and do exist.
- **A Bond is a property of a pair, not a person.** One record per pair, keyed by both character Ids. Never store a copy on each sheet.
- **Rapport is one pool for the whole party.** It lives on `Party`, not on any character.
- **Sheets reference library definitions, never copy them.** So an admin-panel edit reaches every character on next render.
- **The GM's live-peek is derived, not duplicated.** See `store.summaryFor(state, charId, library)` — it computes the summary from the real sheet. Do not introduce a parallel summary record; an earlier iteration did and the two drifted.

---

## Screens / Views

### A. Character Sheet
`design/character-sheet/CharacterSheet.dc.html`

**Purpose:** what a player looks at and touches during play.

**Layout:** Sticky header bar, then a two-column flex-wrap body inside a `max-width: 1280px` centered container with `padding: 22px 20px 80px` and `gap: 18px`.
- Left column: `flex: 1 1 340px`
- Right column: `flex: 3 1 420px`
- **No media queries.** The flex bases sum to 778px, so the columns pair down to roughly an 800px container and stack below that. This is deliberate — it covers phone, tablet, and laptop without breakpoints. *(An earlier version used bases of 360/520; they summed to 898px and caused a dead-space band around 880–1000px. Don't reintroduce that.)*

**Header** (`position: sticky; top: 0; z-index: 40`): `rgba(239,232,218,.94)` with `backdrop-filter: blur(6px)`, bottom border `1px solid rgba(42,32,26,.16)`. Contains character name (Cormorant Garamond 24px/700), Theme name (11px uppercase, `.14em` tracking, `rgba(42,32,26,.5)`), anchor nav (Virtues · Status · Theme · Kit · Growth, 11px uppercase `.11em`), and a **Moves** button (`#2a201a` bg, `#f4efe2` text, `padding: 8px 14px`).

Anchor nav uses real `<a href="#p-virtues">` links; each target section has `scroll-margin-top: 70px`.

#### Panels

All panels: `background: #faf6ec`, `border: 1px solid rgba(42,32,26,.14)`, `padding: 20px 22px`. Primary panels additionally carry `border-top: 2px solid #9d7c33`. **No border-radius anywhere** except pips — the print/book feel depends on this.

Panel header pattern: `<h2>` in Cormorant Garamond 23px/600, followed by a flex-fill rule: `height: 1px; background: linear-gradient(90deg, rgba(157,124,51,.55), rgba(157,124,51,0))`.

**1. Virtues** (`#p-virtues`)
- Five rows, one per Virtue. Each row: name (Cormorant 20px/600), tagline (10.5px uppercase `.09em`, `rgba(42,32,26,.62)`), a −/+ stepper around the score (Cormorant 26px/700, tabular-nums, min-width 34px), and — when conditioned — the effective modifier in `#8c3a1f`.
- Below each row, a full-width Condition button. Unmarked: transparent, `1px solid rgba(42,32,26,.2)`, text `rgba(42,32,26,.55)`. Marked: `rgba(140,58,31,.14)` bg, `1px solid rgba(140,58,31,.45)`, text `#8c3a1f`, label becomes `"{ConditionName} — marked"`, and the Clear Action appears beneath in italic with a `2px solid rgba(140,58,31,.4)` left border.
- **Effective modifier:** `score + (marked ? RollPenalty : 0)`, floored at **−3**. Displayed only when marked.
- **Dishonored badge** at 5/5 marked: `#8c3a1f` bg, `#faf6ec` text, Cormorant 12px/700, `.14em` tracking, `padding: 3px 9px`, in the panel header.
- Score clamps: min −2, max +3.

**2. Looks** — a textarea, transparent, bottom-rule only.

**3. Abilities & Skills** — name (Cormorant 17px/600), rules text (12.5px), then effect chips (10px uppercase, `1px solid rgba(157,124,51,.45)`, `#7d6127`) generated from the structured `Effects` — e.g. `PHYSICAL ARMOR +1`, `MODIFIES ASSESS THE SITUATION`, `HOLD 1`.

**4. Statuses** (`#p-status`)
- Two groups, **Negative** (label `#8c3a1f`) and **Positive** (label `#9d7c33`), driven by `Polarity`.
- Each status: an inline-editable name input (Cormorant 19px/600, transparent, no border), a **6-pip magnitude stepper**, the rank numeral (Cormorant 20px/700, colored by polarity), and a remove ×.
- **Pips are a magnitude, not a clock.** Tapping pip *n* sets rank to *n*; tapping the currently-filled pip drops to *n−1*; reaching 0 removes the status. Pip: `19×19px`, `border-radius: 50%`, `1.5px` border. Filled negative `#8c3a1f`, filled positive `#9d7c33`, empty `1.5px solid rgba(42,32,26,.28)` on transparent.
- **"Link to…" and "Affected by…" are intentionally inert placeholder buttons** (10px uppercase, `1px dashed rgba(42,32,26,.25)`, `rgba(42,32,26,.38)`). The mechanics are undesigned. Keep them visible and visibly non-functional.
- Add-status row: name input + polarity select + **Add** button.
- **Make Camp** button: reduces every negative Status by 2 ranks and every positive by 1, drops any that hit 0, refreshes all Armor, clears the load latch.

**5. Armor** — one row per box: a `30×30px` toggle (ready = `1.5px solid #9d7c33` on transparent; spent = `rgba(42,32,26,.07)` bg with a `✕`), the type name, `from {source}`, and a Ready/Spent label. **Refresh all** button — Camp refresh is all-or-nothing.

**6. The Theme** (`#p-theme`) — Theme `<select>`, description in italic with a gold left rule, the **Starting Quest** (always shown, never in the accepted list), then **Chosen Quests** with completion checkboxes (`✓`, strike-through + `rgba(42,32,26,.45)` when complete) and a drop ×. Below, available quests render as dashed-border `+ Quest name` buttons.

**7. Load & Item Charges** (`#p-load`)
- Three tier buttons — Light / Normal / Heavy — each showing its computed capacity. Selected: `1px solid #9d7c33`, `rgba(157,124,51,.13)` bg.
- **Capacity = `BaseCapacity + Might`**, where bases are Light 3, Normal 5, Heavy 6. *(The original schema said `× Might`, which yields zero capacity at Might 0. It is addition — confirmed against the rules text.)*
- "On your person" count in Cormorant 22px/700, turning `#8c3a1f` when over capacity, with a soft warning line. **Never blocked.**
- Item rows: carry toggle (`26×26px`, `✓` when carried), name (dimmed to `rgba(42,32,26,.5)` when stowed), description, cost label (`concealed` for 0-Load, else `N load`), and a charge pip row (`15×15px`, filled = spent, `#8c3a1f`).

**8. Advancement** (`#p-growth`) — three **visually distinct bordered areas**, each `1px solid rgba(42,32,26,.16)`, `padding: 16px 18px`:
- **Potential** — "Personal · Tier N unlocked · N taken". Five gold pips. Filling the fifth opens the advancement picker.
- **Rapport** — "Party · shared · N taken". Five gold pips. Filling opens the party picker.
- **Kin & Bonds** — "Social · shared with each partner · N forged". One row per partner: name, five Kin pips, Bond Level. Reaching 5 Kin opens the Forge prompt.

Each area has its own **History** list: a dashed top rule, a 9.5px uppercase "HISTORY" label, then rows of `{label} … {date}` at 11.5px `rgba(42,32,26,.6)`.

**9. Moves drawer** — a right-side overlay, `width: min(560px, 100%)`, `border-left: 2px solid #9d7c33`, scrim `rgba(42,32,26,.42)`. Search field, then each move: name (Cormorant 20px/600), Virtue chip, description, the three tiers labeled *On a 10+* / *On a 7–9* / *On a miss*, choice-list options indented behind a gold hairline, and a highlighted **On a Player** block where a variant exists. Read-only — **no dice rolling in v1**.

#### The damage effect — important and easy to get wrong

Marked Conditions and negative Statuses progressively **dirty their own panels**, so the sheet reads as a book being ruined as the character suffers.

- Implemented as an **absolutely-positioned overlay** (`inset: 0`, `pointer-events: none`, `mix-blend-mode: multiply`) as the **first child** of the panel, with the panel's entire content wrapped in a single sibling `position: relative` container **after** it.
- **This wrapper is load-bearing.** Positioned elements paint above static in-flow siblings; without it every row sits *under* the dirt. Do not solve it with `z-index: -1` on the overlay — the panel creates no stacking context, so the overlay would drop behind the panel's own opaque background and vanish.
- The overlay stacks: an SVG `feTurbulence` fractal-noise layer (grain), five low-frequency radial-gradient blotches in `rgba(96,56,28,…)` / `rgba(88,50,24,…)`, and `box-shadow: inset 0 0 ~50px rgba(84,46,20,.4)`.
- **Quantised into four tiers**, each a literal opacity: `.16 / .31 / .46 / .62`.
  - Virtues panel: one tier per marked Condition.
  - Statuses panel: one tier per **3** accumulated negative Status ranks.
- **Opacity caps at .62.** A badly-off character's sheet must stay readable — that constraint outranks the effect. Text colors on these panels were raised to `rgba(42,32,26,.62)` to survive tier 4.

In React, prefer a single overlay with a computed opacity from a 4-step scale. (The prototype uses four literal variants purely because its format penalises dynamic style values.)

---

### B. Content Admin
`design/admin-panel/AdminPanel.dc.html`

**Purpose:** the two designers authoring game content.

**Layout:** dark header (`#2a201a`, `#f4efe2` text) with an "editing as" selector; then a three-pane flex body — nav sidebar `flex: 0 0 190px` on `#e6ddcb`, list pane `flex: 0 0 300px`, detail pane `flex: 1 1 420px`.

**Nav:** every collection with its record count, then tools — Settings, History, Validation, Import/Export. Active item: `border-left: 3px solid #9d7c33`, `rgba(157,124,51,.16)` bg.

**Forms are generated from `schema.js`, not hand-built.** Adding a new game object type must be a schema entry, not a new screen — the rules are still changing weekly. Field types and their editors:

| Type | Editor |
|---|---|
| `text` / `textarea` | input / textarea on `#faf6ec` with `1px solid rgba(42,32,26,.2)` |
| `int` | number input, 120px |
| `bool` | Yes/No toggle button |
| `enum` | select from `options[]` |
| `ref` | select populated from the target collection |
| `multiref` | toggle chips, gold when on |
| `taglist` | comma-separated text, split on save |
| `json` | monospace textarea; **parse errors surface on save, not silently** |

**Referenced by** panel on every object — lists what depends on it *before* you delete. Deleting a Quest that three Themes point at is the easiest way to corrupt the library, and Validation only reports it afterwards.

**Change history:** every write appends `{Who, At, Action, Collection, ObjectId, ObjectName, Before, After}`; the view shows a field-level diff with old struck through in `#8c3a1f`. *Note: "Who" is self-declared in the prototype; with real accounts it becomes genuine attribution.*

**Validation:** unresolved `ref`/`multiref` targets and empty required fields. Non-blocking by design — the sheet tolerates all of it.

**Settings:** exposes `AbilitiesAtCreation` (currently **2**) and the track lengths, so they're tunable during playtesting without a build.

---

### C. Campaign Shell
`design/campaign/Campaign.dc.html`

**Purpose:** membership, invites, GM oversight, and the Bond handshake.

**GM view** — no character sheet at all. A notice explains why, then **live-peek cards** for every PC: name, player, Theme, all five Virtues (conditioned ones in `#8c3a1f`), marked Conditions, Dishonored badge, status chips by polarity, and a footer of Load / Armor / Potential. Plus the invite panel (email field, generated codes, revoke).

**Player view** — their character card with a link to the sheet, the shared Rapport pool, the Bond list, and the proposal inboxes.

#### The Bond handshake — the core interaction

A Bond is one shared record with two writers. Rather than resolving conflicts, the design **prevents** them:

1. Any Bond change — mark Kin, spend Kin, Forge — is submitted as a **proposal**, not a write.
2. `proposeBondChange` **throws if `PendingChange` is non-null**. One change in flight per Bond, maximum. Enforce this server-side.
3. The other player sees it in **"Awaiting your confirmation"** and may **Accept** or **Decline**.
4. The proposer sees it in **"Waiting on others"** and may **Withdraw**.
5. **Proposals never expire.** They stand until answered or withdrawn.
6. **Every accept, decline, and withdrawal is recorded** to `Bond.History` with who, what type, and the resulting value. History renders under each Bond.
7. A Bond with a change in flight is **visibly locked** — its action buttons are replaced by a status line.

Because there is only ever one write in flight, there is no last-write-wins race.

**Accept resolves by type:** `MarkKin` → +delta, capped at 5. `SpendKin` → −delta; if it drops below 0, Bond Level −1 and Kin resets to 4. `ForgeBond` → Bond Level +1, Kin to 0, and the player-authored move text appended to `BondMoves`.

**Bond Moves are written by the two players together** — they are free text on the Bond record, not library content. There is no BondMove entity to author in the admin panel.

---

## Interactions & Behavior

- **Advancement:** filling a 5-pip track opens a picker filtered to `Track` and unlocked `Tier`. Choosing resets the track to 0, appends to `…AdvancementsTaken`, and logs to `History`. Non-repeatable advancements already taken render greyed at `opacity: .5` with a `taken` badge — still readable, not hidden. Repeatable ones carry a `repeatable` badge and respect `MaxTimes`. The picker has a "Not yet — keep the track full" escape.
- **Forging a Bond:** at 5 Kin, a textarea prompts both players to write the move; saving bumps Bond Level, clears Kin, and logs it.
- **Export / Import JSON** on both the sheet and the admin panel. This format is the API contract and what the GM tooling will read.
- **Transitions:** only `.12s` color/background transitions on interactive elements and a `.18–.2s` `fadeUp` on the drawer and modals. Nothing else animates — it's a document, not an app.

### The enforcement line — hold this

**Shape is enforced; legality is not.**

Enforced: a track has 5 pips, a Status rank can't go below 0, filling a track prompts a choice, one pending Bond change.

Not enforced — warn softly and let the player proceed: exceeding Load, breaking the Virtue point spread, taking an advancement above your tier. The GM and players adjudicate rules; the app is a sheet, not a referee. This is an explicit product decision, not an unfinished feature.

---

## State Management

**Server state (TanStack Query):** the content library; campaign, memberships, invites; every character sheet in the campaign; `Party`; `Bond[]`.

**Real-time subscriptions required on:** `Party.Rapport`, all `Bond` records (including `PendingChange`), and — for the GM's live-peek — every sheet in the campaign.

**Local state (zustand):** open panel/tab, Moves drawer open + search query, picker open + selection, admin draft object being edited (dirty until Save), form field values.

**One rule worth carrying over verbatim:** in the prototype, `store.js` holds **no live state of its own** — `load()` returns the state object, the caller owns it, and every helper is pure (`isGM(state, userId)`, `bondsFor(state, charId)`). An earlier version kept a module-level singleton alongside React state and the two desynced, crashing the campaign shell. Keep one source of truth.

---

## Design Tokens

### Color

| Token | Value | Use |
|---|---|---|
| `ground` | `#efe8da` | Page background (parchment) |
| `panel` | `#faf6ec` | Panel / card surface |
| `sidebar` | `#e6ddcb` | Admin nav sidebar |
| `ink` | `#2a201a` | Primary text; dark button fills |
| `ink-on-dark` | `#f4efe2` | Text on `ink` |
| `ink-62` | `rgba(42,32,26,.62)` | Secondary text (raised from `.45` for damage-tier legibility) |
| `ink-55` | `rgba(42,32,26,.55)` | Tertiary text |
| `ink-45` | `rgba(42,32,26,.45)` | Meta labels on undamaged panels |
| `rule` | `rgba(42,32,26,.14)` | Panel borders |
| `rule-soft` | `rgba(42,32,26,.10)` | Row dividers |
| `rule-field` | `rgba(42,32,26,.20)` | Input borders |
| `gold` | `#9d7c33` | Accent: top rules, filled positive pips, active states |
| `gold-dark` | `#7d6127` | Gold text on light |
| `gold-tint` | `rgba(157,124,51,.14)` | Selected fills |
| `gold-line` | `rgba(157,124,51,.40)` | Chip borders, quote rules |
| `danger` | `#8c3a1f` | Negative statuses, conditions, Dishonored, over-capacity |
| `danger-tint` | `rgba(140,58,31,.07)` | Marked-condition row wash |
| `danger-line` | `rgba(140,58,31,.45)` | Marked-condition borders |
| Damage blotches | `rgba(96,56,28,…)`, `rgba(88,50,24,…)`, `rgba(74,42,20,…)` | Grime overlay |

**Page background** (parchment) is three radial gradients plus a faint fiber grain, `background-attachment: fixed`:
```css
radial-gradient(ellipse at 18% 8%, rgba(216,201,169,.5) 0%, transparent 52%),
radial-gradient(ellipse at 86% 26%, rgba(226,213,185,.45) 0%, transparent 48%),
radial-gradient(ellipse at 46% 88%, rgba(206,190,158,.42) 0%, transparent 58%),
repeating-linear-gradient(92deg, rgba(42,32,26,.016) 0 1px, transparent 1px 4px)
```

Panels carry a subtler grain: `repeating-linear-gradient(0deg, rgba(42,32,26,.012) 0 1px, transparent 1px 3px)`.

### Typography

- **Display / headings:** `'Cormorant Garamond', serif` — weights 400, 600, 700
- **Body:** `'Lora', Georgia, serif` — weights 400, 500, 600
- **Monospace** (ids only): `ui-monospace, Menlo, monospace`

Google Fonts: `Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400`

| Role | Spec |
|---|---|
| Character name (header) | Cormorant 24px/700 |
| Character name (campaign card) | Cormorant 30px/700, `line-height: 1.15` |
| Panel heading | Cormorant 23px/600 |
| Modal heading | Cormorant 26px/600 |
| Row / item title | Cormorant 17–20px/600 |
| Virtue score | Cormorant 26px/700, tabular-nums |
| Status rank | Cormorant 20px/700 |
| Body | Lora 13.5–14px, `line-height: 1.55` |
| Secondary body | Lora 12.5px |
| Meta / label | 10–11px uppercase, `letter-spacing: .09–.14em` |
| Button label | 11px uppercase, `letter-spacing: .10em` |
| History row | 11.5px |

Italic Lora is used consistently for **explanatory and player-authored text** — rules hints, Clear Actions, Bond Moves, proposal notes.

### Spacing, radius, shadow

- Panel padding `20px 22px`; sub-area padding `16px 18px`; row padding `10–13px 0`; column gap `18px`; button padding `7–9px 14–16px`.
- **Border radius: 0 everywhere**, except pips/charges at `50%`. This is the single biggest contributor to the print feel — do not round the panels.
- **No drop shadows.** The only shadow in the system is the inset grime. The header uses `backdrop-filter: blur(6px)` rather than a shadow.
- Pip sizes: status/track `19×19px`, item charge `15×15px`, campaign Kin `16×16px`; border `1.5px`.

---

## Assets

**None.** No images, icons, or icon fonts. Every mark is text, a CSS gradient, or a Unicode glyph (`✓ ✕ × − +`). The only generated graphic is the inline SVG `feTurbulence` noise in the damage overlay.

Fonts load from Google Fonts; self-host if the codebase does.

---

## Files

```
design/
  character-sheet/CharacterSheet.dc.html   Player sheet — all 9 panels + damage effect
  admin-panel/AdminPanel.dc.html           Schema-driven CRUD, history, validation
  campaign/Campaign.dc.html                Roster, invites, GM peek, Bond handshake
  _shared/store.js         ★ Canonical play-state model + pure helpers + handshake logic
  _shared/library.js       ★ Full seeded game content — port as seed data
  _shared/schema.js          Admin field definitions per collection
  _shared/adminstore.js      Library persistence, change log, validation, referencedBy
  */ds-base.js               Prototype-environment loader — NOT needed in production

Character Sheet Plan.html    The full design plan: architecture, 17 resolved schema
                             conflicts, phasing, risks. Read §1–§4 before starting.

rules/                       The designers' source rules documents. The library content
                             was transcribed from these; they are the authority on intent.
```

★ = worth reading closely and porting largely intact.

---

## Known Gaps & Risks

Flag these to the team rather than inventing answers.

1. **Combat is undesigned.** Statuses, Armor, and Load are all combat-adjacent, so a combat system will likely add tracked state to the sheet. Panels are built independently so a Combat panel can drop in — **build it that way and don't over-engineer those three areas.** This is the biggest source of expected churn.
2. **"Link to…" / "Affected by…" mechanics don't exist yet.** Ship the buttons inert.
3. **Statuses that target someone** (*Scared of ___*, *Indebted to ___*) are free text. A future update makes the target a real character reference.
4. **`Skill` has no modifier field**, though *Push Yourself* adds +1 from a Skill. Deferred deliberately.
5. **Dishonored** shows a badge at 5/5 Conditions; its actual consequences are still being designed.
6. **Wealth, Treasure, and Recovery** are referenced by the rules docs but have no entities yet.
7. **Hold, +1 Forward/Ongoing, and project clocks** are not tracked on the sheet. Defensible for v1 — they're transient enough to track out loud — but note the omission is a choice.
8. **The rules documents are drafts** and carry open TODOs. Keep library content as data, never hardcoded, so a rules change is an import rather than a rebuild.
