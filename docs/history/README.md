# History

Kept, not maintained. Nothing here describes current behaviour — for that, read
[`../architecture/`](../architecture/README.md).

It is kept rather than deleted because this project has repeatedly found that the *reason* a thing
was built a certain way is the part that gets lost, and the part that a later session needs in order
not to undo it. Several notes in here are corrections of claims that were confidently wrong for
many releases; those are the most valuable pages in the directory.

| Document | What it is |
|---|---|
| [`releases.md`](releases.md) | The version-by-version narrative of how the app got its shape. This was `CLAUDE.md`'s opening section — the first thing every session read, and almost never what it needed. |
| [`ruleset-migrations.md`](ruleset-migrations.md) | Which ruleset is canonical, how the app migrated from V0.5 to V0.6, and the superseded per-slice narration, including Clocks as V0.5 left them. |
| [`sessions.md`](sessions.md) | `HANDOFF.md`'s chained session-by-session log. |

## A warning this directory exists to preserve

`ruleset-migrations.md` contains a paragraph recording that `CLAUDE.md` "said the exact opposite
until `0.41.0`" — the migration-status text had been inverted for eight releases, and survived a
find-and-replace sweep because that sweep matched one marker syntax while the false claim was
written as ordinary prose. The lesson generalises: **a status flip executed as a search over one
syntax leaves the prose claims standing.** That is why history here is archived verbatim rather
than summarised.
