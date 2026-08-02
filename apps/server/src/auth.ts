import type { Request, Response, NextFunction } from 'express';
import { supabaseAdmin, verifyAccessToken } from './supabase.js';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AppUser;
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

/** Verifies a Supabase Auth access token and loads the matching `profiles` row. */
export async function loadUser(token: string): Promise<AppUser | null> {
  const authUser = await verifyAccessToken(token);
  if (!authUser) return null;
  const { data: profile } = await supabaseAdmin.from('profiles').select('name, is_admin').eq('id', authUser.id).single();
  if (!profile) return null;
  return { id: authUser.id, email: authUser.email, name: profile.name, isAdmin: profile.is_admin };
}

export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) { next(); return; }
  try {
    const user = await loadUser(token);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in.' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Content admin access required.' });
    return;
  }
  next();
}
