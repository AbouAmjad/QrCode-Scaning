# Timesheet Module (Phase 1)

Enterprise attendance module — **fully isolated** from ToolCustody inventory/scan workflows.

## Isolation

| Layer | Location |
|-------|----------|
| Frontend | `/timesheet.html`, `/timesheet/*` |
| API actions | `ts*` prefix → `server/src/timesheet/handler.js` |
| Database | `ts_*` tables in `server/sql/timesheet_schema.sql` |
| Audit | `ts_audit_log` (module-specific) |

Core `server.js` only delegates `ts*` actions; no existing handlers were changed.

## Roles (reuses system login)

| System role | Timesheet capabilities |
|-------------|------------------------|
| `employee` | Check in/out, history, hours summary |
| `engineer` | Workers on assigned projects, attendance, deductions, reports |
| `admin` | Employees, projects, geofence, QR, assignments, review |

## Attendance session model

`ts_attendance_sessions` stores full session lifecycle with future-ready fields:

- GPS in/out, QR validation, selfie URLs
- `face_match_score_*`, `liveness_score_*`, `face_embedding_ref`
- `device_id`, `device_fingerprint` (Phase 2+)
- Status: `open`, `completed`, `review`, `rejected`, `flagged`

## Phase 1 security

- Account (existing login + `ts_employees` profile)
- GPS / geofence (optional — missing geofence → review, not hard reject)
- Project QR validation
- Audit log on every mutation

**Not enabled yet:** device binding, selfie upload, face recognition, liveness.

## API actions

`tsBootstrap`, `tsCheckIn`, `tsCheckOut`, `tsMySessions`, `tsMySummary`,  
`tsEngineerWorkers`, `tsEngineerSessions`, `tsCreateDeduction`,  
`tsAdminUpsertEmployee`, `tsAdminUpsertProject`, `tsAdminAssignWorker`, `tsAdminAssignEngineer`,  
`tsAdminReviewSession`, `tsReportDaily`, `tsReportMonthly`, `tsReportSummary`

## Migrate

```bash
cd server && npm run migrate
```

## Demo seed

Project `DEMO01` with QR format: `TS:DEMO01:<secret>` (shown in Admin project list after migrate).
