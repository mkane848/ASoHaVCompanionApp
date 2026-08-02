import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.ASOHAV_DB_PATH || path.join(dataDir, 'asohav.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gm_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  role TEXT NOT NULL,
  character_id TEXT
);

CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS character_sheets (
  character_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS party (
  campaign_id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bonds (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  character_a_id TEXT NOT NULL,
  character_b_id TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS library (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS changelog (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  who TEXT NOT NULL,
  action TEXT NOT NULL,
  collection TEXT NOT NULL,
  object_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  before TEXT,
  after TEXT
);
`);
