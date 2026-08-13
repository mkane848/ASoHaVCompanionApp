# Work plan — `0.24.0`

A planning-only session (2026-08-13) turned eight pieces of repo-owner testing feedback — seven
UI/UX changes and one research question — into an executable plan. **No code was written.** This
document is the handoff: it carries the scoped work, the decisions already locked with the repo
owner, and the things deliberately *not* decided, so a fresh session can start at PR 1 without
re-deriving any of it.

Scoped against `85cb8a8` on `main` (`0.23.0`). Branch: `claude/character-sheet-ui-plan-gznj9c`.

Same convention as [`WorkPlan-0.23.0.md`](WorkPlan-0.23.0.md), which this follows: small, frequent
PRs in dependency order, each individually verified before the next begins.

A rendered version of this plan was published as an Artifact for the repo owner:
<https://claude.ai/code/artifact/fbecb9dc-5074-4136-a79a-765cfc4fe294>. This file is the source of
truth — if the two disagree, believe this one.

## Decisions already locked

Confirmed directly with the repo owner. Don't re-litigate these; they're answers, not defaults.

| Question | Answer |
| --- | --- |
| What does "capped resources" mean? | **Advancement tracks**, not Wealth/Treasure/Hold. Potential and Rapport hitting their cap: the app has no handling for adding to a track that's already full. Record it as a TODO (see I1), don't build it this pass. |
| What is "the future workflow kickoff for advancement options"? | **Both** — the deferred Level/Tier-unlock formula *and* a guided flow when a track fills. Also a TODO (see I2), not built this pass. |
| Virtue row layout | Per the repo owner's markup: **score box trails the row**, Condition sits directly beneath it as an obviously-pressable button, **no checkbox**. This reverses `0.22.0`'s Figma "Option A" pick (boxed score *leading* the row) — see D. |
| Theme and Looks | **Merge into one "Background" section**, Looks first, Theme and its Quests below. |
| Where does game history live? | **In a modal.** Kin & Bonds history specifically; and as a general principle, prefer a modal for "game history" displays rather than putting them on the sheet. |

---

## A — Explicit glossary tagging

*From the research question: "Is there a Markdown standard or some other way that allows me to
explicitly tag when I want something to look up a definition, rather than relying on regex like we
do now?"*

### What we do today

`buildGlossaryMatcher()` (`packages/shared/src/glossary.ts`) compiles every glossary term's `Name`
plus `Aliases` — 14 terms today — into one case-sensitive, word-bounded alternation regex, longest
phrase first. `linkifyText()` splits any authored string on it and hands the matched segments to
`GlossaryText.tsx` as tap-to-reveal links. It runs against **every** authored-prose field in the
app (65 call sites across 11 components).

The three things an author cannot currently say:

1. *"Don't link this occurrence"* — the fifth "Condition" in a paragraph links exactly like the
   first.
2. *"Link this word to that term"* — a display word that isn't the term's `Name` or an `Alias`
   ("shaken" → Status) can only be linked by adding a new global `Alias`, which then fires
   everywhere in the library.
3. *"This is a term even though the casing is wrong here"* — matching is deliberately
   case-sensitive (`glossary.ts:29-32`), which is what stops ordinary English words from linking,
   but it also means an author has no override.

### Is there a standard? Short answer: not in CommonMark itself

Core CommonMark has no term/definition construct at all. There are four families of answer, in
increasing order of machinery:

| Approach | Syntax | Standing | Cost here |
| --- | --- | --- | --- |
| **CommonMark shortcut/full reference links** | `[Condition]`, `[shaken][Status]` | Real, unextended CommonMark. The glossary plays the role of the link-reference table. | Lowest — parseable with a small hand-written splitter, no dependency. |
| **Generic directives** | `:term[Condition]{#g-condition}` | The long-running CommonMark "generic directives/plugins syntax" proposal; de-facto standard via [`remark-directive`](https://github.com/remarkjs/remark-directive) / `micromark-extension-directive`. | Needs a remark/micromark pipeline. |
| **MyST** | `` {term}`Condition` `` plus a `{glossary}` directive | A real documented standard, purpose-built for exactly this (glossary directive, term role, hover reference) — but it belongs to the Sphinx/Jupyter docs toolchain. | Heaviest; wrong shape for a React app. |
| **Wikilinks** | `[[Condition]]`, `[[Condition\|shaken]]` | Not a standard, but a very widespread convention (Obsidian, MediaWiki, Foam), with `remark-wiki-link`. | Low, but invents a syntax CommonMark won't understand. |

Worth knowing but not an authoring syntax: HTML's `<dfn>` is the actual web standard for marking a
definition, and `<abbr>` for abbreviations — but `<dfn>` marks the *defining* instance, not
references to it. It's a candidate render target, not the thing an author types.

### Recommendation: CommonMark reference-link syntax, no Markdown parser

Adopt option 1 and implement it inside `packages/shared/src/glossary.ts`. It gets explicit tagging
with no new runtime dependency, and if this app ever does adopt a real Markdown renderer, the
authored text already parses as valid CommonMark rather than needing a second migration.

**Syntax**

- `[Kin]` — link this occurrence to the term whose `Name` or `Alias` is "Kin" (resolution
  case-insensitive, unlike the auto-linker).
- `[shaken][g-status]` — display "shaken", resolve against the second bracket (term `Id` *or*
  `Name`/`Alias`).
- `\[Kin]` — a literal bracket, no link. Standard CommonMark escaping.

**The rule that makes migration free:** a field containing **at least one** explicit `[...]` tag is
treated as fully explicit — auto-linking is switched off for that whole field. A field with no
brackets behaves exactly as it does today. That gives per-field opt-in with no backfill, no flag
day, and answers problem 1 above without inventing a second "don't link this" marker.

**Implementation sketch**

1. Split `linkifyText()` into two passes: pull explicit spans out first (a small bracket scanner —
   this is not a general Markdown parser and shouldn't grow into one), then run today's regex over
   the remainder *only if* no explicit tag was found.
2. An unresolved tag (`[Frobnicate]` with no such term) renders as its plain display text, never as
   an error or a visible bracket — authored content must not be able to break a render.
3. Surface unresolved tags in Content Admin's existing validation panel instead, so the author
   finds out at authoring time.
4. Add `GameSettings.GlossaryAutoLink: boolean` (default `true`) so auto-linking can be retired
   library-wide once content has migrated. **This is a required-field addition to a JSONB blob with
   live rows** — extend `normalizeLibrary()` (`packages/shared/src/logic.ts`) with a read-time
   default, per the rule CLAUDE.md documents and `0.17.0` learned the hard way.
5. Unit-test the new parser in `packages/shared` alongside the existing glossary tests: explicit
   only, mixed, escaped, unresolved, and the "explicit disables auto" rule.

**Deliberately not recommended: adopting full Markdown rendering.** The 65 render sites all take
plain strings today and `GlossaryText` is a span-level renderer. Introducing a block-level Markdown
parser changes what an author may put in *every* library field (headings, lists, images, tables)
and what Content Admin has to preview — real scope with real design consequences, and not what was
asked. Worth a separate conversation if authored rules text ever wants structure.

> **Watch for:** the `Alias` mechanism stays useful and shouldn't be removed — explicit tags and
> aliases solve different problems (per-occurrence intent vs. a term genuinely having two names).

---

## B — Responsive foundation: page widths, container queries, wider test coverage

*From feedback 3: "There's a lot of wasted space on larger screens… Do a pass of our UI
responsiveness across devices including a 1440p monitor down to an iPhone."*

This lands before the sheet work in C–H, because two of those items are blocked on it.

### B1 — Page widths are inconsistent, and Home is the worst case

Measured from the stylesheets, not estimated:

| Surface | Max width | File |
| --- | --- | --- |
| Home | **720px** | `HomePage.module.css:3` |
| Campaign | 1180px | `CampaignPage.module.css:86` |
| Character sheet | 1280px | `layout.css:234`, `:347` |
| Combat (deep link) | 640px | `CombatPage.module.css:7` |
| Create character | 640px | `CreateCharacterPage.module.css:3` |
| Content Admin | full bleed, 3 panes ≥1024px | `layout.css:400-433` |

Nobody chose that spread; it accreted. The attached screenshot is Home at ~2000px: a 720px ribbon
of content in the middle of the viewport, with a tile grid (`repeat(auto-fill, minmax(300px, 1fr))`)
that would happily run four-up given the room.

**Proposal**

- Add width tokens to `tokens.css` — `--content-max: 1280px`, `--content-max-wide: 1600px`,
  `--content-form: 640px` — and a `.page-shell` utility in `layout.css` that applies
  `max-width`/`margin`/`padding`, so a page picks a stated intent instead of a private number.
- Home and Campaign both move to `--content-max`. Home's tile grid then runs 3–4 up at desktop
  widths instead of 2, which is the actual fix for the screenshot.
- The sheet and Campaign step up to `--content-max-wide` at ≥1800px viewports, so a 1440p monitor
  (2560×1440) gains real content width. **Not unlimited** — `.prose`'s 68ch cap already protects
  reading measure, and letting structured panels run 2000px+ wide strands controls at the far edge,
  which is the exact bug the original `ResponsiveAudit.md` finding 1 was about.
- Create character and the Combat deep link keep `--content-form`: single-column forms, capped on
  purpose.

### B2 — Container queries, so a panel stops guessing at its own width

CLAUDE.md already documents this footgun at length, in its own words: *"a panel inside `.sheet-col`
cannot assume viewport width is its own width once 768px is crossed."* `StatusesPanel.module.css`
carries a long comment deriving a 1024px breakpoint from `.sheet-grid`'s column ratio by hand, and
that arithmetic has been re-derived (and got wrong once) every time the sheet layout moved.

Feedback items 2 and 5 collide head-on without a fix: Abilities & Skills becomes a half-width
column at 768px (~350px of content), *and* is supposed to render two items per row at "medium
screens and higher." Two 170px columns is not a layout.

**Adopt CSS container queries for panel-internal layout.** `container-type: inline-size` on
`.sheet-col` / the panel wrapper, then `@container (min-width: …)` for anything sizing off the
panel's own width. Baseline-supported in every current browser (Chrome 105, Safari 16, Firefox
110). This retires the hand-derived-breakpoint bug class rather than adding one more instance of it.

Viewport media queries stay for genuinely page-level decisions (how many columns the *sheet* has,
the app bar, Content Admin's panes). The split is: **page structure = media query, panel internals
= container query.**

> **Scope control:** convert only what this pass touches — the new Abilities & Skills two-up list
> (F), the Advancement track pairing (H1), and the Load split (G). Do **not** rewrite
> `StatusesPanel.module.css`'s existing 1024px math in the same PR; it works, it's documented, and
> mixing a working-but-hairy conversion into a feature PR is how the `0.22.0` overlap regression
> happened. Flag it as a follow-up.

### B3 — The smoke test stops at 1440px

`apps/web/scripts/responsive-smoke.mjs` runs five viewports, the widest being 1440×900. A 1440p
monitor is 2560×1440 — literally untested. Add two:

```js
{ name: '1920 desktop', width: 1920, height: 1080, touch: false },
{ name: '2560 desktop (1440p)', width: 2560, height: 1440, touch: false },
```

Phone coverage (360, 390) already brackets current iPhones; 390 matches the 393pt iPhone 15/16 Pro
closely enough that a third phone viewport isn't worth the runtime.

> **Runtime cost, plan for it:** 15 routes × 5 viewports takes 8–10 minutes in this sandbox (see
> `HANDOFF.md`, twenty-fifth session). Seven viewports puts it at roughly 12–14. Don't switch git
> branches mid-run — the vite server it spins up serves whatever is checked out.

### B4 — A screenshot script, because it actually works in this sandbox

The smoke test asserts overflow, touch targets, hit-area overlap and page errors. **None of those
catch "wasted space"** — a 720px ribbon on a 2560px monitor passes every check.

Add `apps/web/scripts/screenshot.mjs`, reusing the same harness + viewport machinery, writing a PNG
per route per viewport to a gitignored directory. This is worth calling out specifically: it needs
**no network** (local vite server, local Chromium at `/opt/pw-browsers/chromium`, seed fixtures),
so unlike live QA it *does* work from a locked-down sandbox — the first visual-verification path
any session on this project has had.

> **One caveat:** `apps/web/harness.html` pulls Cormorant Garamond and Lora from Google Fonts, which
> the sandbox proxy blocks. Screenshots render in fallback serif. Layout and spacing are
> representative; typography is not. Say so when sharing them rather than letting someone read a
> font substitution as a regression.

---

## C — Sheet section layout: half-width or full-width, nothing in between

*From feedback 2: "the sections in the character sheet should either take up half of the row width
or the full width depending on the display size. In the same vein, let's put 'Abilities & Skills'
and 'Load & Item Charges' on the same row (evenly spaced) if the screen permits it, but let them be
their own row on smaller screens."*

`0.23.0` left `.sheet-stack` as: `.sheet-grid` (Virtues | Statuses) → `.sheet-pair` (Theme | Looks)
→ three full-width bands → footer. Merging Theme and Looks into Background (E) frees `.sheet-pair`
for exactly the pairing this asks for.

**Target order inside `.sheet-stack`** (`apps/web/src/pages/CharacterSheetPage.tsx:131-177`):

1. `.sheet-grid` — Virtues | Statuses *(unchanged)*
2. Background — full width *(new, see E)*
3. `.sheet-pair` — Abilities & Skills | Load & Item Charges *(new pairing)*
4. Advancement — full width, with Potential | Rapport paired internally *(see H)*
5. Footer row *(unchanged)*

Update `PANEL_IDS` and its "in render order" comment at `CharacterSheetPage.tsx:228`; the sheet
nav's five anchors (`:113-119`) need re-pointing too — `#p-theme` labelled "Theme" becomes the
Background section.

**`.sheet-grid` keeps its lopsided ratio.** Same reasoning `WorkPlan-0.23.0.md` gave and it still
holds: `minmax(280px,1fr) minmax(0,1.5fr)` at 768px / `minmax(320px,1fr) minmax(0,1.7fr)` at 1024px
is what `StatusesPanel.module.css`'s breakpoint math was derived against. Leave it alone and none
of that needs re-deriving.

> **Watch for — this is the highest-risk item in the plan.** Load & Item Charges goes from
> full-width (~1240px at desktop) to a half-column (~350px at 768px). Its `.itemHead` row
> (`LoadPanel.module.css:106`) is a wrapping flex row carrying a 26px checkbox, the item name, a
> cost label, **and** a `Pips` row of up to `Charges` dots. On a coarse pointer each pip slot
> widens to a full 44px (`layout.css:164-170`), so a 3-charge item claims 132px of pips alone.
> That's the precise shape of the bug CLAUDE.md documents for `StatusesPanel`'s `.rowHead` — a
> multi-pip row sharing a line with flexible content, wrapping into overlapping 44px hit overlays.
> Derive the layout from the actual column width (or use a container query per B2), and run the
> smoke test. Do not carry a spacing number across from the full-width layout; this repo has been
> bitten by exactly that twice.

---

## D — Virtue component layout

*From feedback 4, with a markup image: "Instead of a checkbox next to the name of the Condition,
let's make it clear that the condition is a button itself to press in order to mark it."*

The markup shows, per Virtue row: name + its InfoTooltip at the leading edge with the tagline
("PHYSICALITY & FORCE") beneath it, and at the **trailing** edge a bordered score box (`+2`) with
the Condition (`EXHAUSTED`) as a second bordered box directly below it.

**Changes to `VirtuesPanel.tsx` / `VirtuesPanel.module.css`:**

1. `.scoreBox` moves from leading to trailing. `.head`'s flex order flips: `.naming` first, then a
   new trailing column holding `.scoreBox` above `.condition`.
2. `.conditionRow` dissolves. `.tagline` moves back under `.name` (where it lived before `0.22.0`);
   the Condition button and its InfoTooltip move into the trailing column.
3. `.checkbox` / `.checkboxMarked` are **deleted** — the ✓ box and its markup (`VirtuesPanel.tsx:70-72`)
   both go. The button carries its own pressed state through `.conditionMarked`'s tint and border,
   which it already does; `aria-pressed` stays.
4. Give the button a real pressed *and* unpressed affordance so "press me" reads without the
   checkbox. It's currently `1px solid var(--rule-field)` at `--ink-55` — near-invisible as a
   control. Use the token set already in use for interactive-but-not-primary chips rather than
   inventing colors (run `theme-tokens` on the diff).

> **This reverses a decision, deliberately.** `0.22.0` shipped "Option A — a boxed score leading the
> row," picked by the repo owner in a Figma workshop, and `VirtuesPanel.module.css:60-88` carries
> three comment blocks explaining why the score leads and why `.naming` is `flex: 1`. Those comments
> become wrong. Rewrite them to describe the new arrangement and note that the markup superseded
> the workshop pick — don't leave a stale rationale behind, and don't silently drop it either.

> **Redo the `.tap` overlay arithmetic from scratch.** `.conditionRow`'s `margin-top: 24px`
> (`VirtuesPanel.module.css:159-165`) exists solely to keep the Virtue name's InfoTooltip overlay
> clear of the Condition button's overlay in the *current* stacking. In the new layout those two
> are no longer vertically adjacent, but the score box and Condition button become adjacent, and
> the tooltip trigger moves. The 44px overlay only overhangs the axis where the element is under
> 44px (`layout.css:92-100`) — work it through for the new arrangement and record the arithmetic in
> the CSS, then confirm with the smoke test. A carried-over number with a comment claiming a check
> that never ran is how `0.22.0` shipped a real CI failure.

---

## E — "Background": Looks, then Theme

*From feedback 5: "let's consolidate Theme and Looks under a section called 'Background'. Let
'Looks' be the first item in it, then have the Theme and its quest info under it."*

One `Panel` titled **Background**, full width in `.sheet-stack` slot 2 (see C), containing:

1. Looks — the editable chip list, first.
2. Theme — name, hint, description.
3. Quests — Starting Quest, Chosen Quests, the available-quest chips.

**Shape it the way `StatusesPanel`/`ArmorSection` already did this** (`0.22.0`): keep
`ThemePanel.tsx` and `LooksPanel.tsx` as components, demote them from `Panel` + `PanelHeader` to
plain sections with a small `.groupLabel`-style heading, and have a new `BackgroundPanel.tsx` own
the single `Panel`. That's an established in-repo pattern, not a new one, and it keeps both
components' internals untouched.

Bookkeeping this touches:

- `PANEL_IDS` (`CharacterSheetPage.tsx:228`) currently has separate `theme` and `looks` collapse
  keys. One `background` key replaces both. Old persisted keys are harmless leftovers in the
  zustand store — no migration needed, but say so in the changelog rather than letting someone
  wonder.
- The sheet nav's `#p-theme` anchor becomes `#p-background`, label "Background".
- `.sheet-pair` no longer holds Theme | Looks. Update its `layout.css:282-302` comment, which
  describes that pairing by name, to the new one from C.
- `.prose` call sites inside ThemePanel stay valid — Background is full width, so the 68ch cap goes
  from inert back to load-bearing.

---

## F — Abilities & Skills, two items per row

*From feedback 5: "For 'Abilities & Skills', let's have the abilities and skills list have two
items per row on medium screens and higher."*

`AbilitiesSkillsPanel.tsx` renders a flat sequence of `.row` divs (name, prose, effect chips). Make
the list a two-column grid.

**Use a container query, not a media query** (B2). The panel is a half-width column at 768px, so a
viewport-based "medium and higher" would produce two ~170px columns. Gate the two-up on the
*panel's* inline size — roughly 560px of content, which the half-column reaches at ~1024px viewport
and the full-width case reaches immediately. Derive the threshold from the rendered width, don't
guess it.

Two details: `.row`'s `border-bottom` reads as a list separator and will look wrong as a grid cell
divider — switch to a gap plus a rule that suits a grid; and abilities and skills currently render
as two consecutive `.map()`s, so the grid must flow both into one container for the columns to
pack evenly rather than restarting.

---

## G — Load & Item Charges: tiers left, items right

*From feedback 6: "let's make the Light/Normal/Heavy a left column that takes up one third of the
flex box while the remaining two thirds is the existing Items and Loadout stuff."*

Split `LoadPanel.tsx`'s body into a 1fr / 2fr two-column layout:

- **Left (1/3):** the three tier buttons (`.tiers`, currently a horizontal wrapping row at
  `LoadPanel.module.css:2-8`) stack vertically, plus the tier note, the "On your person" carried
  readout, and the over-capacity warning — everything that describes *capacity*.
- **Right (2/3):** the collapse-all toolbar and the item list — everything that describes *what
  you're carrying*.

Stacks to one column below the panel's own threshold, same container-query treatment as F.

> **Interacts directly with C's risk.** Load is simultaneously moving into a half-width column, so
> its "2/3" is 2/3 of ~350px ≈ 230px at a 768px viewport — narrower than the pips-plus-name row can
> take. Either the internal split turns on only above a panel width that makes both thirds viable,
> or the item rows need the `.rowHead`-style named-grid-area treatment `StatusesPanel` uses. Decide
> this from measured widths. Vertical tier buttons help here — they no longer need 3 × 96px on one
> line — but they don't solve the item rows.

---

## H — Advancement

*From feedback 7: "let's make Potential and Rapport share a row on medium screens and higher. Under
'Kin & Bonds', make the history hidden by default and display it in a modal popup, not on the sheet
itself. Let's try to use modals when we can for 'game history' type information displays."*

### H1 — Potential and Rapport share a row

The two `.subBox`es (`AdvancementPanel.tsx:73` and `:104`) go side by side, stacking on narrow
widths. Container query on the panel, per B2.

> **Watch the pip arithmetic.** `.trackHead` is `.trackNaming` (`min-width: 150px`) + a 5-pip
> `Pips` row. At the default 19px size on a coarse pointer, each slot widens to 44px
> (`layout.css:164-170`), so five pips claim 220px; with the 12px gap that's 382px of demand
> against ~350px available at a 768px viewport. It will wrap — `.trackHead` is `flex-wrap: wrap` —
> and a wrapped pip row is precisely where `StatusesPanel` produced overlapping 44px overlays. Set
> the pairing threshold from the width where it genuinely fits, and confirm with the smoke test
> rather than the arithmetic alone.

### H2 — History into a modal

`HistoryList` (`AdvancementPanel.tsx:238-251`) renders inline in three places: Potential history,
party Rapport history, and per-Bond history.

Build one shared `HistoryModal` in `apps/web/src/components/`, on `modal.module.css` and
`useModalA11y.ts` like every other dialog in the app (`0.19.0` — attach the returned callback ref
to the `modal.dialog` element with `role="dialog"`, `aria-modal`, `aria-labelledby`, `tabIndex={-1}`;
extend the hook, never fork it). Replace each inline `HistoryList` with a "History" trigger that
opens it.

**Apply to all three**, not just Bonds — the feedback names Kin & Bonds specifically but states the
general principle, and one shared component costs nothing extra across three call sites. Per-Bond
history also drops its current `.slice(0, 8)` truncation (`AdvancementPanel.tsx:211`), which only
existed because it was competing for room on the sheet.

**Deliberately excluded: Combat's `Encounter.History` log.** It shipped in `0.23.0` as a
collapsible in-page log, and it's live reference a table reads *during* a fight rather than a
retrospective record — a modal would cover the board mid-turn. Flagged as an open item (see below)
rather than silently decided either way.

---

## I — TODOs to record, not build

*From feedback 8: "Mark a TODO item for capped resources and the future workflow kickoff for
advancement options."*

Both go into `HANDOFF.md`'s "Open issues" list as new numbered entries (next free numbers are **14**
and **15**), which is this repo's maintained home for exactly this.

### I1 — A full Advancement track silently swallows every further mark

Confirmed against the code, not assumed. Every path that marks Potential, Rapport, or Kin clamps
with `Math.min()` and drops the excess with no record, no carry-over, and nothing shown to the
player:

| Site | Code |
| --- | --- |
| `EndSessionModal.tsx:59` | `Math.min(RapportTrackLength, d.Rapport + n)` |
| `EndSessionModal.tsx:94` | `Math.min(PotentialTrackLength, d.Advancement.Potential + 1)` |
| `apps/server/src/routes/combat.ts:52` | `Math.min(5, party.Rapport + 1)` |
| `packages/shared/src/logic.ts:179` | `Math.min(5, bond.KinTrack + Delta)` on an accepted Mark Kin |

The UI can't even express the situation: `Pips` treats a tap on the currently-filled pip as *drop
to n−1* (`Pips.tsx:39`), so there is no gesture for "I earned another Potential while my track was
already full." And `AdvancementPicker`'s "Not yet — keep the track full" dismissal
(`AdvancementPicker.tsx:248`) leaves the track at max deliberately, which makes every subsequent
mark a silent loss until the player takes the Advancement.

The rule question to settle with the repo owner: does a mark on a full track **carry over** after
the Advancement is taken, **queue** a second Advancement, or is it **lost by rule**? Note this is a
close cousin of the Bond Kin-lock rule (`isBondLocked()`, `0.17.0`), which *does* have defined
behavior — so there's precedent for the rules doc having an answer here.

Two smaller findings to fold into the same entry: three of those four sites hardcode `5` instead of
reading `GameSettings.RapportTrackLength` / `KinTrackLength`, and `AdvancementPanel.tsx:82`/`:113`
hardcode `count={5}` rather than the configured track length — so raising a track length in Content
Admin today would half-work.

### I2 — The advancement-options workflow kickoff

Two halves, both confirmed in scope for this TODO:

1. **The deferred Level / Tier-unlock formula** — `HANDOFF.md` open issue 12, unchanged since
   `0.18.0`: "4 Tier-1 advancements *and* Level 5" can't both hold if Level is the count of picks
   taken; no `Level`/`PartyLevel` field exists; `unlockedTier()` still gates purely on count. It
   compounds with `Advancements.md`'s separate 2-tier-vs-4-tier contradiction.
2. **A guided flow when a track fills** — today `AdvancementPicker` appears the instant a track hits
   5, from a pip tap (`AdvancementPanel.tsx:87`, `:118`) or from `EndSessionModal`. A modal
   materializing under the player's finger mid-tap is the wrong kickoff for what is a significant
   character moment. Wants a real announce → consider → choose → confirm flow.

Cross-reference both from `README.md#whats-not-built` so they don't only live in `HANDOFF.md`.

---

## Order of work

Small, frequent PRs per repo convention. This order is a dependency chain, not a preference: B2's
container-query decision and B1's width tokens are what C–H build on, and the two TODOs are
doc-only so they can land first and cheaply.

| # | Change | From | Verify |
| --- | --- | --- | --- |
| 1 | `HANDOFF.md` open issues 14/15, README cross-refs | I1, I2 | docs only |
| 2 | Width tokens + `.page-shell`; Home/Campaign widened; wide step at ≥1800px | B1 | responsive smoke |
| 3 | Smoke test gains 1920 + 2560 viewports; new `screenshot.mjs` | B3, B4 | the tests themselves |
| 4 | Explicit glossary tags in `packages/shared`, `GlossaryAutoLink` setting, admin validation | A | unit tests, typecheck |
| 5 | Virtues row redesign | D | responsive smoke, overlay math |
| 6 | Background section (Looks + Theme), nav/anchor/PANEL_IDS updates | E | responsive smoke |
| 7 | `.sheet-pair` → Abilities & Skills \| Load; container-query foundation | C, B2 | responsive smoke |
| 8 | Abilities & Skills two-up; Load 1/3–2/3 split | F, G | responsive smoke |
| 9 | Advancement track pairing; shared `HistoryModal` on three call sites | H1, H2 | responsive smoke |

PRs 5–9 all touch sheet layout and all carry hit-area-overlap risk. Run the responsive smoke test
on each one before merging the next — don't batch them and debug the pile.

---

## Verification and paperwork

Every code-touching PR runs `npm run typecheck` and the full unit suite. Anything touching layout or
DOM structure also runs:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:responsive -w @asohav/web
```

**Docs and versioning.** `0.23.0` → `0.24.0` (MINOR: new UI behavior and one additive
`GameSettings` field, no breaking wire change), synchronized across all four `package.json` files,
plus a `CHANGELOG.md` entry and a `HANDOFF.md` session note. `CLAUDE.md` sections that go stale and
need updating in the same pass:

- **Frontend conventions → sheet layout** — `.sheet-pair` now holds a different pairing, Theme and
  Looks are one Background section, and the `.sheet-grid`-first order described there changes.
- **Frontend conventions → the breakpoint-math notes** — if container queries land, the "a panel
  inside `.sheet-col` cannot assume viewport width is its own width" guidance gains a real remedy
  and should say so.
- **Frontend conventions → shared components** — `GlossaryText` gains explicit tagging;
  `HistoryModal` is a new shared component worth listing next to `ConfirmModal`/`InfoTooltip`.
- **Commands → responsive smoke test** — the viewport list and the new screenshot script.

`README.md#architecture-notes--judgment-calls` needs two entries (next free number is **23**): the
glossary explicit-tag syntax choice and its "explicit disables auto per field" rule, and the
container-query adoption. If the `theme-tokens` or `responsive-device-qa` skills' contents are
invalidated by any of this, update them too — CLAUDE.md's working conventions require it.

---

## Open items

Deliberately unresolved. Don't guess at these.

1. **Does Combat's `Encounter.History` become a modal too?** H2's principle says "prefer modals for
   game history"; the counter-argument is that it's live mid-fight reference, not a retrospective
   record, and it shipped as a collapsible log only one version ago. Left as-is by this plan; one
   line from the repo owner settles it, and the shared `HistoryModal` makes it cheap either way.
2. **What happens when a full Advancement track is marked again** (I1). A rules question, not an
   implementation detail.
3. **Whether `StatusesPanel`'s existing hand-derived 1024px breakpoints get converted to container
   queries.** Recommended eventually — it's the original instance of the bug class B2 fixes — but
   deliberately out of scope here, since converting working, heavily-commented layout code inside a
   feature PR is how a regression sneaks in.
4. **Live QA still isn't possible from a sandbox like this one.** Neither the Render URL nor the
   Supabase host is reachable. B4's screenshot script narrows the gap for layout specifically —
   real rendered pixels at every viewport, no network needed — but it can't click through a flow.
   The Render and Supabase MCP tools work regardless, since they run outside the sandbox.
5. **`main` still has no required status checks** (`HANDOFF.md` open issue 7). Nine PRs against an
   unprotected branch, most of them layout changes whose only real gate is the responsive job.
   Worth fixing before this batch rather than after — needs an account admin, not a session here.
