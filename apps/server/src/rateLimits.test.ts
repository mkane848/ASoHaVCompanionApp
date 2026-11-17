import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRateLimits } from './rateLimits.js';

/** The same mounting index.ts uses, with small limits and a stand-in for attachUser that reads the
 *  user from a header. */
function app(settings = { general: 3, campaigns: 1, invites: 2 }) {
  const limits = createRateLimits(settings);
  const a = express();
  a.use((req, _res, next) => {
    const id = req.header('x-test-user');
    if (id) req.user = { id, name: id, email: `${id}@x.test`, isAdmin: false };
    next();
  });
  a.use('/api', limits.general);
  a.post('/api/campaigns', limits.campaigns);
  a.post(['/api/campaigns/:id/invites', '/api/campaigns/:id/invites/:inviteId/resend'], limits.invites);
  a.all(/.*/, (_req, res) => res.json({ ok: true }));
  return a;
}

describe('rate limits', () => {
  it('refuses with 429 and an error body once a user is over the general limit', async () => {
    const a = app();
    for (let i = 0; i < 3; i++) expect((await request(a).get('/api/x').set('x-test-user', 'u1')).status).toBe(200);
    const res = await request(a).get('/api/x').set('x-test-user', 'u1');
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/Too many requests/);
  });

  it('keeps a separate budget per user', async () => {
    const a = app();
    for (let i = 0; i < 3; i++) await request(a).get('/api/x').set('x-test-user', 'u1');
    expect((await request(a).get('/api/x').set('x-test-user', 'u2')).status).toBe(200);
  });

  it('limits campaign creation more tightly than other requests', async () => {
    const a = app();
    expect((await request(a).post('/api/campaigns').set('x-test-user', 'u1')).status).toBe(200);
    expect((await request(a).post('/api/campaigns').set('x-test-user', 'u1')).status).toBe(429);
    expect((await request(a).get('/api/campaigns').set('x-test-user', 'u1')).status).toBe(200);
  });

  it('counts invite sends and resends together', async () => {
    const a = app();
    expect((await request(a).post('/api/campaigns/cm-1/invites').set('x-test-user', 'u1')).status).toBe(200);
    expect((await request(a).post('/api/campaigns/cm-1/invites/inv-1/resend').set('x-test-user', 'u1')).status).toBe(200);
    expect((await request(a).post('/api/campaigns/cm-2/invites').set('x-test-user', 'u1')).status).toBe(429);
  });

  it('never limits the health routes', async () => {
    const a = app({ general: 1, campaigns: 1, invites: 1 });
    for (let i = 0; i < 5; i++) expect((await request(a).get('/api/health')).status).toBe(200);
  });
});
