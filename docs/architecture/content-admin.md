# Content Admin

The designers' panel: generic over all 14 library collections and 11 field types, driven by `packages/shared/src/schema.ts`. Keep new capability schema-derived, not special-cased.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: Content Admin (`0.51.0`)

**The panel is generic over all 14 library collections and 11 field types**, driven by
`packages/shared/src/schema.ts` — a collection's `FieldDef[]` is the only thing a new collection
needs, and it gets list/detail/create/delete/validation/nav for free. That has been true since the
panel was built; what `0.51.0` added is everything around it. **Keep new capability derived from
the schema rather than special-cased per collection** — the list pane's filter picks the first
`enum`/`ref` a collection declares rather than consulting a lookup table, for exactly this reason.

**Three server-side rules a new route or client must not route around:**
- **`POST`/`PUT /:collection` validate against the schema** (`validateCollectionBody`, partial for
  PUT) and `POST` fills in declared `default:` values (`withFieldDefaults`) — both in
  `apps/server/src/adminLogic.ts`. `Number.isFinite` in the `int` branch is load-bearing:
  `typeof NaN === 'number'`, which is how a `NaN` reached the stored library before this existed.
  `AdminDetailForm.tsx` checks `required`-emptiness client-side too, so a rejected save points at
  the field rather than printing one line at the bottom of a long form — that is the same
  `schema.ts` flag read on both sides, not a second copy of the rule; type checking stays on the
  server.
- **`DELETE /:collection/:id` refuses (409) when other records reference the target**, unless
  `?force=true`. `referencedBy()` had powered a "deleting this will break these" warning since the
  panel was built while the server ignored it, so the warning was advice a client could decline to
  render. The client sends `force` only after its own "Delete and break N" confirm. Deliberately
  **not** cascading — the Validation panel surfaces the dangling refs, and silently editing other
  records would be the bigger surprise.
- **`POST /changelog/:entryId/restore` restores under the record's *original* Id.** That is the
  whole reason it is a route rather than the client re-POSTing the stored `Before` payload: a
  `create` would mint a fresh Id and leave every ref that pointed at the deleted record dangling.

**The draft is dirty-tracked against a `pristine` snapshot** (`apps/web/src/store/adminUiStore.ts`),
and every navigation out of one goes through `guardNav()` in `AdminPanelPage.tsx`. Compared by
serialisation, not reference — `setDraftField` rebuilds the object on every keystroke. A pending
`jsonTexts` entry counts as dirty on its own, since raw JSON text is held outside the draft and only
parsed at save time. **If you add another way to leave a draft, route it through `guardNav`** —
Duplicate is currently the only control on the detail pane that does, which is what makes the guard
reachable below 1024px where the three panes become a drill-down.

**`/admin/:view/:id?` is a real address, with the store still leading.** The URL is adopted once,
on the first render after the library loads; from then on one effect mirrors `view`/`draft.Id` back
with `replace`, never `push` — every record you clicked would otherwise become a history entry, and
stepping back through them would bypass the discard confirm above. The id comes from `draft`, not
`selectedId`, so it names the record actually open: it clears itself on delete and on New, and
fills in on its own once a new record is saved. `ADMIN_TOOL_VIEWS` (`AdminNav.tsx`) is derived from
that file's own label map so a URL can tell a real view from a typo without a second hand-maintained
list.

**Read a collection through `rowsOf()`** — `apps/server/src/routes/library.ts` and
`apps/web/src/features/admin/adminHelpers.ts` each have one. `Library` gives every collection a
distinct element type and this code is generic over all of them by design, so the widening happens
once per side rather than as an `as any` at each call site.

**Coverage**: `apps/server/src/routes/library.test.ts` (35 tests) and
`apps/web/src/store/adminUiStore.test.ts` (11). The panel is also in both browser passes now, which
it never was before `0.51.0`: the at-rest pass only ever saw `/admin`'s opening nav, so the list
pane, detail form and tool views were entirely unmeasured — which is how every control in the
detail form came to be under the 44×44 floor (Save 58×29, a text input 316×35 at 360px) with
nothing reporting it. The floor is applied at `.admin-pane` in `layout.css` rather than per
stylesheet, so a new field type can't be added without it.
