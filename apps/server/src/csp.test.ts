import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildCsp, cspReportHandler, inlineScriptHashes } from './csp.js';

describe('inlineScriptHashes', () => {
  it("hashes inline scripts and skips ones with a src, matching the browser's sha256 of the text", () => {
    const html = '<script>var a=1;</script><script type="module" src="/x.js"></script>';
    const expected = `'sha256-${createHash('sha256').update('var a=1;').digest('base64')}'`;
    expect(inlineScriptHashes(html)).toEqual([expected]);
  });

  it("finds the one inline script in the app's own index.html", () => {
    const html = readFileSync(new URL('../../web/index.html', import.meta.url), 'utf8');
    expect(inlineScriptHashes(html)).toHaveLength(1);
  });
});

describe('buildCsp', () => {
  it('allows Supabase over https and wss, and reports to the app', () => {
    const csp = buildCsp({ supabaseUrl: 'https://abc.supabase.co', scriptHashes: ["'sha256-x'"] });
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("script-src 'self' 'sha256-x'");
    expect(csp).toContain('report-uri /api/csp-report');
  });
});

describe('cspReportHandler', () => {
  it('logs the blocked resource without the query string, and answers 204', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = express();
    app.post('/r', express.json({ type: ['application/csp-report'] }), cspReportHandler);
    const res = await request(app)
      .post('/r')
      .set('Content-Type', 'application/csp-report')
      .send(JSON.stringify({ 'csp-report': { 'document-uri': 'https://x.test/c/1?invite=SECRET', 'blocked-uri': 'https://evil.test/a.js', 'violated-directive': 'script-src' } }));
    expect(res.status).toBe(204);
    expect(warn.mock.calls[0][0]).toContain('https://evil.test/a.js');
    expect(warn.mock.calls[0][0]).not.toContain('SECRET');
    warn.mockRestore();
  });
});
