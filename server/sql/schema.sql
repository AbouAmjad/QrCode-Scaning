-- ToolCustody PostgreSQL schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  api_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog (
  code TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'tool',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scans (
  id BIGSERIAL PRIMARY KEY,
  tool_code TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  row_date TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_scans_code ON scans (tool_code);
CREATE INDEX IF NOT EXISTS idx_scans_date ON scans (row_date);

CREATE TABLE IF NOT EXISTS receiving (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  supplier TEXT DEFAULT '',
  invoice TEXT DEFAULT '',
  po TEXT DEFAULT '',
  cost TEXT DEFAULT '',
  warranty TEXT DEFAULT '',
  qty NUMERIC NOT NULL DEFAULT 1,
  by_user TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage (
  id BIGSERIAL PRIMARY KEY,
  tool_code TEXT NOT NULL,
  tool_name TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  damaged_by TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  remark TEXT DEFAULT '',
  row_date TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_photos (
  code TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  by_user TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_requests (
  id BIGSERIAL PRIMARY KEY,
  by_user TEXT DEFAULT '',
  role TEXT DEFAULT 'engineer',
  items TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_lifecycle (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  state TEXT NOT NULL,
  note TEXT DEFAULT '',
  by_user TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  username TEXT DEFAULT '',
  role TEXT DEFAULT '',
  action TEXT NOT NULL,
  before_state TEXT DEFAULT '',
  after_state TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  device TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
