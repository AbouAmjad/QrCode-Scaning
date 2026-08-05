/** Timesheet API client — isolated from core ToolCustody pages. */

async function tsGet(params = {}) {
  return apiGet({ ...params, action: params.action || "tsBootstrap" });
}

async function tsPost(fields = {}) {
  return apiPostForm(fields);
}

export async function bootstrap() {
  return tsGet({ action: "tsBootstrap" });
}

export async function checkIn(payload) {
  return tsPost({ action: "tsCheckIn", ...payload });
}

export async function checkOut(payload) {
  return tsPost({ action: "tsCheckOut", ...payload });
}

export async function mySessions(opts = {}) {
  return tsGet({ action: "tsMySessions", ...opts });
}

export async function mySummary(month) {
  return tsGet({ action: "tsMySummary", month: month || "" });
}

export async function engineerWorkers() {
  return tsGet({ action: "tsEngineerWorkers" });
}

export async function engineerSessions(projectId) {
  return tsGet({ action: "tsEngineerSessions", projectId: projectId || "" });
}

export async function createDeduction(payload) {
  return tsPost({ action: "tsCreateDeduction", ...payload });
}

export async function adminUpsertEmployee(payload) {
  return tsPost({ action: "tsAdminUpsertEmployee", ...payload });
}

export async function adminUpsertProject(payload) {
  return tsPost({ action: "tsAdminUpsertProject", ...payload });
}

export async function adminAssignWorker(projectId, employeeId) {
  return tsPost({ action: "tsAdminAssignWorker", projectId, employeeId });
}

export async function adminAssignEngineer(projectId, engineerUsername) {
  return tsPost({ action: "tsAdminAssignEngineer", projectId, engineerUsername });
}

export async function reportDaily(date, projectId) {
  return tsGet({ action: "tsReportDaily", date: date || "", projectId: projectId || "" });
}

export async function reportMonthly(month, projectId) {
  return tsGet({ action: "tsReportMonthly", month: month || "", projectId: projectId || "" });
}

export async function reviewSession(sessionId, status, notes) {
  return tsPost({ action: "tsAdminReviewSession", sessionId, status, notes: notes || "" });
}

export function getGps() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export function fmtMinutes(m) {
  const mins = Number(m) || 0;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return h ? `${h}h ${r}m` : `${r}m`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}
