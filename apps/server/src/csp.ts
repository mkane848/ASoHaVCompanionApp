import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';

/** A Content-Security-Policy for the served app, sent as **Report-Only** (docs/Audit-2026-11-12.md
 *  finding 11). Report-Only means the browser blocks nothing: it only reports what the policy would
 *  have blocked, to `/api/csp-report`, which logs one line per report. A wrong enforcing policy
 *  blanks the app, and its effect cannot be tried against the live site from the sandboxes this
 *  project is built in, so the policy goes out this way first; once Render's log shows no reports
 *  for normal use, the header name changes to `Content-Security-Policy` (docs/operations.md).
 *
 *  What the app loads, and so what the policy allows: its own scripts, styles, fonts and images;
 *  inline styles (React `style` props and the appearance tokens); the one inline script in
 *  index.html (the appearance switch), allowed by its hash, computed from the built file at start-up
 *  so it can never drift from the script; and Supabase over HTTPS (Auth, PostgREST) and WSS
 *  (Realtime). */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    hashes.push(`'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  }
  return hashes;
}

export function buildCsp({ supabaseUrl, scriptHashes }: { supabaseUrl?: string; scriptHashes: string[] }): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).host;
      connect.push(`https://${host}`, `wss://${host}`);
    } catch {
      // An unparsable URL just leaves Supabase out; Report-Only means the reports will say so.
    }
  }
  return [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'report-uri /api/csp-report',
  ].join('; ');
}

/** Logs one line per report. Only the fields that say what was blocked and where; never the whole
 *  body, which can carry a page URL with a query string. Always answers 204. */
export function cspReportHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const reports: Record<string, unknown>[] = Array.isArray(body)
    ? body.map((r) => ((r as { body?: unknown }).body ?? r) as Record<string, unknown>)
    : [((body['csp-report'] ?? body) as Record<string, unknown>)];
  for (const r of reports.slice(0, 10)) {
    const directive = r['effective-directive'] ?? r['violated-directive'] ?? r.effectiveDirective ?? '?';
    const blocked = r['blocked-uri'] ?? r.blockedURL ?? '?';
    const page = String(r['document-uri'] ?? r.documentURL ?? '?').split('?')[0];
    console.warn(`[csp] would block ${String(blocked).slice(0, 200)} under ${String(directive)} on ${page.slice(0, 200)}`);
  }
  res.status(204).end();
}
