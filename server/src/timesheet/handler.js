/**
 * Timesheet API router — completely isolated from core ToolCustody handlers.
 */
const { isTimesheetAction } = require("./constants");
const sessions = require("./sessions");
const admin = require("./admin");
const engineer = require("./engineer");
const reports = require("./reports");

function normalizeRole(role) {
  const raw = String(role || "").trim().toLowerCase();
  const map = {
    employee: "employee",
    store_keeper: "employee",
    staff: "employee",
    engineer: "engineer",
    supervisor: "engineer",
    viewer: "engineer",
    admin: "admin",
    administrator: "admin",
  };
  return map[raw] || "employee";
}

function isAdmin(user) {
  return normalizeRole(user.role) === "admin";
}

function isEngineer(user) {
  const r = normalizeRole(user.role);
  return r === "engineer" || r === "admin";
}

async function handleTimesheet(action, params, auth) {
  const user = auth.user;
  const role = normalizeRole(user.role);

  if (action === "tsBootstrap") {
    const employee = await sessions.getEmployeeByUsername(user.username);
    const payload = {
      role,
      username: user.username,
      employee: employee
        ? {
            id: employee.id,
            code: employee.employee_code,
            fullName: employee.full_name,
          }
        : null,
      openSession: employee ? await sessions.getOpenSession(employee.id) : null,
      projects: [],
      engineerProjects: [],
      allProjects: [],
      allEmployees: [],
    };

    if (employee) {
      payload.projects = (await sessions.workerProjects(employee.id)).map(admin.mapProject);
      if (payload.openSession) {
        payload.openSession = sessions.mapSession(payload.openSession, {
          code: payload.openSession.project_code,
          name: payload.openSession.project_name,
        });
      }
    }

    if (isEngineer(user)) {
      payload.engineerProjects = (await sessions.engineerProjects(user.username)).map(admin.mapProject);
    }

    if (isAdmin(user)) {
      payload.allProjects = await admin.listProjects();
      payload.allEmployees = await admin.listEmployees();
    }

    return { success: true, ...payload };
  }

  // --- Worker ---
  if (action === "tsCheckIn") {
    const employee = await sessions.getEmployeeByUsername(user.username);
    if (!employee) return { error: "EMPLOYEE_PROFILE_REQUIRED" };
    return sessions.checkIn({
      user,
      employee,
      projectId: Number(params.projectId),
      lat: params.lat != null ? Number(params.lat) : null,
      lng: params.lng != null ? Number(params.lng) : null,
      accuracyM: params.accuracyM != null ? Number(params.accuracyM) : null,
      qrCode: params.qrCode || params.qr || "",
      device: params.device || "",
    });
  }

  if (action === "tsCheckOut") {
    const employee = await sessions.getEmployeeByUsername(user.username);
    if (!employee) return { error: "EMPLOYEE_PROFILE_REQUIRED" };
    return sessions.checkOut({
      user,
      employee,
      lat: params.lat != null ? Number(params.lat) : null,
      lng: params.lng != null ? Number(params.lng) : null,
      accuracyM: params.accuracyM != null ? Number(params.accuracyM) : null,
      device: params.device || "",
    });
  }

  if (action === "tsMySessions") {
    const employee = await sessions.getEmployeeByUsername(user.username);
    if (!employee) return { error: "EMPLOYEE_PROFILE_REQUIRED" };
    const items = await sessions.listEmployeeSessions(employee.id, {
      limit: Number(params.limit) || 60,
      from: params.from || null,
      to: params.to || null,
    });
    return { success: true, items };
  }

  if (action === "tsMySummary") {
    const employee = await sessions.getEmployeeByUsername(user.username);
    if (!employee) return { error: "EMPLOYEE_PROFILE_REQUIRED" };
    const summary = await sessions.employeeSummary(employee.id, params.month || null);
    return { success: true, summary };
  }

  // --- Engineer ---
  if (action === "tsEngineerWorkers") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    const workers = await engineer.listEngineerWorkers(user.username);
    return { success: true, workers };
  }

  if (action === "tsEngineerSessions") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    const items = await engineer.listEngineerSessions(user.username, {
      limit: Number(params.limit) || 100,
      projectId: params.projectId ? Number(params.projectId) : null,
    });
    return { success: true, items };
  }

  if (action === "tsCreateDeduction") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    return engineer.createDeduction({
      user,
      employeeId: Number(params.employeeId),
      projectId: params.projectId ? Number(params.projectId) : null,
      sessionId: params.sessionId ? Number(params.sessionId) : null,
      minutes: params.minutes,
      reason: params.reason || params.note,
    });
  }

  // --- Admin ---
  if (action === "tsAdminListEmployees") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return { success: true, employees: await admin.listEmployees() };
  }

  if (action === "tsAdminUpsertEmployee") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return admin.upsertEmployee({ user, payload: params });
  }

  if (action === "tsAdminListProjects") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return { success: true, projects: await admin.listProjects() };
  }

  if (action === "tsAdminUpsertProject") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return admin.upsertProject({ user, payload: params });
  }

  if (action === "tsAdminAssignWorker") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return admin.assignWorker({
      user,
      projectId: Number(params.projectId),
      employeeId: Number(params.employeeId),
    });
  }

  if (action === "tsAdminAssignEngineer") {
    if (!isAdmin(user)) return { error: "FORBIDDEN" };
    return admin.assignEngineer({
      user,
      projectId: Number(params.projectId),
      engineerUsername: params.engineerUsername || params.username,
    });
  }

  if (action === "tsAdminReviewSession") {
    if (!isAdmin(user) && !isEngineer(user)) return { error: "FORBIDDEN" };
    return engineer.reviewSession({
      user,
      sessionId: Number(params.sessionId),
      status: params.status,
      notes: params.notes,
    });
  }

  // --- Reports ---
  if (action === "tsReportDaily") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    return reports.reportDaily({
      date: params.date,
      projectId: params.projectId ? Number(params.projectId) : null,
      employeeId: params.employeeId ? Number(params.employeeId) : null,
    });
  }

  if (action === "tsReportMonthly") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    return reports.reportMonthly({
      month: params.month,
      projectId: params.projectId ? Number(params.projectId) : null,
    });
  }

  if (action === "tsReportSummary") {
    if (!isEngineer(user)) return { error: "FORBIDDEN" };
    return reports.reportSummary({
      from: params.from,
      to: params.to,
      projectId: params.projectId ? Number(params.projectId) : null,
    });
  }

  return { error: "UNKNOWN_TIMESHEET_ACTION" };
}

module.exports = { isTimesheetAction, handleTimesheet };
