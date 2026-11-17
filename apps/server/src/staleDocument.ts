export const STALE_DOCUMENT_CODE = 'stale_document';

/** Thrown when a play-state save's precondition doesn't match: the stored document changed after
 *  the caller read it. `status` is read by errorMiddleware, like `LibraryConflictError`.
 *
 *  In a module of its own rather than in repo.ts because every route test mocks repo.ts wholesale,
 *  and a class that only existed there would be undefined in the `instanceof` checks below. */
export class StaleDocumentError extends Error {
  readonly status = 409;
  /** Sent in the response body, so the client can tell this 409 from the others (an archived
   *  campaign, a Dead Hero, the Round guard) and refetch and reapply rather than give up. */
  readonly code = STALE_DOCUMENT_CODE;
  constructor() {
    super('Someone else changed this at the same time. Reload and reapply your change.');
  }
}
