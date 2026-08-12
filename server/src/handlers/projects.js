const U = require("../lib/util");
const stock = require("../lib/stock");

const MANAGE = ["projects.manage"];
const VIEW = ["projects.view", "projects.manage", "projects.dispatch", "projects.return"];

/**
 * Rebuild project_stock from the dispatch ledger.
 * Historical dispatches may exist while project_stock was wiped or never updated.
 */
async function rebuildProjectStockFromDispatches(query) {
  await query(`DELETE FROM project_stock`);
  await query(
    `INSERT INTO project_stock (project_id, code, qty, updated_at)
     SELECT d.project_id,
            UPPER(l.code),
            SUM(CASE WHEN d.type = 'out' THEN l.qty_sent ELSE -l.qty_sent END),
            NOW()
       FROM project_dispatch_lines l
       JOIN project_dispatches d ON d.id = l.dispatch_id
      GROUP BY d.project_id, UPPER(l.code)
     HAVING SUM(CASE WHEN d.type = 'out' THEN l.qty_sent ELSE -l.qty_sent END) > 0`
  );
}

async function ensureProjectStock(query) {
  try {
    const [stockRows, dispatchRows] = await Promise.all([
      query(`SELECT COALESCE(SUM(qty),0)::numeric AS qty FROM project_stock`),
      query(
        `SELECT COALESCE(SUM(CASE WHEN d.type = 'out' THEN l.qty_sent ELSE -l.qty_sent END),0)::numeric AS qty
           FROM project_dispatch_lines l
           JOIN project_dispatches d ON d.id = l.dispatch_id`
      ),
    ]);
    const have = U.num(stockRows.rows[0].qty, 0);
    const expect = U.num(dispatchRows.rows[0].qty, 0);
    if (expect > 0 && have !== expect) {
      console.warn(`[projects] rebuilding project_stock (have=${have}, expect=${expect})`);
      await rebuildProjectStockFromDispatches(query);
    }
  } catch (e) {
    console.warn("[projects] ensureProjectStock:", (e && e.message) || e);
  }
}

function projectView(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name || "",
    site: row.site || "",
    client: row.client || "",
    status: row.status || "active",
    notes: row.notes || "",
    createdBy: row.created_by || "",
    createdAt: U.isoOrNull(row.created_at),
    updatedAt: U.isoOrNull(row.updated_at),
  };
}

function dispatchView(row) {
  return {
    id: row.id,
    formNo: row.form_no,
    projectId: row.project_id,
    projectCode: row.project_code || "",
    projectName: row.project_name || "",
    projectSite: row.project_site || "",
    type: row.type || "out",
    status: row.status || "issued",
    recipientName: row.recipient_name || "",
    recipientPhone: row.recipient_phone || "",
    recipientResidenceNo: row.recipient_residence_no || "",
    vehiclePlate: row.vehicle_plate || "",
    expectedReturnDate: row.expected_return_date
      ? U.isoDateOnly(row.expected_return_date) || String(row.expected_return_date).slice(0, 10)
      : "",
    logisticsName: row.logistics_name || "",
    storeManagerName: row.store_manager_name || "",
    notes: row.notes || "",
    byUser: row.issued_by || row.by_user || "",
    issuedAt: U.isoOrNull(row.issued_at),
    totalQty: row.total_qty != null ? U.num(row.total_qty, 0) : null,
  };
}

/** Production schema uses qty_sent / qty_returned (not qty) and issued_by (not by_user). */
const DISPATCH_SELECT = `
  SELECT d.*, p.code AS project_code, p.name AS project_name, p.site AS project_site,
         COALESCE(l.qty, 0) AS total_qty
    FROM project_dispatches d
    JOIN projects p ON p.id = d.project_id
    LEFT JOIN (
      SELECT dispatch_id, SUM(qty_sent)::numeric AS qty
        FROM project_dispatch_lines
       GROUP BY dispatch_id
    ) l ON l.dispatch_id = d.id`;

async function listProjects(ctx) {
  ctx.requireAny(VIEW.concat(["inventory.count", "inventory.view"]));
  const statusFilter = U.trimmed(ctx.params.status);
  const r = await ctx.query(
    `SELECT p.*,
            COALESCE(s.qty, 0)  AS tools_qty,
            COALESCE(d.n, 0)    AS dispatch_count,
            d.last_at           AS last_dispatch_at
       FROM projects p
       LEFT JOIN (
         SELECT project_id, SUM(qty)::numeric AS qty FROM project_stock WHERE qty > 0 GROUP BY project_id
       ) s ON s.project_id = p.id
       LEFT JOIN (
         SELECT project_id, COUNT(*)::int AS n, MAX(issued_at) AS last_at
           FROM project_dispatches GROUP BY project_id
       ) d ON d.project_id = p.id
      ORDER BY p.code ASC`
  );

  let items = r.rows.map((row) => ({
    ...projectView(row),
    toolsQty: U.num(row.tools_qty, 0),
    dispatchCount: U.int(row.dispatch_count, 0),
    lastDispatchAt: U.isoOrNull(row.last_dispatch_at),
  }));
  if (statusFilter) items = items.filter((p) => p.status === statusFilter);

  return {
    items,
    totals: {
      projects: items.length,
      active: items.filter((p) => p.status === "active").length,
      toolsAtProjects: items.reduce((s, p) => s + p.toolsQty, 0),
      projectsWithStock: items.filter((p) => p.toolsQty > 0).length,
    },
  };
}

async function getProject(ctx) {
  ctx.requireAny(VIEW);
  const id = U.int(ctx.params.id, 0);
  const code = U.trimmed(ctx.params.code);
  if (!id && !code) return { success: false, error: "ID_REQUIRED" };

  const r = id
    ? await ctx.query(`SELECT * FROM projects WHERE id = $1`, [id])
    : await ctx.query(`SELECT * FROM projects WHERE UPPER(code) = UPPER($1)`, [code]);
  if (!r.rows.length) return { success: false, error: "NOT_FOUND" };
  const project = projectView(r.rows[0]);

  const [holdings, dispatches] = await Promise.all([
    ctx.query(
      `SELECT ps.code, ps.qty, ps.updated_at,
              COALESCE(c.description, ps.code) AS description,
              COALESCE(ph.image_url, '') AS image_url
         FROM project_stock ps
         LEFT JOIN catalog c ON c.code = ps.code
         LEFT JOIN product_photos ph ON ph.code = ps.code
        WHERE ps.project_id = $1 AND ps.qty > 0
        ORDER BY ps.code ASC`,
      [project.id]
    ),
    ctx.query(`${DISPATCH_SELECT} WHERE d.project_id = $1 ORDER BY d.id DESC`, [project.id]),
  ]);

  return {
    success: true,
    item: project,
    project,
    holdings: holdings.rows.map((h) => ({
      code: U.upper(h.code),
      description: h.description || "",
      imageUrl: h.image_url || "",
      qty: U.num(h.qty, 0),
      updatedAt: U.isoOrNull(h.updated_at),
    })),
    dispatches: dispatches.rows.map(dispatchView),
  };
}

async function upsertProject(ctx) {
  ctx.require("projects.manage");
  const { params, query } = ctx;
  const id = U.int(params.id, 0);
  const name = U.trimmed(params.name);
  if (!name) return { success: false, error: "NAME_REQUIRED" };

  let code = U.upper(params.code);
  if (!code) {
    const next = await query(`SELECT COALESCE(MAX(id),0) + 1 AS n FROM projects`);
    code = `PRJ${String(next.rows[0].n).padStart(3, "0")}`;
  }

  const status = U.trimmed(params.status) === "closed" ? "closed" : "active";
  const dup = await query(`SELECT id FROM projects WHERE UPPER(code) = UPPER($1) AND id <> $2`, [
    code,
    id,
  ]);
  if (dup.rows.length) return { success: false, error: "CODE_EXISTS" };

  if (id) {
    const r = await query(
      `UPDATE projects SET code = $1, name = $2, site = $3, client = $4, status = $5,
              notes = $6, updated_at = NOW()
        WHERE id = $7 RETURNING *`,
      [code, name, U.trimmed(params.site), U.trimmed(params.client), status, U.trimmed(params.notes), id]
    );
    if (!r.rows.length) return { success: false, error: "NOT_FOUND" };
    await ctx.audit({ action: "PROJECT_UPDATE", after: JSON.stringify({ id, code, name }) });
    return { success: true, item: projectView(r.rows[0]) };
  }

  const r = await query(
    `INSERT INTO projects (code, name, site, client, status, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      code,
      name,
      U.trimmed(params.site),
      U.trimmed(params.client),
      status,
      U.trimmed(params.notes),
      ctx.user.username,
    ]
  );
  await ctx.audit({ action: "PROJECT_CREATE", after: JSON.stringify({ code, name }) });
  return { success: true, item: projectView(r.rows[0]) };
}

async function deleteProject(ctx) {
  ctx.require("projects.manage");
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const onSite = await ctx.query(
    `SELECT COALESCE(SUM(qty),0)::numeric AS qty FROM project_stock WHERE project_id = $1`,
    [id]
  );
  const qty = U.num(onSite.rows[0].qty, 0);
  if (qty > 0) return { success: false, error: "PROJECT_HAS_STOCK", onSite: qty };

  const del = await ctx.query(`DELETE FROM projects WHERE id = $1 RETURNING id`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  await ctx.audit({ action: "PROJECT_DELETE", before: JSON.stringify({ id }) });
  return { success: true, id };
}

/* ------------------------------------------------------------ dispatch */

function readLines(params) {
  return U.asArray(params.lines)
    .map((l) => ({
      id: U.int(l && l.id, 0) || null,
      code: U.upper(l && l.code),
      description: U.trimmed(l && l.description),
      qty: U.num((l && l.qty) != null ? l.qty : l && l.qtySent, 0),
      condition: U.trimmed(l && l.condition) || "Good",
      notes: U.trimmed(l && l.notes) || U.trimmed(l && l.condition) || "Good",
    }))
    .filter((l) => l.code && l.qty > 0);
}

function lineView(l) {
  const qty = U.num(l.qty_sent != null ? l.qty_sent : l.qty, 0);
  return {
    id: l.id,
    code: U.upper(l.code),
    description: l.description || "",
    qty,
    qtySent: qty,
    qtyReturned: U.num(l.qty_returned, 0),
    condition: l.condition || l.notes || "Good",
    notes: l.notes || "",
    imageUrl: l.image_url || l.imageUrl || "",
  };
}

async function loadDispatch(query, id) {
  const r = await query(`${DISPATCH_SELECT} WHERE d.id = $1`, [id]);
  if (!r.rows.length) return null;
  const lines = await query(
    `SELECT l.*, COALESCE(ph.image_url, '') AS image_url
       FROM project_dispatch_lines l
       LEFT JOIN product_photos ph ON UPPER(ph.code) = UPPER(l.code)
      WHERE l.dispatch_id = $1
      ORDER BY l.id ASC`,
    [id]
  );
  return {
    ...dispatchView(r.rows[0]),
    lines: lines.rows.map(lineView),
  };
}

async function getProjectDispatch(ctx) {
  ctx.requireAny(VIEW);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const dispatch = await loadDispatch(ctx.query, id);
  if (!dispatch) return { success: false, error: "NOT_FOUND" };
  return { success: true, dispatch };
}

/**
 * `out`    warehouse → project site
 * `return` project site → warehouse
 */
async function writeDispatch(ctx, type) {
  const { params, query } = ctx;
  const projectId = U.int(params.projectId, 0);
  const recipientName = U.trimmed(params.recipientName);
  const lines = readLines(params);

  if (!projectId) return { success: false, error: "PROJECT_REQUIRED" };
  if (!recipientName) return { success: false, error: "RECIPIENT_REQUIRED" };
  if (!lines.length) return { success: false, error: "NO_LINES" };

  const project = await query(`SELECT id FROM projects WHERE id = $1`, [projectId]);
  if (!project.rows.length) return { success: false, error: "PROJECT_NOT_FOUND" };

  const warehouseId = await stock.mainWarehouseId(query);
  if (!warehouseId) return { success: false, error: "NO_WAREHOUSE" };

  for (const line of lines) {
    if (type === "out") {
      const have = await stock.warehouseQty(query, warehouseId, line.code);
      if (have < line.qty) {
        return { success: false, error: "INSUFFICIENT_STOCK", code: line.code, available: have };
      }
    } else {
      const have = await stock.projectQty(query, projectId, line.code);
      if (have < line.qty) {
        return { success: false, error: "INSUFFICIENT_STOCK", code: line.code, available: have };
      }
    }
  }

  const descRows = await query(
    `SELECT code, description FROM catalog WHERE code = ANY($1::text[])`,
    [lines.map((l) => l.code)]
  );
  const descOf = new Map(descRows.rows.map((r) => [U.upper(r.code), r.description || ""]));
  const expectedReturn = U.trimmed(params.expectedReturnDate) || null;

  try {
    await query("BEGIN");
    const head = await query(
      `INSERT INTO project_dispatches (
         form_no, project_id, type, status, recipient_name, recipient_phone,
         recipient_residence_no, vehicle_plate, expected_return_date,
         logistics_name, store_manager_name, notes, issued_by
       ) VALUES ($1,$2,$3,'issued',$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, issued_at`,
      [
        `TMP-${Date.now()}`,
        projectId,
        type,
        recipientName,
        U.trimmed(params.recipientPhone),
        U.trimmed(params.recipientResidenceNo),
        U.trimmed(params.vehiclePlate),
        expectedReturn,
        U.trimmed(params.logisticsName),
        U.trimmed(params.storeManagerName),
        U.trimmed(params.notes),
        ctx.user.username,
      ]
    );
    const id = head.rows[0].id;
    const no = U.formNo(type === "return" ? "PRT" : "PDN", id, new Date(head.rows[0].issued_at));
    await query(`UPDATE project_dispatches SET form_no = $1 WHERE id = $2`, [no, id]);

    for (const line of lines) {
      await query(
        `INSERT INTO project_dispatch_lines (dispatch_id, code, description, qty_sent, qty_returned, notes)
         VALUES ($1,$2,$3,$4,0,$5)`,
        [
          id,
          line.code,
          line.description || descOf.get(line.code) || "",
          line.qty,
          line.notes || line.condition || "Good",
        ]
      );
      const sign = type === "out" ? 1 : -1;
      await stock.addProjectStock(query, projectId, line.code, sign * line.qty);
      await stock.addWarehouseStock(query, warehouseId, line.code, -sign * line.qty);
    }
    await query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [projectId]);
    await query("COMMIT");

    await ctx.audit({
      action: type === "return" ? "PROJECT_RETURN" : "PROJECT_DISPATCH",
      after: JSON.stringify({ formNo: no, projectId, lines: lines.length }),
    });
    return { success: true, dispatch: await loadDispatch(query, id), projectId, formNo: no };
  } catch (e) {
    await query("ROLLBACK").catch(() => {});
    return { success: false, error: (e && e.message) || "DISPATCH_FAILED" };
  }
}

async function createProjectDispatch(ctx) {
  ctx.require("projects.dispatch");
  return writeDispatch(ctx, "out");
}

async function returnProjectTools(ctx) {
  ctx.requireAny(["projects.return", "projects.dispatch"]);
  return writeDispatch(ctx, "return");
}

/** Editing an invoice reverses its stock effect, then re-applies the new lines. */
async function updateProjectDispatch(ctx) {
  ctx.requireAny(["projects.dispatch", "projects.return", "projects.manage"]);
  const { params, query } = ctx;
  const id = U.int(params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };

  const existing = await loadDispatch(query, id);
  if (!existing) return { success: false, error: "NOT_FOUND" };

  const lines = readLines(params);
  if (!lines.length) return { success: false, error: "NO_LINES" };

  const warehouseId = await stock.mainWarehouseId(query);
  const projectId = existing.projectId;
  const sign = existing.type === "return" ? -1 : 1;

  const oldQty = new Map(existing.lines.map((l) => [l.code, l.qty]));
  const newQty = new Map(lines.map((l) => [l.code, l.qty]));
  const codes = U.uniq([...oldQty.keys(), ...newQty.keys()]);

  for (const code of codes) {
    const delta = (newQty.get(code) || 0) - (oldQty.get(code) || 0);
    if (!delta) continue;
    if (sign * delta > 0) {
      const have = await stock.warehouseQty(query, warehouseId, code);
      if (have < sign * delta) {
        return { success: false, error: "INSUFFICIENT_STOCK", code, available: have };
      }
    } else {
      const have = await stock.projectQty(query, projectId, code);
      if (have < -sign * delta) {
        return { success: false, error: "INSUFFICIENT_STOCK", code, available: have };
      }
    }
  }

  try {
    await query("BEGIN");
    await query(`DELETE FROM project_dispatch_lines WHERE dispatch_id = $1`, [id]);
    for (const line of lines) {
      await query(
        `INSERT INTO project_dispatch_lines (dispatch_id, code, description, qty_sent, qty_returned, notes)
         VALUES ($1,$2,$3,$4,0,$5)`,
        [id, line.code, line.description, line.qty, line.notes || line.condition || "Good"]
      );
    }
    for (const code of codes) {
      const delta = (newQty.get(code) || 0) - (oldQty.get(code) || 0);
      if (!delta) continue;
      await stock.addProjectStock(query, projectId, code, sign * delta);
      await stock.addWarehouseStock(query, warehouseId, code, -sign * delta);
    }
    await query(
      `UPDATE project_dispatches
          SET recipient_name = $1, recipient_phone = $2, recipient_residence_no = $3,
              vehicle_plate = $4, notes = $5
        WHERE id = $6`,
      [
        U.trimmed(params.recipientName) || existing.recipientName,
        U.trimmed(params.recipientPhone),
        U.trimmed(params.recipientResidenceNo),
        U.trimmed(params.vehiclePlate),
        U.trimmed(params.notes),
        id,
      ]
    );
    await query("COMMIT");
  } catch (e) {
    await query("ROLLBACK").catch(() => {});
    return { success: false, error: (e && e.message) || "UPDATE_FAILED" };
  }

  await ctx.audit({ action: "PROJECT_DISPATCH_UPDATE", after: JSON.stringify({ id }) });
  return { success: true, dispatch: await loadDispatch(query, id), projectId };
}

async function deleteProjectDispatch(ctx) {
  ctx.requireAny(["projects.dispatch", "projects.manage"]);
  const { query } = ctx;
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };

  const existing = await loadDispatch(query, id);
  if (!existing) return { success: false, error: "NOT_FOUND" };

  const warehouseId = await stock.mainWarehouseId(query);
  const sign = existing.type === "return" ? -1 : 1;

  for (const line of existing.lines) {
    if (sign > 0) {
      const have = await stock.projectQty(query, existing.projectId, line.code);
      if (have < line.qty) {
        return { success: false, error: "DISPATCH_HAS_RETURNS", code: line.code, available: have };
      }
    } else {
      const have = await stock.warehouseQty(query, warehouseId, line.code);
      if (have < line.qty) {
        return { success: false, error: "DISPATCH_HAS_RETURNS", code: line.code, available: have };
      }
    }
  }

  try {
    await query("BEGIN");
    for (const line of existing.lines) {
      await stock.addProjectStock(query, existing.projectId, line.code, -sign * line.qty);
      await stock.addWarehouseStock(query, warehouseId, line.code, sign * line.qty);
    }
    await query(`DELETE FROM project_dispatches WHERE id = $1`, [id]);
    await query("COMMIT");
  } catch (e) {
    await query("ROLLBACK").catch(() => {});
    return { success: false, error: (e && e.message) || "DELETE_FAILED" };
  }

  await ctx.audit({
    action: "PROJECT_DISPATCH_DELETE",
    before: JSON.stringify({ id, formNo: existing.formNo }),
  });
  return { success: true, id, projectId: existing.projectId };
}

module.exports = {
  listProjects,
  getProject,
  upsertProject,
  deleteProject,
  getProjectDispatch,
  createProjectDispatch,
  returnProjectTools,
  updateProjectDispatch,
  deleteProjectDispatch,
  rebuildProjectStockFromDispatches,
  ensureProjectStock,
};
