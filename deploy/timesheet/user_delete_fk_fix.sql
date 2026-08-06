-- Allow deleting users who punched/created timesheet history.
-- Keep historical rows; null out user refs (ON DELETE SET NULL).
-- Additive / safe for Terminal + custody.

BEGIN;

-- Attendance punched_by (was NOT NULL, blocked deletes)
ALTER TABLE timesheet_attendance
  DROP CONSTRAINT IF EXISTS timesheet_attendance_punched_by_user_id_fkey;
ALTER TABLE timesheet_attendance
  ALTER COLUMN punched_by_user_id DROP NOT NULL;
ALTER TABLE timesheet_attendance
  ADD CONSTRAINT timesheet_attendance_punched_by_user_id_fkey
  FOREIGN KEY (punched_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE timesheet_attendance
  DROP CONSTRAINT IF EXISTS timesheet_attendance_voided_by_user_id_fkey;
ALTER TABLE timesheet_attendance
  ADD CONSTRAINT timesheet_attendance_voided_by_user_id_fkey
  FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Hour adjustments
ALTER TABLE timesheet_hour_adjustments
  DROP CONSTRAINT IF EXISTS timesheet_hour_adjustments_created_by_user_id_fkey;
ALTER TABLE timesheet_hour_adjustments
  ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE timesheet_hour_adjustments
  ADD CONSTRAINT timesheet_hour_adjustments_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE timesheet_hour_adjustments
  DROP CONSTRAINT IF EXISTS timesheet_hour_adjustments_voided_by_user_id_fkey;
ALTER TABLE timesheet_hour_adjustments
  ADD CONSTRAINT timesheet_hour_adjustments_voided_by_user_id_fkey
  FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Deductions
ALTER TABLE timesheet_deductions
  DROP CONSTRAINT IF EXISTS timesheet_deductions_created_by_user_id_fkey;
ALTER TABLE timesheet_deductions
  ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE timesheet_deductions
  ADD CONSTRAINT timesheet_deductions_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE timesheet_deductions
  DROP CONSTRAINT IF EXISTS timesheet_deductions_voided_by_user_id_fkey;
ALTER TABLE timesheet_deductions
  ADD CONSTRAINT timesheet_deductions_voided_by_user_id_fkey
  FOREIGN KEY (voided_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Worker account link creator
ALTER TABLE timesheet_worker_accounts
  DROP CONSTRAINT IF EXISTS timesheet_worker_accounts_created_by_user_id_fkey;
ALTER TABLE timesheet_worker_accounts
  ADD CONSTRAINT timesheet_worker_accounts_created_by_user_id_fkey
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
