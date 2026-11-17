import type { Response } from 'express';

/** A JSON object, as opposed to an array, a string, a number or null. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Guards a whole-document PUT. Every play-state document (sheet, Party, Encounter, Clock, World,
 *  Adventure) is saved by replacing or merging the request body into one JSONB row, and until the
 *  2026-11-12 audit the body was stored as it arrived: an array or a string was spread or saved
 *  verbatim, and every client then received it through bootstrap and Realtime. Sends the 400 and
 *  returns null when the body is not an object; the caller then runs the result through the
 *  document's own `normalize*()` before saving, which repairs missing or wrong-typed known fields.
 *  Unknown keys are not stripped: that needs a schema per document. */
export function objectBody(body: unknown, res: Response): Record<string, unknown> | null {
  if (!isPlainObject(body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return null;
  }
  return body;
}

/** Takes the optional stale-save precondition off a whole-document PUT body. The client sends the
 *  `UpdatedAt` of the copy its edit started from as `expectedUpdatedAt`, beside the document's own
 *  fields; it is removed here so it is never stored. Absent (a tab opened before 0.84.0, or a
 *  caller that does not care) means "write regardless", exactly as before. */
export function takeExpectedUpdatedAt(body: Record<string, unknown>): string | undefined {
  const value = body.expectedUpdatedAt;
  delete body.expectedUpdatedAt;
  return typeof value === 'string' && value ? value : undefined;
}
