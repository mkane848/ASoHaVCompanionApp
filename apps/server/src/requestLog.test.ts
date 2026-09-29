import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestLog } from './requestLog.js';
import { errorMiddleware } from './errorMiddleware.js';

// Mounted the way index.ts mounts it: on /api, ahead of express.json and of whatever attaches
// req.user — so the user id in these lines is read at 'finish', which is the point.
function app() {
  const a = express();
  a.use('/api', requestLog);
  a.use(express.json());
  a.use((req, _res, next) => {
    req.user = { id: 'u-ryan', name: 'Ryan', email: 'ryan@asohav.dev', isAdmin: false };
    next();
  });
  a.put('/api/campaigns/:id/party', (_req, res) => { res.status(409).json({ error: 'This campaign is archived.' }); });
  a.get('/api/campaigns/:id/bootstrap', (_req, res) => { res.json({ ok: true }); });
  a.get('/api/boom', () => { throw new Error('Supabase went away.'); });
  a.use(errorMiddleware);
  return a;
}

let warn: MockInstance;
let error: MockInstance;

beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function lines(): string[] {
  return [...warn.mock.calls, ...error.mock.calls].map((c) => String(c[0])).filter((l) => l.startsWith('[api]'));
}

describe('requestLog', () => {
  it('logs one line for a 4xx, with the status, user, and the error message the route sent', async () => {
    const res = await request(app())
      .put('/api/campaigns/cm-1/party?since=123')
      .set('Authorization', 'Bearer secret-token')
      .send({ SkillTags: ['private-body-content'] });

    expect(res.status).toBe(409);
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatch(/^\[api\] PUT \/api\/campaigns\/cm-1\/party -> 409 user=u-ryan \d+ms "This campaign is archived\."$/);
  });

  it('never records the query string, headers or request body', async () => {
    await request(app())
      .put('/api/campaigns/cm-1/party?since=123')
      .set('Authorization', 'Bearer secret-token')
      .send({ SkillTags: ['private-body-content'] });

    const logged = lines().join('\n');
    expect(logged).not.toContain('since=123');
    expect(logged).not.toContain('secret-token');
    expect(logged).not.toContain('private-body-content');
  });

  it('logs nothing for a 2xx', async () => {
    const res = await request(app()).get('/api/campaigns/cm-1/bootstrap');

    expect(res.status).toBe(200);
    expect(lines()).toHaveLength(0);
  });

  it('logs a 5xx at error level, message included', async () => {
    const res = await request(app()).get('/api/boom');

    expect(res.status).toBe(500);
    const apiErrors = error.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[api]'));
    expect(apiErrors).toHaveLength(1);
    expect(apiErrors[0]).toContain('-> 500');
    expect(apiErrors[0]).toContain('"Supabase went away."');
  });

  // Mounted ahead of express.json, so a body that never parses still leaves a line. V8's parse
  // error quotes the body it choked on; errorMiddleware swaps it for a fixed message.
  it('logs a malformed JSON body\'s 400 without quoting the body back', async () => {
    const res = await request(app())
      .put('/api/campaigns/cm-1/party')
      .set('Content-Type', 'application/json')
      .send('{"SkillTags": private-body-content}');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Request body is not valid JSON.');
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('-> 400 user=- ');
    expect(lines()[0]).toContain('"Request body is not valid JSON."');
    expect(lines()[0]).not.toContain('private');
  });
});
