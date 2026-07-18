require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { query } = require("./db");

const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/var/www/toolcustody/uploads";
const PUBLIC_BASE = process.env.PUBLIC_BASE || "https://aics.iskndr.com";

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json({ limit: "15mb" }));
app.use(express.text({ type: ["text/plain", "application/json"], limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

function rowDateNow() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `{${dd}/${mm}/${yyyy}}`;
}

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

function mergeParams(req) {
  let body = req.body;
  if (typeof body === "string" && body.trim()) {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return { ...(req.query || {}), ...(body || {}) };
}

async function findUserByToken(token) {
  if (!token) return null;
  const r = await query("SELECT * FROM users WHERE api_token = $1 LIMIT 1", [token]);
  return r.rows[0] || null;
}

async function requireAuth(params) {
  const user = await findUserByToken(params.token);
  if (!user) return { error: "UNAUTHORIZED" };
  return { user };
}

async function appendAudit({ username, role, action, before, after, detail, device }) {
  await query(
    `INSERT INTO audit_log (username, role, action, before_state, after_state, detail, device)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [username || "", role || "", action || "", before || "", after || "", detail || "", device || ""]
  );
}

function saveDataUrl(dataUrl, prefix) {
  const match = String(dataUrl || "").match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  const contentType = match ? match[1] : "image/jpeg";
  const raw = match ? match[2] : String(dataUrl || "").replace(/^data:image\/\w+;base64,/, "");
  if (!raw) throw new Error("Invalid image");
  const ext = contentType.includes("png") ? "png" : "jpg";
  const name = `${prefix}_${Date.now()}.${ext}`;
  const full = path.join(UPLOAD_DIR, name);
  fs.writeFileSync(full, Buffer.from(raw, "base64"));
  return `/uploads/${name}`;
}

async function handle(params) {
  const action = params.action;

  if (action === "options") return { ok: true };

  if (action === "login") {
    const username = String(params.user || "").trim();
    const password = String(params.pass || "");
    const r = await query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password, u.password_hash))) {
      return { success: false };
    }
    await appendAudit({
      username: u.username,
      role: u.role,
      action: "LOGIN",
      detail: "success",
      device: params.device || "",
    });
    return {
      success: true,
      token: u.api_token,
      role: normalizeRole(u.role),
      user: u.username,
    };
  }

  // Scan append (legacy GAS shape)
  if (params.scanData) {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const code = String(params.scanData).trim().toUpperCase();
    if (!code) return { error: "NO CODE" };
    const rd = rowDateNow();
    await query(
      `INSERT INTO scans (tool_code, row_date, created_by) VALUES ($1, $2, $3)`,
      [code, rd, auth.user.username]
    );
    // auto upsert person/tool desc placeholder
    if (/^[PIECB]/.test(code) && code !== "IN" && code !== "OUT") {
      await query(
        `INSERT INTO catalog (code, description, kind)
         VALUES ($1, $1, $2)
         ON CONFLICT (code) DO NOTHING`,
        [code, code.startsWith("C") || code.startsWith("B") ? "consumable" : code.startsWith("P") ? "person" : "tool"]
      );
    }
    return { status: "OK" };
  }

  if (action === "getDesc") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const code = String(params.code || "").trim().toUpperCase();
    if (!code) return { description: "NO CODE" };
    const r = await query("SELECT description FROM catalog WHERE code = $1", [code]);
    if (r.rows[0]) return { description: r.rows[0].description || code };
    return { description: "DESCRIPTION NOT FOUND" };
  }

  if (action === "getDates") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const r = await query(
      `SELECT DISTINCT row_date FROM scans WHERE row_date <> '' ORDER BY row_date`
    );
    return r.rows.map((x) => x.row_date);
  }

  if (action === "getData") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const targetDate = params.date || "";
    const r = await query(
      `SELECT s.tool_code, s.row_date, s.scanned_at,
              COALESCE(c.description, s.tool_code) AS description
       FROM scans s
       LEFT JOIN catalog c ON c.code = s.tool_code
       ORDER BY s.id ASC`
    );
    return r.rows.map((row) => ({
      toolCode: row.tool_code,
      toolDescription: row.description,
      rowDate: row.row_date,
      timestamp: row.scanned_at ? new Date(row.scanned_at).toISOString() : row.row_date,
      isTargetDay: row.row_date === targetDate,
    }));
  }

  if (action === "getDamageDates") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const r = await query(`SELECT DISTINCT row_date FROM damage ORDER BY row_date DESC`);
    return r.rows.map((x) => x.row_date.replace(/[{}]/g, ""));
  }

  if (action === "getDamage") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const filter = String(params.date || "").replace(/[{}]/g, "").trim();
    let sql = `SELECT * FROM damage ORDER BY id DESC LIMIT 500`;
    let args = [];
    if (filter) {
      sql = `SELECT * FROM damage WHERE REPLACE(REPLACE(row_date,'{',''),'}','') = $1 ORDER BY id DESC LIMIT 500`;
      args = [filter];
    }
    const r = await query(sql, args);
    return {
      items: r.rows.map((row) => ({
        date: row.row_date,
        code: row.tool_code,
        name: row.tool_name,
        image: row.image_url,
        damagedBy: row.damaged_by,
        count: row.qty,
        remark: row.remark,
      })),
    };
  }

  if (action === "submitDamage") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const toolCode = String(params.toolCode || params.code || "").trim().toUpperCase();
    const personCode = String(params.personCode || params.damagedBy || "").trim().toUpperCase();
    const qty = Math.max(1, Number(params.qty || params.count || 1) || 1);
    const remark = String(params.remark || params.remarks || "").trim() || "No remark";
    const rowDate = String(params.date || "").trim() || rowDateNow().replace(/[{}]/g, "");
    if (!toolCode) return { error: "Tool code is required" };
    if (!personCode) return { error: "Person code is required" };
    let imageUrl = "";
    if (params.imageBase64 || params.image) {
      try {
        imageUrl = saveDataUrl(params.imageBase64 || params.image, "damage_" + toolCode);
      } catch (e) {
        // keep going without image
      }
    }
    const desc = await query("SELECT description FROM catalog WHERE code = $1", [toolCode]);
    const toolName = desc.rows[0]?.description || toolCode;
    const ins = await query(
      `INSERT INTO damage (tool_code, tool_name, image_url, damaged_by, qty, remark, row_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [toolCode, toolName, imageUrl, personCode, qty, remark, rowDate]
    );
    await appendAudit({
      username: auth.user.username,
      role: auth.user.role,
      action: "DAMAGE_CREATE",
      after: JSON.stringify({ code: toolCode, qty }),
    });
    return {
      success: true,
      row: ins.rows[0].id,
      item: {
        date: rowDate,
        code: toolCode,
        name: toolName,
        image: imageUrl,
        damagedBy: personCode,
        count: qty,
        remark,
      },
    };
  }

  if (action === "getReceiving") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const r = await query(`SELECT * FROM receiving ORDER BY id DESC LIMIT 200`);
    return {
      items: r.rows.map((row) => ({
        timestamp: row.created_at,
        code: row.code,
        description: row.description,
        supplier: row.supplier,
        invoice: row.invoice,
        po: row.po,
        cost: row.cost,
        warranty: row.warranty,
        byUser: row.by_user,
        qty: Number(row.qty) || 1,
      })),
    };
  }

  if (action === "receiveItem") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const code = String(params.code || "").trim().toUpperCase();
    const description = String(params.description || "").trim();
    if (!code) return { error: "Code required" };
    if (!description) return { error: "Description required" };
    const kind =
      code.startsWith("C") || code.startsWith("B")
        ? "consumable"
        : code.startsWith("P")
          ? "person"
          : "tool";
    await query(
      `INSERT INTO catalog (code, description, kind, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, kind = EXCLUDED.kind, updated_at = NOW()`,
      [code, description, kind]
    );
    await query(
      `INSERT INTO receiving (code, description, supplier, invoice, po, cost, warranty, qty, by_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        code,
        description,
        params.supplier || "",
        params.invoice || "",
        params.po || params.purchaseOrder || "",
        params.cost || "",
        params.warranty || "",
        Number(params.qty || 1) || 1,
        params.user || auth.user.username,
      ]
    );
    await query(
      `INSERT INTO tool_lifecycle (code, state, note, by_user) VALUES ($1,'Active','Received',$2)`,
      [code, params.user || auth.user.username]
    );
    await appendAudit({
      username: auth.user.username,
      role: auth.user.role,
      action: "RECEIVE_ITEM",
      after: JSON.stringify({ code, description }),
    });
    return { success: true, code, description };
  }

  if (action === "createStoreRequest") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const items = String(params.items || "").trim();
    if (!items) return { error: "Items required" };
    await query(
      `INSERT INTO store_requests (by_user, role, items, note, status)
       VALUES ($1,$2,$3,$4,'Open')`,
      [params.user || auth.user.username, normalizeRole(params.role || auth.user.role), items, params.note || ""]
    );
    return { success: true };
  }

  if (action === "getStoreRequests") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const r = await query(`SELECT * FROM store_requests ORDER BY id DESC LIMIT 80`);
    return {
      items: r.rows.map((row) => ({
        timestamp: row.created_at,
        byUser: row.by_user,
        role: row.role,
        items: row.items,
        note: row.note,
        status: row.status,
      })),
    };
  }

  if (action === "setProductImage") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const code = String(params.code || "").trim().toUpperCase();
    const imageBase64 = params.imageBase64 || params.image || "";
    if (!code) return { error: "Code required" };
    if (!imageBase64) return { error: "Image required" };
    const imageUrl = saveDataUrl(imageBase64, "product_" + code.replace(/[^\w-]/g, "_"));
    await query(
      `INSERT INTO product_photos (code, image_url, by_user, updated_at)
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT (code) DO UPDATE SET image_url = EXCLUDED.image_url, by_user = EXCLUDED.by_user, updated_at = NOW()`,
      [code, imageUrl, params.user || auth.user.username]
    );
    return { success: true, code, image: imageUrl };
  }

  if (action === "getProductImages") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const only = String(params.code || "").trim().toUpperCase();
    if (only) {
      const r = await query(`SELECT code, image_url FROM product_photos WHERE code = $1`, [only]);
      const images = {};
      if (r.rows[0]) images[r.rows[0].code] = r.rows[0].image_url;
      return { images, image: images[only] || "" };
    }
    const r = await query(`SELECT code, image_url FROM product_photos ORDER BY code`);
    const images = {};
    r.rows.forEach((row) => {
      images[row.code] = row.image_url;
    });
    return { images };
  }

  if (action === "setLifecycle") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const code = String(params.code || "").trim().toUpperCase();
    const state = String(params.state || "").trim();
    const allowed = ["Active", "Under Repair", "Awaiting Parts", "Scrap", "Returned"];
    if (!code) return { error: "Code required" };
    if (!allowed.includes(state)) return { error: "Invalid state" };
    await query(
      `INSERT INTO tool_lifecycle (code, state, note, by_user) VALUES ($1,$2,$3,$4)`,
      [code, state, params.note || "", params.user || auth.user.username]
    );
    return { success: true, code, state };
  }

  if (action === "getLifecycle") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const filter = String(params.code || "").trim().toUpperCase();
    const r = await query(`SELECT * FROM tool_lifecycle ORDER BY id ASC`);
    const latest = {};
    r.rows.forEach((row) => {
      latest[row.code] = {
        code: row.code,
        state: row.state,
        updatedAt: row.created_at,
        note: row.note,
        byUser: row.by_user,
      };
    });
    let items = Object.values(latest);
    if (filter) items = items.filter((i) => i.code === filter);
    return { items };
  }

  if (action === "searchAll") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const q = String(params.q || "").trim().toUpperCase();
    if (!q) return { items: [] };
    const r = await query(
      `SELECT tool_code, row_date, scanned_at
       FROM scans
       WHERE UPPER(tool_code) LIKE $1 OR UPPER(row_date) LIKE $1
       ORDER BY id DESC LIMIT 80`,
      [`%${q}%`]
    );
    return {
      q,
      items: r.rows.map((row) => {
        const code = row.tool_code;
        return {
          type: code.charAt(0) === "P" ? "person" : code === "IN" || code === "OUT" ? "direction" : "tool",
          code,
          timestamp: row.scanned_at,
          rowDate: row.row_date,
        };
      }),
    };
  }

  if (action === "auditLog") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    await appendAudit({
      username: params.user || auth.user.username,
      role: params.role || auth.user.role,
      action: params.auditAction || params.event || "CLIENT_EVENT",
      before: params.before || "",
      after: params.after || "",
      detail: params.detail || "",
      device: params.device || "",
    });
    return { success: true, ok: true };
  }

  if (action === "getAuditLog") {
    const auth = await requireAuth(params);
    if (auth.error) return auth;
    const r = await query(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 200`);
    return {
      items: r.rows.map((row) => ({
        timestamp: row.created_at,
        user: row.username,
        role: row.role,
        action: row.action,
        before: row.before_state,
        after: row.after_state,
        detail: row.detail,
        device: row.device,
      })),
    };
  }

  return { error: "NO ACTION SPECIFIED" };
}

async function dispatch(req, res) {
  try {
    const params = mergeParams(req);
    const result = await handle(params);
    res.type("application/json").send(JSON.stringify(result));
  } catch (e) {
    console.error(e);
    res.status(500).type("application/json").send(JSON.stringify({ error: e.message || "SERVER_ERROR" }));
  }
}

app.get("/", dispatch);
app.post("/", dispatch);
app.get("/api", dispatch);
app.post("/api", dispatch);
app.get("/api/exec", dispatch);
app.post("/api/exec", dispatch);

app.get("/health", (_req, res) => res.json({ ok: true, service: "toolcustody-api" }));

app.listen(PORT, () => {
  console.log(`ToolCustody API on :${PORT}`);
});
