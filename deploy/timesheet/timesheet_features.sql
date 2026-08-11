-- Additive timesheet feature tables (safe to re-run)
BEGIN;

CREATE TABLE IF NOT EXISTS timesheet_activity_log (
  id BIGSERIAL PRIMARY KEY,
  ref_code TEXT NOT NULL,
  event_type TEXT NOT NULL,
  worker_code TEXT,
  work_date DATE,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  before_value NUMERIC(12,2),
  after_value NUMERIC(12,2),
  delta_value NUMERIC(12,2),
  unit TEXT NOT NULL DEFAULT 'hours',
  reason TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_activity_created ON timesheet_activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timesheet_activity_worker ON timesheet_activity_log (worker_code, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_timesheet_activity_type ON timesheet_activity_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timesheet_activity_ref ON timesheet_activity_log (ref_code);

CREATE TABLE IF NOT EXISTS timesheet_notifications (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  ref_code TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info',
  target_role TEXT,
  target_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timesheet_notif_created ON timesheet_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timesheet_notif_unread ON timesheet_notifications (is_read, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON timesheet_activity_log TO toolcustody;
GRANT USAGE, SELECT ON SEQUENCE timesheet_activity_log_id_seq TO toolcustody;
GRANT SELECT, INSERT, UPDATE, DELETE ON timesheet_notifications TO toolcustody;
GRANT USAGE, SELECT ON SEQUENCE timesheet_notifications_id_seq TO toolcustody;

-- Seed NEW roles only when they have zero permission rows (never wipe existing)
INSERT INTO permissions (code, module, label) VALUES
  ('timesheet.reports.read', 'Timesheet', 'View timesheet reports'),
  ('timesheet.notifications.read', 'Timesheet', 'View timesheet notifications')
ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label;

-- viewer
INSERT INTO role_permissions (role, permission_code)
SELECT 'viewer', x FROM unnest(ARRAY[
  'timesheet.attendance.read',
  'timesheet.reports.read',
  'timesheet.notifications.read',
  'dashboard.view'
]) AS x
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'viewer');

-- storekeeper
INSERT INTO role_permissions (role, permission_code)
SELECT 'storekeeper', x FROM unnest(ARRAY[
  'timesheet.scan',
  'timesheet.attendance.read',
  'timesheet.reports.read',
  'timesheet.notifications.read',
  'dashboard.view',
  'terminal.use',
  'tool.view',
  'tool.search'
]) AS x
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'storekeeper');

-- supervisor
INSERT INTO role_permissions (role, permission_code)
SELECT 'supervisor', x FROM unnest(ARRAY[
  'timesheet.attendance.read',
  'timesheet.attendance.void',
  'timesheet.hours.adjust',
  'timesheet.deductions.manage',
  'timesheet.reports.read',
  'timesheet.notifications.read',
  'timesheet.settings.manage',
  'dashboard.view',
  'projects.view',
  'worker.view'
]) AS x
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'supervisor');

COMMIT;
