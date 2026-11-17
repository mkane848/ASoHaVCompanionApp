import { describeError } from './describeError.js';
import { isStaleDocumentError } from './api.js';

/** A whole-document save that the server checks against the `UpdatedAt` the edit started from
 *  (0.84.0, docs/Audit-2026-11-12.md finding 7). The sheet, Party, Encounter and World are each
 *  one JSONB document replaced whole, so before this two people saving the same one at once
 *  silently lost one change.
 *
 *  What this adds on top of an optimistic update:
 *
 *  - **One save in flight per document.** Two quick taps used to send two saves built on the same
 *    base. With a precondition the second would be refused as stale against the player's *own*
 *    first save, so edits made while a save is out are held and sent together, as one follow-up
 *    save, carrying the `UpdatedAt` the server returned for the first.
 *  - **A refused save is reapplied once.** On the server's `stale_document` 409, the fresh
 *    document is fetched, the refused edits (kept as their mutator functions) are applied to it,
 *    and the save is sent again. A second refusal gives up: the cache shows the server's copy and
 *    the player is told.
 *  - **A save that landed but whose answer was lost is not applied twice.** `request()` retries a
 *    PUT once after a dropped connection; if the first attempt had landed, the retry is refused as
 *    stale against itself. Before reapplying, the fresh document is compared with what was sent,
 *    ignoring the stamps; if they match, the save is treated as done. A save whose answer was lost
 *    *and* that someone else overwrote at once is not distinguished from an ordinary conflict, and
 *    its edits are reapplied; that needs both a dropped connection and a simultaneous writer.
 *
 *  Mutators normally run once, when the edit is made. They run again only on the conflict path,
 *  against the fresh document, so they should be plain field changes, which every caller's is.
 *
 *  Pure TypeScript, no React or TanStack: `useOptimisticCommit` in mutations.ts wires it to the
 *  bootstrap cache. */

export interface Stamped {
  UpdatedAt: string;
}

export interface SaveQueueDeps<T extends Stamped> {
  /** The document as the page currently shows it (the bootstrap cache), or null if not loaded. */
  read: () => T | null;
  /** Shows a document (writes the bootstrap cache). */
  write: (doc: T) => void;
  /** Sends one save. `expectedUpdatedAt` is the server precondition. Resolves to the stored copy. */
  save: (doc: T, expectedUpdatedAt: string | undefined) => Promise<T>;
  /** Fetches the server's current copy, bypassing the cache. */
  fetchFresh: () => Promise<T | null>;
  /** Tells the player a save failed. */
  notify: (message: string) => void;
  /** The fallback message for a failure that names none. */
  errorMessage: string;
}

export const STALE_GIVE_UP_MESSAGE = 'Someone else changed this at the same time. Your last change was not saved.';

type Mutator<T> = (draft: T) => void;

/** Fields a save stamps itself, left out when deciding whether two copies hold the same content. */
const STAMP_KEYS = new Set(['UpdatedAt', 'UpdatedBy']);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      if (STAMP_KEYS.has(k)) continue;
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonical(v);
    }
    return out;
  }
  return value;
}

/** Same content, ignoring the save stamps and key order (the server's normalizers rebuild objects
 *  with a spread, so its keys need not come back in the order they were sent). */
export function sameContent(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function applyAll<T>(mutators: Mutator<T>[], doc: T): T {
  const draft = structuredClone(doc);
  for (const m of mutators) m(draft);
  return draft;
}

export class DocumentSaveQueue<T extends Stamped> {
  /** The server's copy as of the last save or read: what a failed save rolls back to, and whose
   *  `UpdatedAt` the next save carries. */
  private confirmed: T | null = null;
  private queue: Mutator<T>[] = [];
  private running: Promise<void> | null = null;

  constructor(private deps: SaveQueueDeps<T>) {}

  /** Replaces the callbacks; a run already under way uses the new ones from its next step. The
   *  hook calls this on every commit, so the queue always holds the latest render's (a sheet's
   *  character id, say, can arrive after the queue was made). */
  setDeps(deps: SaveQueueDeps<T>) {
    this.deps = deps;
  }

  /** Applies `mutator` to what the page shows at once and schedules the save. Returns the promise
   *  of the save run it joined, which settles once the queue is empty (never rejects). */
  commit(mutator: Mutator<T>): Promise<void> | null {
    const current = this.deps.read();
    if (current == null) return null;
    // Idle: whatever the page shows now is the server's latest (a live refetch may have replaced
    // it since the last save), so it is the base.
    if (!this.running) this.confirmed = structuredClone(current);
    this.deps.write(applyAll([mutator], current));
    this.queue.push(mutator);
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  get busy(): boolean {
    return this.running !== null;
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0);
      // Right now, before anything is awaited, the page shows `confirmed` plus exactly this batch.
      const sent = this.deps.read() ?? applyAll(batch, this.confirmed!);
      try {
        const saved = await this.deps.save(structuredClone(sent), this.confirmed?.UpdatedAt);
        this.accept(saved);
      } catch (err) {
        if (isStaleDocumentError(err)) await this.resolveConflict(batch, sent);
        else this.reject(err);
      }
    }
  }

  /** A save was stored: it is the new base, and the page keeps showing any edits made since,
   *  with the new stamp so the next save carries it. */
  private accept(saved: T) {
    this.confirmed = saved;
    const shown = this.deps.read();
    if (shown) this.deps.write({ ...shown, UpdatedAt: saved.UpdatedAt });
  }

  /** A save failed for a reason other than a conflict: drop its edits, show the base plus any
   *  edits made since, and say so. */
  private reject(err: unknown) {
    if (this.confirmed) this.deps.write(applyAll(this.queue, this.confirmed));
    this.deps.notify(describeError(err, this.deps.errorMessage));
  }

  private async resolveConflict(batch: Mutator<T>[], sent: T) {
    let fresh: T | null;
    try {
      fresh = await this.deps.fetchFresh();
    } catch (err) {
      this.reject(err);
      return;
    }
    if (!fresh) {
      this.reject(new Error(STALE_GIVE_UP_MESSAGE));
      return;
    }
    if (sameContent(fresh, sent)) {
      // Our save had landed; only its answer was lost.
      this.confirmed = fresh;
      this.deps.write(applyAll(this.queue, fresh));
      return;
    }
    const retry = applyAll(batch, fresh);
    this.confirmed = fresh;
    this.deps.write(applyAll(this.queue, retry));
    try {
      const saved = await this.deps.save(structuredClone(retry), fresh.UpdatedAt);
      this.accept(saved);
    } catch (err) {
      if (!isStaleDocumentError(err)) {
        this.reject(err);
        return;
      }
      // Lost twice in a row: show the server's copy (plus any edits made since) and say so.
      const latest = await this.deps.fetchFresh().catch(() => null);
      if (latest) this.confirmed = latest;
      if (this.confirmed) this.deps.write(applyAll(this.queue, this.confirmed));
      this.deps.notify(STALE_GIVE_UP_MESSAGE);
    }
  }
}
