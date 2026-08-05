-- Timesheet module — isolated schema (Phase 1 + future biometrics)
-- Safe to run multiple times (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS ts_employees (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT UNIQUE NOT NULL,
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  face_embedding_ref TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_employees_user ON ts_employees (user_id);
CREATE INDEX IF NOT EXISTS idx_ts_employees_status ON ts_employees (status);

CREATE TABLE IF NOT EXISTS ts_projects (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  geofence_lat DOUBLE PRECISION,
  geofence_lng DOUBLE PRECISION,
  geofence_radius_m INTEGER NOT NULL DEFAULT 150,
  qr_secret TEXT NOT NULL,
  work_start_time TIME DEFAULT '08:00',
  work_end_time TIME DEFAULT '17:00',
  late_grace_minutes INTEGER NOT NULL DEFAULT 15,
  created_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_projects_status ON ts_projects (status);

CREATE TABLE IF NOT EXISTS ts_project_workers (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES ts_projects(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES ts_employees(id) ON DELETE CASCADE,
  assigned_by TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_ts_project_workers_employee ON ts_project_workers (employee_id);

CREATE TABLE IF NOT EXISTS ts_project_engineers (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES ts_projects(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  assigned_by TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, username)
);

CREATE INDEX IF NOT EXISTS idx_ts_project_engineers_user ON ts_project_engineers (username);

-- Future: device binding (Phase 2+)
CREATE TABLE IF NOT EXISTS ts_devices (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES ts_employees(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  device_label TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT DEFAULT '',
  approved_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS ts_attendance_sessions (
  id BIGSERIAL PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id INTEGER NOT NULL REFERENCES ts_employees(id) ON DELETE RESTRICT,
  project_id INTEGER NOT NULL REFERENCES ts_projects(id) ON DELETE RESTRICT,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_in_accuracy_m DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  check_out_accuracy_m DOUBLE PRECISION,
  qr_validated BOOLEAN NOT NULL DEFAULT FALSE,
  qr_code_scanned TEXT DEFAULT '',
  selfie_url_in TEXT DEFAULT NULL,
  selfie_url_out TEXT DEFAULT NULL,
  face_match_score_in DOUBLE PRECISION,
  face_match_score_out DOUBLE PRECISION,
  liveness_score_in DOUBLE PRECISION,
  liveness_score_out DOUBLE PRECISION,
  face_embedding_ref TEXT DEFAULT NULL,
  device_id INTEGER REFERENCES ts_devices(id) ON DELETE SET NULL,
  device_fingerprint TEXT DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  rejection_reason TEXT DEFAULT '',
  worked_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  deduction_minutes INTEGER NOT NULL DEFAULT 0,
  engineer_notes TEXT DEFAULT '',
  review_required BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ts_sessions_public ON ts_attendance_sessions (public_id);
CREATE INDEX IF NOT EXISTS idx_ts_sessions_employee ON ts_attendance_sessions (employee_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_sessions_project ON ts_attendance_sessions (project_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_ts_sessions_status ON ts_attendance_sessions (status);
CREATE INDEX IF NOT EXISTS idx_ts_sessions_day ON ts_attendance_sessions (date_trunc('day', check_in_at AT TIME ZONE 'UTC'));

CREATE TABLE IF NOT EXISTS ts_deductions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT REFERENCES ts_attendance_sessions(id) ON DELETE SET NULL,
  employee_id INTEGER NOT NULL REFERENCES ts_employees(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES ts_projects(id) ON DELETE SET NULL,
  minutes_deducted INTEGER NOT NULL CHECK (minutes_deducted > 0),
  reason TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_deductions_employee ON ts_deductions (employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ts_selfie_assets (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES ts_attendance_sessions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'check_in',
  storage_path TEXT NOT NULL,
  compressed BOOLEAN NOT NULL DEFAULT TRUE,
  retain_until TIMESTAMPTZ,
  review_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_selfie_retain ON ts_selfie_assets (retain_until);

CREATE TABLE IF NOT EXISTS ts_audit_log (
  id BIGSERIAL PRIMARY KEY,
  username TEXT DEFAULT '',
  role TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  before_state TEXT DEFAULT '',
  after_state TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  device TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ts_audit_created ON ts_audit_log (created_at DESC);
