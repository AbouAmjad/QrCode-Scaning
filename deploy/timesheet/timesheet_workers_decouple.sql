-- Timesheet workforce independent of store catalog/people.
-- Additive + one-time seed from existing timesheet codes (names copied once from catalog if present).
-- Does NOT modify catalog, scans, custody, or People.

BEGIN;

CREATE TABLE IF NOT EXISTS timesheet_workers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_timesheet_workers_active
  ON timesheet_workers (is_active, code);

-- Seed from any worker_code already used in timesheet tables (preserve history).
INSERT INTO timesheet_workers (code, name, is_active, notes)
SELECT DISTINCT ON (x.code)
  x.code,
  COALESCE(NULLIF(TRIM(c.description), ''), x.code) AS name,
  TRUE,
  'Seeded from prior timesheet usage'
FROM (
  SELECT worker_code AS code FROM timesheet_attendance
  UNION
  SELECT worker_code FROM timesheet_hour_adjustment_lines
  UNION
  SELECT worker_code FROM timesheet_deductions
  UNION
  SELECT worker_code FROM timesheet_worker_accounts
) x
LEFT JOIN catalog c ON c.code = x.code
ON CONFLICT (code) DO NOTHING;

-- Drop catalog FKs (store people) — keep projects/users FKs untouched.
ALTER TABLE timesheet_attendance
  DROP CONSTRAINT IF EXISTS timesheet_attendance_worker_code_fkey;
ALTER TABLE timesheet_hour_adjustment_lines
  DROP CONSTRAINT IF EXISTS timesheet_hour_adjustment_lines_worker_code_fkey;
ALTER TABLE timesheet_deductions
  DROP CONSTRAINT IF EXISTS timesheet_deductions_worker_code_fkey;
ALTER TABLE timesheet_worker_accounts
  DROP CONSTRAINT IF EXISTS timesheet_worker_accounts_worker_code_fkey;

-- Point worker_code at timesheet_workers instead of catalog.
ALTER TABLE timesheet_attendance
  ADD CONSTRAINT timesheet_attendance_worker_code_fkey
  FOREIGN KEY (worker_code) REFERENCES timesheet_workers(code);
ALTER TABLE timesheet_hour_adjustment_lines
  ADD CONSTRAINT timesheet_hour_adjustment_lines_worker_code_fkey
  FOREIGN KEY (worker_code) REFERENCES timesheet_workers(code);
ALTER TABLE timesheet_deductions
  ADD CONSTRAINT timesheet_deductions_worker_code_fkey
  FOREIGN KEY (worker_code) REFERENCES timesheet_workers(code);
ALTER TABLE timesheet_worker_accounts
  ADD CONSTRAINT timesheet_worker_accounts_worker_code_fkey
  FOREIGN KEY (worker_code) REFERENCES timesheet_workers(code);

-- Permission for managing timesheet workforce (additive).
INSERT INTO permissions (code, module, label)
VALUES ('timesheet.workers.manage', 'Timesheet', 'Manage timesheet workers')
ON CONFLICT (code) DO UPDATE SET module = EXCLUDED.module, label = EXCLUDED.label;

-- Grant to admin if role matrix uses explicit rows; admin runtime still gets all codes.
INSERT INTO role_permissions (role, permission_code)
SELECT 'admin', 'timesheet.workers.manage'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'admin' AND permission_code = 'timesheet.workers.manage'
);

INSERT INTO role_permissions (role, permission_code)
SELECT 'supervisor', 'timesheet.workers.manage'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'supervisor' AND permission_code = 'timesheet.workers.manage'
);

INSERT INTO role_permissions (role, permission_code)
SELECT 'supervisor', 'timesheet.worker_accounts.manage'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions WHERE role = 'supervisor' AND permission_code = 'timesheet.worker_accounts.manage'
);

COMMIT;
