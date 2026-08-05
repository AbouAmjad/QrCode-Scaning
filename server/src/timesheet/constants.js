/** Timesheet module constants — isolated from core ToolCustody. */

const SESSION_STATUS = Object.freeze({
  OPEN: "open",
  COMPLETED: "completed",
  REJECTED: "rejected",
  REVIEW: "review",
  FLAGGED: "flagged",
});

const EMPLOYEE_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});

const PROJECT_STATUS = Object.freeze({
  ACTIVE: "active",
  ARCHIVED: "archived",
});

const DEVICE_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  BLOCKED: "blocked",
});

/** Actions routed to the timesheet module (prefix ts). */
const ACTIONS = Object.freeze([
  "tsBootstrap",
  "tsCheckIn",
  "tsCheckOut",
  "tsMySessions",
  "tsMySummary",
  "tsEngineerWorkers",
  "tsEngineerSessions",
  "tsCreateDeduction",
  "tsAdminListEmployees",
  "tsAdminUpsertEmployee",
  "tsAdminListProjects",
  "tsAdminUpsertProject",
  "tsAdminAssignWorker",
  "tsAdminAssignEngineer",
  "tsAdminReviewSession",
  "tsReportDaily",
  "tsReportMonthly",
  "tsReportSummary",
]);

function isTimesheetAction(action) {
  return ACTIONS.includes(String(action || ""));
}

module.exports = {
  SESSION_STATUS,
  EMPLOYEE_STATUS,
  PROJECT_STATUS,
  DEVICE_STATUS,
  ACTIONS,
  isTimesheetAction,
};
