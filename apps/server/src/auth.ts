import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import * as cookie from 'cookie';
import { db } from './db.js';
import { newId, nowIso } from '@asohav/shared';

const SESSION_COOKIE = 'asohav_sid';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, nowIso(), expiresAt);
  return { token, expiresAt };
}

export function destroySession(token: string) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function userForToken(token: string): DbUser | null {
  const row = db.prepare('SELECT s.user_id, s.expires_at FROM sessions s WHERE s.token = ?').get(token) as
    | { user_id: string; expires_at: string }
    | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) as DbUser | undefined;
  return user ?? null;
}

export function setSessionCookie(res: Response, token: string, expiresAt: string) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(expiresAt),
    }),
  );
}

export function clearSessionCookie(res: Response) {
  res.setHeader('Set-Cookie', cookie.serialize(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 }));
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[SESSION_COOKIE] ?? null;
}

export function tokenFromCookieHeader(header: string | undefined): string | null {
  if (!header) return null;
  const parsed = cookie.parse(header);
  return parsed[SESSION_COOKIE] ?? null;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: DbUser;
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = readSessionToken(req);
  if (token) {
    const user = userForToken(token);
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.is_admin) {
    res.status(403).json({ error: 'Content admin access required.' });
    return;
  }
  next();
}

export function createUser(name: string, email: string, password: string, isAdmin = false): DbUser {
  const id = newId('u');
  const passwordHash = hashPassword(password);
  db.prepare('INSERT INTO users (id, name, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id,
    name,
    email.toLowerCase(),
    passwordHash,
    isAdmin ? 1 : 0,
    nowIso(),
  );
  return { id, name, email: email.toLowerCase(), password_hash: passwordHash, is_admin: isAdmin ? 1 : 0, created_at: nowIso() };
}

export function findUserByEmail(email: string): DbUser | null {
  return (db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as DbUser | undefined) ?? null;
}
