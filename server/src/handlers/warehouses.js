const U = require("../lib/util");
const stock = require("../lib/stock");

function warehouseView(row) {
  return {
    id: row.id,
    name: row.name,
    isMain: row.is_main === true,
    createdAt: U.isoOrNull(row.created_at),
  };
}

async function listWarehouses(ctx) {
  ctx.requireAny([
    "inventory.view",
    "inventory.count",
    "inventory.transfer",
    "tool.receive",
    "projects.manage",
    "projects.dispatch",
  ]);
  const r = await ctx.query(
    `SELECT w.*, COALESCE(s.qty, 0) AS total_qty, COALESCE(s.lines, 0) AS lines
       FROM warehouses w
       LEFT JOIN (
         SELECT warehouse_id, SUM(qty)::numeric AS qty, COUNT(*)::int AS lines
           FROM warehouse_stock GROUP BY warehouse_id
       ) s ON s.warehouse_id = w.id
      ORDER BY w.is_main DESC, w.name ASC`
  );
  return {
    items: r.rows.map((row) => ({
      ...warehouseView(row),
      totalQty: U.num(row.total_qty, 0),
      lines: U.int(row.lines, 0),
    })),
  };
}

async function createWarehouse(ctx) {
  ctx.requireAny(["inventory.transfer", "inventory.adjust", "settings.manage"]);
  const name = U.trimmed(ctx.params.name);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  const existing = await ctx.query(`SELECT id FROM warehouses WHERE LOWER(name) = LOWER($1)`, [name]);
  if (existing.rows.length) return { success: false, error: "NAME_TAKEN" };
  const any = await ctx.query(`SELECT COUNT(*)::int AS n FROM warehouses`);
  const r = await ctx.query(
    `INSERT INTO warehouses (name, is_main) VALUES ($1,$2) RETURNING *`,
    [name, any.rows[0].n === 0]
  );
  await ctx.audit({ action: "WAREHOUSE_CREATE", after: JSON.stringify({ name }) });
  return { success: true, item: warehouseView(r.rows[0]) };
}

async function deleteWarehouse(ctx) {
  ctx.requireAny(["inventory.transfer", "inventory.adjust", "settings.manage"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const wh = await ctx.query(`SELECT * FROM warehouses WHERE id = $1`, [id]);
  if (!wh.rows.length) return { success: false, error: "NOT_FOUND" };
  if (wh.rows[0].is_main) return { success: false, error: "CANNOT_DELETE_MAIN" };
  const used = await ctx.query(
    `SELECT COALESCE(SUM(qty),0)::numeric AS qty FROM warehouse_stock WHERE warehouse_id = $1`,
    [id]
  );
  if (U.num(used.rows[0].qty, 0) > 0) {
    return { success: false, error: "WAREHOUSE_HAS_STOCK", qty: U.num(used.rows[0].qty, 0) };
  }
  await ctx.query(`DELETE FROM warehouses WHERE id = $1`, [id]);
  await ctx.audit({ action: "WAREHOUSE_DELETE", before: JSON.stringify({ id }) });
  return { success: true, id };
}

async function listWarehouseStock(ctx) {
  ctx.requireAny(["inventory.view", "inventory.count", "inventory.transfer", "projects.dispatch"]);
  const warehouseId = U.int(ctx.params.warehouseId, 0);
  const args = [];
  let where = "";
  if (warehouseId) {
    args.push(warehouseId);
    where = `WHERE ws.warehouse_id = $1`;
  }
  const r = await ctx.query(
    `SELECT ws.warehouse_id, ws.code, ws.qty, ws.updated_at,
            COALESCE(c.description, ws.code) AS description,
            COALESCE(c.category, '') AS category,
            COALESCE(c.subcategory, '') AS subcategory,
            COALESCE(p.image_url, '') AS image_url
       FROM warehouse_stock ws
       LEFT JOIN catalog c ON c.code = ws.code
       LEFT JOIN product_photos p ON p.code = ws.code
       ${where}
      ORDER BY ws.code ASC`,
    args
  );
  const items = r.rows
    .map((row) => ({
      warehouseId: row.warehouse_id,
      code: U.upper(row.code),
      description: row.description || row.code,
      category: row.category || "",
      subcategory: row.subcategory || "",
      imageUrl: row.image_url || "",
      qty: U.num(row.qty, 0),
      updatedAt: U.isoOrNull(row.updated_at),
    }))
    .filter((i) => i.qty !== 0);
  return {
    warehouseId: warehouseId || null,
    items,
    totals: { lines: items.length, qty: items.reduce((s, i) => s + i.qty, 0) },
  };
}

/* ------------------------------------------------------------ transfers */

function transferHeader(row) {
  return {
    id: row.id,
    formNo: row.form_no,
    fromWarehouseId: row.from_warehouse_id,
    toWarehouseId: row.to_warehouse_id,
    fromWarehouse: row.from_name || "",
    toWarehouse: row.to_name || "",
    note: row.note || "",
    byUser: row.by_user || "",
    createdAt: U.isoOrNull(row.created_at),
    totalQty: U.num(row.total_qty, 0),
    lineCount: U.int(row.line_count, 0),
  };
}

const TRANSFER_SELECT = `
  SELECT t.*, f.name AS from_name, tw.name AS to_name,
         COALESCE(l.qty, 0) AS total_qty, COALESCE(l.n, 0) AS line_count
    FROM warehouse_transfers t
    LEFT JOIN warehouses f  ON f.id = t.from_warehouse_id
    LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
    LEFT JOIN (
      SELECT transfer_id, SUM(qty)::numeric AS qty, COUNT(*)::int AS n
        FROM warehouse_transfer_lines GROUP BY transfer_id
    ) l ON l.transfer_id = t.id`;

async function listWarehouseTransfers(ctx) {
  ctx.requireAny(["inventory.view", "inventory.transfer"]);
  const limit = Math.min(500, U.posInt(ctx.params.limit, 100));
  const r = await ctx.query(`${TRANSFER_SELECT} ORDER BY t.id DESC LIMIT $1`, [limit]);
  return { items: r.rows.map(transferHeader) };
}

async function loadTransfer(query, id) {
  const r = await query(`${TRANSFER_SELECT} WHERE t.id = $1`, [id]);
  if (!r.rows.length) return null;
  const lines = await query(
    `SELECT * FROM warehouse_transfer_lines WHERE transfer_id = $1 ORDER BY id ASC`,
    [id]
  );
  return {
    ...transferHeader(r.rows[0]),
    lines: lines.rows.map((l) => ({
      id: l.id,
      code: U.upper(l.code),
      description: l.description || "",
      qty: U.num(l.qty, 0),
    })),
  };
}

async function getWarehouseTransfer(ctx) {
  ctx.requireAny(["inventory.view", "inventory.transfer"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const transfer = await loadTransfer(ctx.query, id);
  if (!transfer) return { success: false, error: "NOT_FOUND" };
  return { success: true, transfer };
}

async function createWarehouseTransfer(ctx) {
  ctx.require("inventory.transfer");
  const { params, query } = ctx;
  const fromId = U.int(params.fromWarehouseId, 0);
  const toId = U.int(params.toWarehouseId, 0);
  const lines = U.asArray(params.lines)
    .map((l) => ({ code: U.upper(l && l.code), qty: U.num(l && l.qty, 0) }))
    .filter((l) => l.code && l.qty > 0);

  if (!fromId || !toId) return { success: false, error: "WAREHOUSE_REQUIRED" };
  if (fromId === toId) return { success: false, error: "SAME_WAREHOUSE" };
  if (!lines.length) return { success: false, error: "NO_LINES" };

  for (const line of lines) {
    const have = await stock.warehouseQty(query, fromId, line.code);
    if (have < line.qty) {
      return { success: false, error: "INSUFFICIENT_STOCK", code: line.code, available: have };
    }
  }

  const descRows = await query(
    `SELECT code, description FROM catalog WHERE code = ANY($1::text[])`,
    [lines.map((l) => l.code)]
  );
  const descOf = new Map(descRows.rows.map((r) => [U.upper(r.code), r.description || ""]));

  try {
    await query("BEGIN");
    const head = await query(
      `INSERT INTO warehouse_transfers (from_warehouse_id, to_warehouse_id, note, by_user)
       VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
      [fromId, toId, U.trimmed(params.note), ctx.user.username]
    );
    const id = head.rows[0].id;
    const no = U.formNo("TR", id, new Date(head.rows[0].created_at));
    await query(`UPDATE warehouse_transfers SET form_no = $1 WHERE id = $2`, [no, id]);

    for (const line of lines) {
      await query(
        `INSERT INTO warehouse_transfer_lines (transfer_id, code, description, qty)
         VALUES ($1,$2,$3,$4)`,
        [id, line.code, descOf.get(line.code) || "", line.qty]
      );
      await stock.addWarehouseStock(query, fromId, line.code, -line.qty);
      await stock.addWarehouseStock(query, toId, line.code, line.qty);
    }
    await query("COMMIT");

    await ctx.audit({
      action: "WAREHOUSE_TRANSFER",
      after: JSON.stringify({ formNo: no, fromId, toId, lines: lines.length }),
    });
    return { success: true, transfer: await loadTransfer(query, id) };
  } catch (e) {
    await query("ROLLBACK").catch(() => {});
    return { success: false, error: (e && e.message) || "TRANSFER_FAILED" };
  }
}

/* ------------------------------------------------------ inventory count */

async function createInventoryCountSheet(ctx) {
  ctx.require("inventory.count");
  const { params, query } = ctx;
  const locationType = U.trimmed(params.locationType) === "project" ? "project" : "warehouse";
  const countType = U.trimmed(params.countType) || "full";
  const category = U.trimmed(params.category);
  const warehouseId = U.int(params.warehouseId, 0) || null;
  const projectId = U.int(params.projectId, 0) || null;

  if (locationType === "project" && !projectId) return { success: false, error: "PROJECT_REQUIRED" };
  if (locationType === "warehouse" && !warehouseId) return { success: false, error: "WAREHOUSE_REQUIRED" };
  if (countType === "category" && !category) return { success: false, error: "CATEGORY_REQUIRED" };

  const sourceSql =
    locationType === "project"
      ? `SELECT ps.code, ps.qty, COALESCE(c.description,'') AS description, COALESCE(c.category,'') AS category
           FROM project_stock ps LEFT JOIN catalog c ON c.code = ps.code
          WHERE ps.project_id = $1 AND ps.qty > 0`
      : `SELECT ws.code, ws.qty, COALESCE(c.description,'') AS description, COALESCE(c.category,'') AS category
           FROM warehouse_stock ws LEFT JOIN catalog c ON c.code = ws.code
          WHERE ws.warehouse_id = $1 AND ws.qty > 0`;

  const source = await query(sourceSql, [locationType === "project" ? projectId : warehouseId]);
  let rows = source.rows;
  if (countType === "category") rows = rows.filter((r) => r.category === category);
  if (!rows.length) return { success: false, error: "NO_PRODUCTS" };

  const head = await query(
    `INSERT INTO inventory_count_sheets (location_type, warehouse_id, project_id, count_type,
                                         category, by_user)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at`,
    [locationType, warehouseId, projectId, countType, category, ctx.user.username]
  );
  const id = head.rows[0].id;
  const no = U.formNo("IC", id, new Date(head.rows[0].created_at));
  await query(`UPDATE inventory_count_sheets SET form_no = $1 WHERE id = $2`, [no, id]);

  for (const row of rows) {
    await query(
      `INSERT INTO inventory_count_lines (sheet_id, code, description, expected_qty)
       VALUES ($1,$2,$3,$4)`,
      [id, U.upper(row.code), row.description || "", U.num(row.qty, 0)]
    );
  }

  await ctx.audit({
    action: "INVENTORY_COUNT_CREATE",
    after: JSON.stringify({ formNo: no, lines: rows.length }),
  });
  return {
    success: true,
    sheet: {
      id,
      formNo: no,
      locationType,
      warehouseId,
      projectId,
      countType,
      category,
      createdAt: U.isoOrNull(head.rows[0].created_at),
      lines: rows.map((row) => ({
        code: U.upper(row.code),
        description: row.description || "",
        expectedQty: U.num(row.qty, 0),
      })),
    },
  };
}

module.exports = {
  listWarehouses,
  createWarehouse,
  deleteWarehouse,
  listWarehouseStock,
  listWarehouseTransfers,
  getWarehouseTransfer,
  createWarehouseTransfer,
  createInventoryCountSheet,
};
