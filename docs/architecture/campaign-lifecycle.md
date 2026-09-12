# Campaign lifecycle

The archive freeze, the Signup -> Party Creation -> Playing phase model, and campaign invites. `Status` and `Phase` are deliberately separate fields.

_Part of `docs/architecture/`. Index: [`docs/architecture/README.md`](README.md). The invariants a session must not violate stay in `CLAUDE.md`; this file is the detail behind them._

---

## Architecture: campaign archive freeze

A GM can archive their own campaign (`Campaign.Status: 'Active' | 'Archived'`, migration
`0008_campaign_status.sql`, toggled via GM-only `PATCH /api/campaigns/:id/status` in
`apps/server/src/routes/campaign.ts`). Archiving isn't just a label — it also freezes further
play-state mutations on that campaign. `assertCampaignActive()`
(`packages/shared/src/logic.ts`, throws `CampaignArchivedError` → the route catches it and
responds `409`) is called from every mutating route that touches an archived campaign's state:
sending an invite (`campaign.ts`), Bond propose/accept/reject (`bond.ts`'s shared
`requireCampaignPlayer` helper, so all three get it for free), sheet edits (`sheet.ts`), party
edits (`party.ts`), character creation (`characters.ts`), redeeming an invite to join
(`invites.ts`), world/clock/adventure edits, and — as of `0.50.0` — invite revoke, phase, ready,
and ending an Encounter (`combat.ts`'s `/end`).

**Those last four were missed**, and every test passed throughout because none exercised them
against an archived campaign. `0.50.0` closed the footgun as well as its four instances:
`CampaignArchivedError` and its three phase-gate siblings now carry `status = 409`, which
index.ts's `errorMiddleware` reads, so a new route can call `assertCampaignActive(campaign)` bare
and get a clean 409 with no try/catch. The older `try { … } catch (err) { if (err instanceof
CampaignArchivedError) … }` form at ~16 existing sites still works identically and is left alone;
prefer the bare call in new code.

**Declining an invite (`POST /api/invites/:id/decline`) is the one deliberate exception.** The line
is not "removals are allowed" — revoking an invite is a removal and *is* frozen. It is that
declining is the *invitee's* action on their own pending-invite list, and an archive decision made
by someone else shouldn't strand a dead invite there. That reasoning now also sits at the call site
in `invites.ts`, because an unexplained missing guard is indistinguishable from the four real
omissions — this project's own `0.50.0` audit flagged it as a bug on exactly that basis.

On the client, `CampaignBonds.tsx` and `AdvancementPanel.tsx` — the two places with Bond
propose/accept/decline/withdraw controls — hide those controls when `campaign.Status ===
'Archived'` rather than leaving them to fail against the server's `409`. Deliberately **not**
extended to every other sheet field (Virtues, Statuses, Load, etc.): those stay visually editable
on an archived campaign and rely on the server-side freeze alone, since a failed save there
already gets the same minimal `console.error`-only handling as any other failed save in this app
— see `CHANGELOG.md` 0.11.0 for the full scoping rationale if extending this further.

## Architecture: campaign setup phases (Signup → Party Creation → Playing)

`Campaign.Phase: 'Signup' | 'PartyCreation' | 'Playing'` (`packages/shared/src/types.ts`,
migration `0009_campaign_phase.sql`, added `0.12.0`) is a **separate field from `Status`**, not an
expanded archive enum — `Status` stays purely the archive/freeze toggle above; a campaign can be
`Archived` at any `Phase`. See `../decisions.md` item 10 before
folding these back into one field. `Phase` is optional on the type: always read it through
`campaignPhase(campaign)` (`packages/shared/src/logic.ts`), which defaults a missing value to
`'PartyCreation'` — matching the migration's backfill default for pre-existing rows, so an
already-running campaign keeps letting a newly-invited player create a character rather than being
retroactively locked out by this feature. New campaigns explicitly start at `'Signup'`
(`POST /api/campaigns`).

GM-only `PATCH /api/campaigns/:id/phase` (`apps/server/src/routes/campaign.ts`) moves between
phases; `CAMPAIGN_PHASE_TRANSITIONS` in `logic.ts` only allows Signup→PartyCreation,
PartyCreation→Playing, and PartyCreation→Signup (the GM reopening signup). Nothing auto-advances
`Phase` to `'Playing'` — `partyReadiness(members)` computes a live "N / M ready" readout (Player
memberships only) purely for the GM to look at; starting play is always the GM's own
`PATCH .../phase` call, `ConfirmModal`-gated on the client if not everyone's ready yet, mirroring
the Archive button's existing pattern. `Membership.Ready` (also optional, defaults to `false`) is
set by the player themselves via `PATCH /api/campaigns/:id/ready` and isn't validated against any
real per-player confirmation yet — see the character-creation note below.

Character creation (`POST /api/campaigns/:id/characters`) is the one route actually gated on
`Phase`: `assertPartyCreationPhase(campaign)` 409s outside `'PartyCreation'`. **Invite-sending is
deliberately not phase-gated** — gating it would retroactively block existing/legacy campaigns
(which default to `Phase: 'PartyCreation'`) from inviting new players at all, a real regression;
closing signup only changes what the client shows (the phase button, the chargen route's redirect
guard), not what the invite API accepts. If you add a new phase-aware mutating route, decide
deliberately whether blocking it on old/legacy campaigns (implicit `'PartyCreation'`) is actually
wanted before gating it — it usually isn't, character creation is the one clear exception.

**Combat joined the phase-gated set in `0.38.0`.** `assertPlayingPhase(campaign)`/
`PlayingRequiredError` (`logic.ts`, same shape as `assertPartyCreationPhase`) 409s
`POST /combat/start` outside `'Playing'`. `PUT /:encounterId` and `POST /:encounterId/end` need no
equivalent gate — `CAMPAIGN_PHASE_TRANSITIONS.Playing` is `[]`, so once `/start` is gated an
Encounter can only ever exist in a Playing campaign, and gating the other two could only strand a
legitimately-running fight. `CampaignPage.tsx` mirrors this: the whole Combat section (heading
included) renders nothing pre-`Playing`, for both GM and Player — no more "No Combat right now."
placeholder before there's any prospect of Combat happening.

**`CampaignSetupChecklist.tsx` (`apps/web/src/features/campaign/`, `0.38.0`) is the shared "where is
the campaign in its setup, and what am I waiting on" panel** the phase model above only ever exposed
piecemeal before this — a phase badge here, a ready toggle there, no single view tying them
together. It renders once on `CampaignPage.tsx`, above the GM/Player split (rendering it inside both
branches would let two copies of the same markup drift), as three lanes — Signup / Party Creation /
Playing, each marked done/current/upcoming — and collapses to a one-line summary once
`phase === 'Playing'` rather than unmounting, so the lanes stay legible as a record of how the
campaign got there. It calls no new game logic: `campaignPhase()`/`partyReadiness()`/
`CAMPAIGN_PHASE_TRANSITIONS` are the same already-tested functions the page used before; the
"Start playing anyway?" `ConfirmModal` stays owned by `CampaignPage`, reached through an
`onStartPlaying` prop. The GM's phase-advance buttons and the ready-tag moved out of the banner
into this panel; the per-player Ready toggle stays on the player's own character card in
`PlayerView` (it reads naturally there), with the checklist showing the same state read from
`boot.members` so the two can't disagree.

**Realtime now actually covers campaign/membership/character state, closing a gap the review round
surfaced.** Migration `0013_realtime_campaign_state.sql` adds `campaigns`/`memberships`/
`characters` to the `supabase_realtime` publication — their SELECT policies were already the
joinless shape Realtime authorization needs (see the Realtime section above), but none of the three
had ever been added to the publication itself, so a subscription to any of them would have received
nothing at all. `useLiveCampaign.ts` gained three subscriptions in the same shape as its existing
ones (`campaigns` filtered on `id`, since the row *is* the campaign; `memberships`/`characters`
filtered on `campaign_id`), and a new `useLiveHome.ts` hook — unfiltered across those three plus
`party`/`bonds`, invalidating `['me']` — makes Home react to a GM closing signup or a new member
joining with no refresh. Unfiltered rather than an id-list filter derived from the current `me`
response, deliberately: the joinless RLS policies already scope delivery per client, and an id list
goes stale the instant the user joins a new campaign — one of the events Home most needs to react
to. `character_sheets` is excluded from `useLiveHome` even though it's published: the only thing
Home reads from it is day-granularity `LastPlayedAt`, and invalidating `['me']` on every sheet
keystroke-driven save would be a lot of refetching for a date that rarely changes. **This migration
needed applying by hand after merge** — see "Deployment" below for why Render never runs one
automatically, and the three prior incidents (`0011`, `0012`, and this one) this exact gap has
already caused.

**Home's tiles gained a phase badge and a "waiting on you" hint (`CampaignTile.tsx`, `0.38.0`)** —
the Home-side half of "what am I waiting on," for a Player membership still in `PartyCreation` with
no `CharacterId` yet, or with one but not yet `Ready`. `PHASE_LABEL` moved out of
`CampaignPage.tsx` into a shared `apps/web/src/lib/phaseLabels.ts` so this tile and the campaign
banner's own badge can't independently drift, the same class of bug `AdvancementPanel`/
`CampaignBonds`'s two separate `TYPE_LABELS` maps already demonstrates. `HomePage.tsx` also split
its one flat tile grid into "Campaigns you run"/"Campaigns you play in" lanes
(`grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`), so a user who only plays or only
runs gets one full-width lane automatically rather than a half-empty grid.

## Architecture: campaign invites — a dual email send path, code/link stays authoritative (`0.37.0`)

Sending a campaign invite (`POST /api/campaigns/:id/invites`) has always written an `invites` row
and shown the GM a code to relay by hand — through `0.36.0`, that was the entire feature: nothing
was emailed, and there was no copy button or shareable link. `0.37.0` adds best-effort email
delivery on top of the same unchanged foundation — **the invite code/link is still what actually
works; email is a convenience, never a requirement.**

**The send path has to branch, because no single provider covers both cases.** Supabase Auth's
`inviteUserByEmail` *creates an auth user*, so it only works for an address with no account yet;
Resend (a third-party HTTPS email API) can mail anyone but can't get a brand-new user through
signup. `apps/server/src/email.ts`'s `sendInviteEmail()` is the only place that talks to either
provider: it looks the address up first (via `listAuthUsers()` — the same auth+profiles join
`admin.ts`'s own user list already relies on, reused rather than a second, separate paginated
`supabaseAdmin.auth.admin.listUsers()` call) to pick a leg — existing account → Resend, no account
yet → `inviteUserByEmail`. **It never throws**: a provider failure returns `{ delivered: false, via,
error }` rather than propagating, since sending an invite must not fail just because email is down.
With `RESEND_API_KEY` unset, the Resend leg no-ops (`via: 'none'`) — local dev and CI need no mail
provider configured. The Resend leg is a plain HTTPS POST via native `fetch`, not SMTP — raw TCP is
blocked in the sandboxes this project is developed in (see "Sandbox network constraints" below), so
an SMTP client could never even be smoke-tested here, and `fetch` is native on Node 22 so this adds
no npm dependency.

**Supabase's own built-in email service is documented as testing-only** (best-effort delivery, a low
hourly rate limit, and in current projects restricted to project-team addresses) — the
`inviteUserByEmail` leg needs **custom SMTP configured in the Supabase dashboard** before it
actually delivers to a real player's inbox. That's a one-time, config-only step in the Supabase
project settings, not code, but the feature is not actually working end-to-end until it's done —
don't assume it "just works" in production without checking.

**The invite code got wider at the same time, since it's now going out in an emailed URL.** The old
code (`'ROAD-' + Math.floor(1000 + Math.random() * 8999)`, ~9,000 possibilities, looked up globally
by `getInviteByCode` with no uniqueness check) was already thin; putting it in a link makes a
collision concretely reachable. `campaign.ts`'s `generateUniqueInviteCode()` mints an 8-character
code over a 32-symbol alphabet (no `0`/`O`/`1`/`I`, to avoid ambiguity when read aloud or typed by
hand) and retries on an existing hit. Old-format codes already in the database keep working —
`getInviteByCode` is an exact, format-agnostic match.

**The GM invite UI gains a copyable link and a Resend button, both per-invite** — `InvitesPanel.tsx`.
Persisted per-invite delivery status was offered to the repo owner and *not* selected (so this
release needed no migration); the send/resend response instead carries a transient `delivery`
result (`{ delivered, via, error? }`, mirrored on the client as `InviteDelivery` in `apps/web/src/
lib/api.ts`) that the panel surfaces as a dismissing `Toast`. Copy link and Resend are peers of
equal weight, so they're wrapped in `.action-grid` per this app's own documented convention, not
`flex-wrap`.

**There's no dedicated invite route — the emailed/copied link just points at `/?invite=<code>`,**
reusing `HomePage`'s existing `JoinByCode` control rather than adding a second entry point:
`JoinByCode.tsx` prefills its code input from `?invite=` via `useSearchParams`, then redeems through
the exact same `POST /invites/redeem-by-code` path (including `assertInviteActionable`'s email
match) any hand-typed code already used. `App.tsx` additionally stashes `?invite=` into
`sessionStorage` the moment it's seen and restores it once the user is signed in and back at `/`
with no `invite` param — a first-time player invited via Supabase's own `inviteUserByEmail` may have
to confirm their email address in between landing here and actually being signed in, and that
confirmation redirect goes to whatever Site URL is configured for the Supabase project, which
doesn't necessarily carry the query string they first arrived with.

**Three new env vars, all server-side only**: `RESEND_API_KEY`, `INVITE_FROM_EMAIL` (a From address
verified in the Resend dashboard), and `APP_BASE_URL` — a deliberately separate variable from the
existing `WEB_ORIGIN` (`index.ts`'s CORS allow-origin, which defaults to `http://localhost:5173` and
is wrong in production) used to build the link an invite email points at. Declared in `render.yaml`
and `apps/server/.env.example`; none of the three are required for local dev or CI — see the
no-`RESEND_API_KEY` no-op above.
