# GM Reference — seed versus Ruleset V0.7 (read-only diff)

Date: 2026-10-22. Scope: owner ruling B for V0.7 slice 11 — compare, report, do **not** edit.
Compared: `packages/shared/src/seedGmReference.ts` (four sections, 158 lines) against the GM chapter of
`Planning Docs/Ruleset-V0.7.md` (L6262-6475). `seedGmReference.test.ts` was read and not changed; it pins 4
sections, 23 Principles and 27 Moves.

Method: each seed section and its V0.7 counterpart were reduced to their words (Markdown escapes, emphasis
markers, bullet markers, indentation and whitespace removed; curly quotes and typos left alone) and compared
line by line with a script, then the differences were read by hand. Anything not listed below is word-for-word
identical, typos included.

## Result in one line

Three of the four seeded sections match V0.7 exactly. Two real differences (one added block of seven Principles,
one changed word), plus content V0.7 has that the seed deliberately or accidentally omits.

## Section by section

| Seed section | V0.7 lines | Seed lines | Result |
|---|---|---|---|
| Running the Game (`gmr-running`) | L6314-6361 | 11-58 | Identical wording. Seed restores the nesting that the export flattens; `*everyone*`, `*them!*` emphasis is dropped. |
| GM Principles (`gmr-principles`) | L6363-6392 | 64-86 | **Differs: V0.7 has 7 more bullets.** See D1. |
| GM Moves (`gmr-moves`) | L6414-6447 | 92-125 | Identical wording (27 bullets, nested "Works well when they miss" line, closing "Remember: to do it, do it" paragraph). |
| Soft & Hard Moves (`gmr-soft-hard`) | L6449-6475 | 131-155 | **Differs by one word.** See D2. |

## Differences

**D1. GM Principles: seven bullets in V0.7 are not in the seed.** The seed ends at "Threats lurk around every
corner, so the slow moments of hearth and home feel truly special." (seed L86, V0.7 L6385, the 23rd bullet).
V0.7 continues, without a heading or break:

- L6386 "Always let setbacks create new narrative opportunities instead of simply punishing the Heroes."
- L6387 "Don't force players back onto your planned storyline."
- L6388 "Follow unexpected decisions when they create interesting opportunities."
- L6389 "Let the world respond logically to those decisions."
- L6390 "Be willing to abandon prepared material."
- L6391 "Support unusual ideas instead of immediately shutting them down."
- L6392 "Don't protect the story from unexpected outcomes."

Then L6393 is an empty bullet (`*`), and L6395-6413 is pasted forum material under it (see D4). These seven read
as a draft block (the "quantum storytelling" material that follows is their source), so whether they are Principles
or WIP is exactly the kind of call `docs/decisions.md` item 66 reserves for the owner ("research dumps ... are WIP,
not rules"). Not guessed. If they are adopted, `seedGmReference.test.ts` ("23 top-level list items") changes to 30
and the live library needs a Reset to seed.

**D2. Soft & Hard Moves, first sentence.** V0.7 L6451: "Outside of Combat, in Narrative play, **GMs have** Soft and
Hard Moves." Seed L131: "... **we have** Soft and Hard Moves." One word; V0.7 is the newer wording.

**D3. V0.7 GM content with no seed counterpart.**

- *The Gameplay Loop*, L6278-6312: Cold Open/Prologue (L6280), 1 The Setup (L6282-6287), 2 The Action
  (L6289-6293), 3 The Mechanics (L6295-6298), 4 The Consequences (L6300-6303), 5 Reframe and Repeat
  (L6305-6308), plus the advice to ask the players when at a loss (L6310). The seed has no Gameplay Loop section
  at all. This is the largest missing piece and reads as finished prose. Two flags inside it: L6293 names "Hero
  Move (replacement for Playbook Move)", which the app deliberately does not build (`docs/not-built.md`, Hero Moves
  cut); L6312 is an author note, "need to make a branch for initializing Combat" (already ruled not a blocker,
  `docs/decisions.md` item 66). L6303 says a failure makes a Hard Move, and L6297 mentions "taking a Status Rank",
  a V0.5-era phrase (V0.7 Statuses are Minor/Major/Severe), so the loop needs a read-through by Ryan before it is
  copied in.
- *Outline of the GM chapter*, L6262-6276: The Role of the GM, What do you do?, What do you NOT do?, Gameplay
  loop, Agendas, Principles, GM Moves, Preparing 1st Session, Actually starting the game, Preparing beyond session
  1, Running beyond the first session, Framing Scenes, Setpieces, GM "Screen" Reference. A table of contents for
  sections that do not all exist yet ("Role of the GM", "What do you NOT do?", "Agendas", "GM Screen Reference" have
  no text). Not content to seed.

**D4. V0.7 material the seed correctly leaves out.** L6395-6413: two Reddit links and a "quantum storytelling"
essay quoting Apocalypse World 2nd Edition (the "prep demands" / "MC job" passages) and Brindlewood Bay. It is third-party forum text pasted as
research, i.e. the kind of dump decision 66 says is not rules. Listed so the omission is visibly intentional. The
quote of Apocalypse World would need its own credit question if it ever were adopted.

**D5. Other GM-facing chapters of V0.7 that the app holds elsewhere (not GM Reference sections today).** The First
Session (L6477-6499), Adventures (L6500-6687), Future Session Preparation (L6688+), Setpieces (L6706), Threat
Levels (L6228) and Encounter Building (L6245). Adventure Prep and the Encounter surfaces carry these as structured
tools rather than prose; whether any prose should also be a GM Reference tab is a product call, not a text diff.

## Not differences (checked)

- The Drama rename is already applied in the seed (V0.7 L6469-6473 and seed L149-153 both say Drama, and "start a
  Session with at least 1", "a roll of 6 or less"). They agree with the Drama chapter (V0.7 L498-504).
- Typos are shared and untouched in both: "Heros'" (L6331), "Hard Dove" (L6469), "Big Bag Evil Guy" (L6360),
  "take the reigns" (L6361), "Make the Villains goals sympathetic" (L6374). A cleanup would be a deliberate
  verbatim-vs-corrected choice for the owner.
- Emphasis: the seed strips `*...*` in Running the Game but keeps `*threatens*` and `*do*` in Soft & Hard Moves
  (seed L133, L137). `seedGmReference.test.ts` only forbids `**`, so this passes; it is a presentation
  inconsistency inside the seed, not a V0.7 difference.

## What to decide (Ryan / owner)

1. Are the seven bullets at V0.7 L6386-6392 Principles? (D1)
2. Should the Gameplay Loop (L6278-6310) become a fifth GM Reference section, after Ryan reads it for the stale
   "Status Rank" and "Hero Move" wording? (D3)
3. Apply D2's one-word change when the seed is next touched.

Any seed edit means `SEED_VERSION` bump and a Content Admin "Reset to seed".
