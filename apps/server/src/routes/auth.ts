import { Router } from 'express';
import { createUser, findUserByEmail, verifyPassword, createSession, setSessionCookie, destroySession, clearSessionCookie, readSessionToken, requireAuth } from '../auth.js';
import { db } from '../db.js';
import type { MeResponse } from '@asohav/shared';

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email, and password are required.' });
    return;
  }
  if (findUserByEmail(email)) {
    res.status(409).json({ error: 'An account with that email already exists.' });
    return;
  }
  const user = createUser(String(name).trim(), String(email).trim(), String(password));
  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ user: { Id: user.id, Name: user.name, Email: user.email, IsAdmin: false } });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user = email ? findUserByEmail(String(email)) : null;
  if (!user || !verifyPassword(String(password ?? ''), user.password_hash)) {
    res.status(401).json({ error: 'Incorrect email or password.' });
    return;
  }
  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ user: { Id: user.id, Name: user.name, Email: user.email, IsAdmin: !!user.is_admin } });
});

authRouter.post('/logout', (req, res) => {
  const token = readSessionToken(req);
  if (token) destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user!;
  const memberships = db
    .prepare('SELECT m.*, c.name as campaign_name FROM memberships m JOIN campaigns c ON c.id = m.campaign_id WHERE m.user_id = ?')
    .all(user.id) as any[];
  const body: MeResponse = {
    user: { Id: user.id, Name: user.name, Email: user.email, IsAdmin: !!user.is_admin },
    memberships: memberships.map((m) => ({
      Id: m.id, UserId: m.user_id, CampaignId: m.campaign_id, Role: m.role, CharacterId: m.character_id,
      CampaignName: m.campaign_name,
    })),
  };
  res.json(body);
});
