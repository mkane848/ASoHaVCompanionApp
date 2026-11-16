import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { securityHeaders } from './securityHeaders.js';

function app() {
  const a = express();
  a.use(securityHeaders);
  a.get('/x', (_req, res) => res.json({ ok: true }));
  return a;
}

describe('securityHeaders', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('sets the no-sniff, no-framing and referrer headers on every response', async () => {
    const res = await request(app()).get('/x');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('adds HSTS only in production', async () => {
    process.env.NODE_ENV = 'test';
    expect((await request(app()).get('/x')).headers['strict-transport-security']).toBeUndefined();
    process.env.NODE_ENV = 'production';
    expect((await request(app()).get('/x')).headers['strict-transport-security']).toMatch(/max-age=/);
  });
});
