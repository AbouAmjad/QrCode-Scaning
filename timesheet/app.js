/**
 * Timesheet UI — role-based panels (worker / engineer / admin).
 * Completely isolated module; uses existing auth only.
 */
import * as TS from "./api.js";

let ctx = null;

export async function bootTimesheet() {
  const role = typeof getRole === "function" ? getRole() : "employee";
  showRoleTabs(role);
  try {
    ctx = await TS.bootstrap();
    renderAll();
  } catch (e) {
    document.getElementById("tsRoot").innerHTML = `<div class="ts-alert err">${TS.escHtml(e.message || e)}</div>`;
  }
}

function showRoleTabs(role) {
  document.querySelectorAll("[data-ts-panel]").forEach((el) => {
    const need = el.dataset.tsPanel.split(" ");
    el.hidden = !need.includes(role) && !(role === "admin" && need.includes("engineer"));
  });
  if (role === "admin") {
    document.querySelectorAll("[data-ts-panel=engineer]").forEach((el) => (el.hidden = false));
  }
}

async function renderAll() {
  renderWorker();
  renderSummary();
  if (isEngineer()) {
    renderEngineer();
    renderReports();
  }
  if (isAdmin()) renderAdmin();
}

function isEngineer() {
  const r = typeof getRole === "function" ? getRole() : "";
  return r === "engineer" || r === "admin";
}

function isAdmin() {
  return typeof getRole === "function" && getRole() === "admin";
}

function renderWorker() {
  const host = document.getElementById("tsWorkerPanel");
  if (!host) return;

  if (!ctx?.employee) {
    host.innerHTML = `<div class="ts-alert warn">No Timesheet employee profile linked to <strong>${TS.escHtml(ctx?.username || "")}</strong>. Ask admin to create your profile.</div>`;
    return;
  }

  const open = ctx.openSession;
  const projects = ctx.projects || [];
  const projectOpts = projects
    .map((p) => `<option value="${p.id}">${TS.escHtml(p.name)} (${TS.escHtml(p.code)})</option>`)
    .join("");

  host.innerHTML = `
    <div class="ts-grid-2">
      <div class="ts-card">
        <h3><i class="bi bi-box-arrow-in-right"></i> Check In / Out</h3>
        ${open ? `<p class="ts-muted">Open session · ${TS.escHtml(open.projectName || "")} · since ${TS.fmtDate(open.checkInAt)}</p>` : ""}
        <label class="ts-field">Project<select id="tsProject" ${open ? "disabled" : ""}>${projectOpts || '<option value="">No projects assigned</option>'}</select></label>
        <label class="ts-field">Project QR code<input id="tsQr" placeholder="Scan or paste QR value" ${open ? "disabled" : ""}></label>
        <div class="ts-actions">
          <button type="button" class="tc-btn tc-btn-primary" id="tsBtnIn" ${open ? "disabled" : ""}><i class="bi bi-play-circle"></i> Check In</button>
          <button type="button" class="tc-btn" id="tsBtnOut" ${open ? "" : "disabled"}><i class="bi bi-stop-circle"></i> Check Out</button>
        </div>
        <p class="ts-hint">GPS + QR validation. Selfie & face match — Phase 2.</p>
      </div>
      <div class="ts-card" id="tsSummaryCard">
        <h3><i class="bi bi-hourglass-split"></i> This month</h3>
        <div id="tsSummaryBody">Loading…</div>
      </div>
    </div>
    <div class="ts-card mt-3">
      <h3><i class="bi bi-clock-history"></i> My attendance</h3>
      <div id="tsSessionsList">Loading…</div>
    </div>`;

  document.getElementById("tsBtnIn")?.addEventListener("click", onCheckIn);
  document.getElementById("tsBtnOut")?.addEventListener("click", onCheckOut);
  loadMySessions();
  loadSummary();
}

async function onCheckIn() {
  const projectId = document.getElementById("tsProject")?.value;
  const qrCode = document.getElementById("tsQr")?.value?.trim();
  if (!projectId) {
    TCUI.toast("Select a project", "err");
    return;
  }
  if (!qrCode) {
    TCUI.toast("Scan or enter project QR", "err");
    return;
  }
  try {
    const gps = await TS.getGps().catch(() => ({}));
    const res = await TS.checkIn({ projectId, qrCode, ...gps, device: navigator.userAgent?.slice(0, 120) });
    if (res.error) {
      TCUI.toast(res.error, "err");
      return;
    }
    TCUI.toast(res.reviewRequired ? "Checked in — pending review" : "Checked in", "ok");
    ctx = await TS.bootstrap();
    renderAll();
  } catch (e) {
    TCUI.toast(e.message || e, "err");
  }
}

async function onCheckOut() {
  try {
    const gps = await TS.getGps().catch(() => ({}));
    const res = await TS.checkOut({ ...gps, device: navigator.userAgent?.slice(0, 120) });
    if (res.error) {
      TCUI.toast(res.error, "err");
      return;
    }
    TCUI.toast("Checked out", "ok");
    ctx = await TS.bootstrap();
    renderAll();
  } catch (e) {
    TCUI.toast(e.message || e, "err");
  }
}

async function loadMySessions() {
  const host = document.getElementById("tsSessionsList");
  if (!host || !ctx?.employee) return;
  try {
    const data = await TS.mySessions();
    const items = data.items || [];
    if (!items.length) {
      host.innerHTML = `<p class="ts-muted">No sessions yet.</p>`;
      return;
    }
    host.innerHTML = `<div class="ts-table-wrap"><table class="ts-table"><thead><tr>
      <th>Project</th><th>In</th><th>Out</th><th>Worked</th><th>OT</th><th>Status</th>
    </tr></thead><tbody>${items
      .map(
        (s) => `<tr>
        <td>${TS.escHtml(s.projectName)}</td>
        <td>${TS.fmtDate(s.checkInAt)}</td>
        <td>${TS.fmtDate(s.checkOutAt)}</td>
        <td>${TS.fmtMinutes(s.workedMinutes)}</td>
        <td>${TS.fmtMinutes(s.overtimeMinutes)}</td>
        <td><span class="ts-badge ${s.status}">${TS.escHtml(s.status)}</span></td>
      </tr>`
      )
      .join("")}</tbody></table></div>`;
  } catch (e) {
    host.innerHTML = `<p class="ts-alert err">${TS.escHtml(e.message)}</p>`;
  }
}

async function loadSummary() {
  const host = document.getElementById("tsSummaryBody");
  if (!host || !ctx?.employee) return;
  try {
    const data = await TS.mySummary();
    const s = data.summary || {};
    host.innerHTML = `
      <div class="ts-kpis">
        <div><span>Sessions</span><strong>${s.sessions || 0}</strong></div>
        <div><span>Worked</span><strong>${s.workedHours || 0}h</strong></div>
        <div><span>Overtime</span><strong>${s.overtimeHours || 0}h</strong></div>
        <div><span>Deductions</span><strong>${s.deductionHours || 0}h</strong></div>
      </div>`;
  } catch (e) {
    host.innerHTML = `<p class="ts-muted">${TS.escHtml(e.message)}</p>`;
  }
}

function renderSummary() {
  /* loaded in renderWorker */
}

function renderEngineer() {
  const host = document.getElementById("tsEngineerPanel");
  if (!host) return;
  host.innerHTML = `
    <div class="ts-grid-2">
      <div class="ts-card">
        <h3><i class="bi bi-people"></i> Project workers</h3>
        <div id="tsEngWorkers">Loading…</div>
      </div>
      <div class="ts-card">
        <h3><i class="bi bi-dash-circle"></i> Hour deduction</h3>
        <label class="ts-field">Worker<select id="tsDedWorker"></select></label>
        <label class="ts-field">Minutes<input type="number" id="tsDedMin" min="1" step="1" value="60"></label>
        <label class="ts-field">Reason<input id="tsDedReason" placeholder="Late / early leave / …"></label>
        <button type="button" class="tc-btn tc-btn-primary" id="tsDedBtn">Apply deduction</button>
      </div>
    </div>
    <div class="ts-card mt-3">
      <h3><i class="bi bi-list-check"></i> Attendance (my projects)</h3>
      <div id="tsEngSessions">Loading…</div>
    </div>`;

  document.getElementById("tsDedBtn")?.addEventListener("click", onDeduction);
  loadEngineerData();
}

async function loadEngineerData() {
  try {
    const w = await TS.engineerWorkers();
    const workers = w.workers || [];
    const sel = document.getElementById("tsDedWorker");
    if (sel) {
      sel.innerHTML = workers.map((x) => `<option value="${x.id}">${TS.escHtml(x.fullName)} (${TS.escHtml(x.employeeCode)})</option>`).join("") || `<option value="">No workers</option>`;
    }
    document.getElementById("tsEngWorkers").innerHTML = workers.length
      ? `<ul class="ts-list">${workers.map((x) => `<li><strong>${TS.escHtml(x.fullName)}</strong> · ${TS.escHtml(x.employeeCode)}</li>`).join("")}</ul>`
      : `<p class="ts-muted">No workers on your projects.</p>`;

    const s = await TS.engineerSessions();
    const items = s.items || [];
    document.getElementById("tsEngSessions").innerHTML = items.length
      ? `<div class="ts-table-wrap"><table class="ts-table"><thead><tr>
          <th>Worker</th><th>Project</th><th>In</th><th>Out</th><th>Worked</th><th>Status</th>
        </tr></thead><tbody>${items
          .map(
            (r) => `<tr>
            <td>${TS.escHtml(r.employeeName)}</td>
            <td>${TS.escHtml(r.projectName)}</td>
            <td>${TS.fmtDate(r.checkInAt)}</td>
            <td>${TS.fmtDate(r.checkOutAt)}</td>
            <td>${TS.fmtMinutes(r.workedMinutes)}</td>
            <td><span class="ts-badge ${r.status}">${TS.escHtml(r.status)}</span></td>
          </tr>`
          )
          .join("")}</tbody></table></div>`
      : `<p class="ts-muted">No attendance records.</p>`;
  } catch (e) {
    document.getElementById("tsEngWorkers").innerHTML = `<p class="ts-alert err">${TS.escHtml(e.message)}</p>`;
  }
}

async function onDeduction() {
  const employeeId = document.getElementById("tsDedWorker")?.value;
  const minutes = document.getElementById("tsDedMin")?.value;
  const reason = document.getElementById("tsDedReason")?.value?.trim();
  if (!employeeId || !reason) {
    TCUI.toast("Worker and reason required", "err");
    return;
  }
  try {
    const res = await TS.createDeduction({ employeeId, minutes, reason });
    if (res.error) {
      TCUI.toast(res.error, "err");
      return;
    }
    TCUI.toast("Deduction recorded", "ok");
    document.getElementById("tsDedReason").value = "";
  } catch (e) {
    TCUI.toast(e.message || e, "err");
  }
}

function renderReports() {
  const host = document.getElementById("tsReportsPanel");
  if (!host) return;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  host.innerHTML = `
    <div class="ts-card">
      <h3><i class="bi bi-file-earmark-bar-graph"></i> Reports</h3>
      <div class="ts-grid-3">
        <label class="ts-field">Day<input type="date" id="tsRepDay" value="${today}"></label>
        <label class="ts-field">Month<input type="month" id="tsRepMonth" value="${month}"></label>
        <div class="ts-actions align-end">
          <button type="button" class="tc-btn" id="tsRepDailyBtn">Daily</button>
          <button type="button" class="tc-btn" id="tsRepMonthlyBtn">Monthly</button>
        </div>
      </div>
      <pre id="tsRepOut" class="ts-pre">Run a report…</pre>
    </div>`;
  document.getElementById("tsRepDailyBtn")?.addEventListener("click", async () => {
    const d = document.getElementById("tsRepDay").value;
    const r = await TS.reportDaily(d);
    document.getElementById("tsRepOut").textContent = JSON.stringify(r, null, 2);
  });
  document.getElementById("tsRepMonthlyBtn")?.addEventListener("click", async () => {
    const m = document.getElementById("tsRepMonth").value;
    const r = await TS.reportMonthly(m);
    document.getElementById("tsRepOut").textContent = JSON.stringify(r, null, 2);
  });
}

function renderAdmin() {
  const host = document.getElementById("tsAdminPanel");
  if (!host) return;
  host.innerHTML = `
    <div class="ts-grid-2">
      <div class="ts-card">
        <h3><i class="bi bi-person-plus"></i> Employee</h3>
        <label class="ts-field">Login username<input id="tsEmpUser" placeholder="same as system login"></label>
        <label class="ts-field">Employee code<input id="tsEmpCode"></label>
        <label class="ts-field">Full name<input id="tsEmpName"></label>
        <button type="button" class="tc-btn tc-btn-primary" id="tsEmpSave">Save employee</button>
        <div id="tsEmpList" class="mt-2 ts-small">Loading…</div>
      </div>
      <div class="ts-card">
        <h3><i class="bi bi-building"></i> Project + Geofence + QR</h3>
        <label class="ts-field">Code<input id="tsProjCode" placeholder="SITE01"></label>
        <label class="ts-field">Name<input id="tsProjName"></label>
        <label class="ts-field">Lat<input type="number" step="any" id="tsProjLat"></label>
        <label class="ts-field">Lng<input type="number" step="any" id="tsProjLng"></label>
        <label class="ts-field">Radius (m)<input type="number" id="tsProjRad" value="150"></label>
        <button type="button" class="tc-btn tc-btn-primary" id="tsProjSave">Save project</button>
        <div id="tsProjList" class="mt-2 ts-small">Loading…</div>
      </div>
    </div>
    <div class="ts-card mt-3">
      <h3><i class="bi bi-link-45deg"></i> Assignments</h3>
      <div class="ts-grid-3">
        <label class="ts-field">Project<select id="tsAssignProj"></select></label>
        <label class="ts-field">Worker<select id="tsAssignWorker"></select></label>
        <button type="button" class="tc-btn" id="tsAssignWorkerBtn">Assign worker</button>
      </div>
      <div class="ts-grid-3 mt-2">
        <label class="ts-field">Project<select id="tsAssignProjEng"></select></label>
        <label class="ts-field">Engineer username<input id="tsAssignEngUser" placeholder="eng1"></label>
        <button type="button" class="tc-btn" id="tsAssignEngBtn">Assign engineer</button>
      </div>
    </div>`;

  document.getElementById("tsEmpSave")?.addEventListener("click", saveEmployee);
  document.getElementById("tsProjSave")?.addEventListener("click", saveProject);
  document.getElementById("tsAssignWorkerBtn")?.addEventListener("click", assignWorker);
  document.getElementById("tsAssignEngBtn")?.addEventListener("click", assignEngineer);
  renderAdminLists();
}

async function renderAdminLists() {
  const employees = ctx?.allEmployees || [];
  const projects = ctx?.allProjects || [];
  document.getElementById("tsEmpList").innerHTML = employees.length
    ? `<ul class="ts-list">${employees.map((e) => `<li>${TS.escHtml(e.fullName)} · ${TS.escHtml(e.username)} · ${TS.escHtml(e.employeeCode)}</li>`).join("")}</ul>`
    : `<p class="ts-muted">No employees yet.</p>`;
  document.getElementById("tsProjList").innerHTML = projects.length
    ? `<ul class="ts-list">${projects
        .map(
          (p) => `<li><strong>${TS.escHtml(p.name)}</strong> · QR: <code>${TS.escHtml(p.qr?.qrValue || p.code)}</code></li>`
        )
        .join("")}</ul>`
    : `<p class="ts-muted">No projects yet.</p>`;

  const projOpts = projects.map((p) => `<option value="${p.id}">${TS.escHtml(p.name)}</option>`).join("");
  ["tsAssignProj", "tsAssignProjEng"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = projOpts;
  });
  const wsel = document.getElementById("tsAssignWorker");
  if (wsel) wsel.innerHTML = employees.map((e) => `<option value="${e.id}">${TS.escHtml(e.fullName)}</option>`).join("");
}

async function saveEmployee() {
  const payload = {
    username: document.getElementById("tsEmpUser").value.trim(),
    employeeCode: document.getElementById("tsEmpCode").value.trim(),
    fullName: document.getElementById("tsEmpName").value.trim(),
  };
  const res = await TS.adminUpsertEmployee(payload);
  if (res.error) return TCUI.toast(res.error, "err");
  TCUI.toast("Employee saved", "ok");
  ctx = await TS.bootstrap();
  renderAll();
}

async function saveProject() {
  const payload = {
    code: document.getElementById("tsProjCode").value.trim(),
    name: document.getElementById("tsProjName").value.trim(),
    lat: document.getElementById("tsProjLat").value,
    lng: document.getElementById("tsProjLng").value,
    radiusM: document.getElementById("tsProjRad").value,
  };
  const res = await TS.adminUpsertProject(payload);
  if (res.error) return TCUI.toast(res.error, "err");
  TCUI.toast("Project saved — copy QR from list", "ok");
  ctx = await TS.bootstrap();
  renderAll();
}

async function assignWorker() {
  const res = await TS.adminAssignWorker(
    document.getElementById("tsAssignProj").value,
    document.getElementById("tsAssignWorker").value
  );
  if (res.error) return TCUI.toast(res.error, "err");
  TCUI.toast("Worker assigned", "ok");
}

async function assignEngineer() {
  const res = await TS.adminAssignEngineer(
    document.getElementById("tsAssignProjEng").value,
    document.getElementById("tsAssignEngUser").value.trim()
  );
  if (res.error) return TCUI.toast(res.error, "err");
  TCUI.toast("Engineer assigned", "ok");
}
