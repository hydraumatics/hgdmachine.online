-- Cloudflare D1 (SQLite). Apply with: npx wrangler d1 migrations apply hydraumatics-db --remote
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  company    TEXT,
  phone      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS quote_requests (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ref        TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  details    TEXT NOT NULL,
  delivery   TEXT,
  urgency    TEXT,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','quoted','won','lost','spam')),
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quote_requests(contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created ON quote_requests(created_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  interests       TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending','subscribed','unsubscribed')),
  consent_text    TEXT NOT NULL,
  consent_at      TEXT NOT NULL,
  confirm_token   TEXT,
  unsub_token     TEXT NOT NULL,
  confirmed_at    TEXT,
  unsubscribed_at TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subs_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subs_confirm ON newsletter_subscribers(confirm_token);
CREATE INDEX IF NOT EXISTS idx_subs_unsub ON newsletter_subscribers(unsub_token);

-- Spam control: salted hash of the visitor's IP, kept for 24 hours only.
CREATE TABLE IF NOT EXISTS rate_limits (
  ip_hash TEXT NOT NULL,
  route   TEXT NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate ON rate_limits(ip_hash, route, ts);
