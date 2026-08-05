const U = require("./util");
const custody = require("../custody");

const QC_DUE_SOON_DAYS = Number(process.env.QC_DUE_SOON_DAYS || 30) || 30;

function qcStatusFor(nextDue, now = Date.now()) {
  if (!nextDue) return { qcStatus: null, qcDaysLeft: null };
  const daysLeft = U.daysUntil(nextDue, now);
  if (daysLeft === null) return { qcStatus: null, qcDaysLeft: null };
  if (daysLeft < 0) return { qcStatus: "Expired", qcDaysLeft: daysLeft };
  if (daysLeft <= QC_DUE_SOON_DAYS) return { qcStatus: "Due soon", qcDaysLeft: daysLeft };
  return { qcStatus: "OK", qcDaysLeft: daysLeft };
}

/**
 * One pass over catalog + physical stock + custody to produce the numbers every
 * inventory screen shares.
 *
 *   warehouseQty  physical units sitting in warehouses (ops / transfers)
 *   received      cumulative received qty
 *   damaged       cumulative damaged qty
 *   out           tools in personal custody
 *   issued        consumables issued from scans
 *   projectOut    units sitting on project sites (shown separately)
 *   available     received − damaged − locked   (locked = out | issued)
 */
async function snapshot(query, ledger) {
  const led = ledger || (await custody.load(query));
  const outMap = custody.outQtyByCode(led);
  const issuedMap = custody.issuedQtyByCode(led);

  const [cat, wh, proj, dmg, rcv] = await Promise.all([
    query(
      `SELECT c.*, COALESCE(p.image_url, '') AS image_url
         FROM catalog c
         LEFT JOIN product_photos p ON p.code = c.code
        WHERE c.kind <> 'person'
        ORDER BY c.code ASC`
    ),
    query(`SELECT code, SUM(qty)::numeric AS qty FROM warehouse_stock GROUP BY code`),
    query(`SELECT code, SUM(qty)::numeric AS qty FROM project_stock GROUP BY code`),
    query(`SELECT tool_code AS code, SUM(qty)::numeric AS qty FROM damage GROUP BY tool_code`),
    query(`SELECT code, SUM(qty)::numeric AS qty, MAX(created_at) AS last_at FROM receiving GROUP BY code`),
  ]);

  const whMap = new Map(wh.rows.map((r) => [U.upper(r.code), U.num(r.qty)]));
  const projMap = new Map(proj.rows.map((r) => [U.upper(r.code), U.num(r.qty)]));
  const dmgMap = new Map(dmg.rows.map((r) => [U.upper(r.code), U.num(r.qty)]));
  const rcvMap = new Map(rcv.rows.map((r) => [U.upper(r.code), { qty: U.num(r.qty), lastAt: r.last_at }]));

  const now = Date.now();
  const items = new Map();

  for (const row of cat.rows) {
    const code = U.upper(row.code);
    const isConsumable = row.kind === "consumable" || U.isConsumableCode(code);
    const out = isConsumable ? 0 : U.num(outMap.get(code), 0);
    const issued = isConsumable ? U.num(issuedMap.get(code), 0) : 0;
    const warehouseQty = U.num(whMap.get(code), 0);
    const projectOut = U.num(projMap.get(code), 0);
    const damaged = U.num(dmgMap.get(code), 0);
    const received = rcvMap.get(code) ? rcvMap.get(code).qty : 0;
    const lastReceivedAt = rcvMap.get(code) ? rcvMap.get(code).lastAt : null;
    const locked = isConsumable ? issued : out;
    const available = received - damaged - locked;
    const minStock = U.num(row.min_stock, 0);
    const qc = qcStatusFor(row.calibration_next_due, now);

    items.set(code, {
      code,
      description: row.description || code,
      kind: isConsumable ? "consumable" : row.kind || "tool",
      category: row.category || "",
      subcategory: row.subcategory || "",
      item: row.item || "",
      unit: row.unit || "pcs",
      price: U.num(row.price, 0),
      minStock,
      serialized: row.serialized === true,
      calibrationRequired: row.calibration_required === true,
      calibrationLastDone: row.calibration_last_done ? U.isoDateOnly(row.calibration_last_done) : "",
      calibrationNextDue: row.calibration_next_due ? U.isoDateOnly(row.calibration_next_due) : "",
      calibrationNotes: row.calibration_notes || "",
      imageUrl: row.image_url || "",
      warehouseQty,
      received,
      lastReceivedAt: U.isoOrNull(lastReceivedAt),
      damaged,
      out,
      issued,
      projectOut,
      available,
      lowStock: minStock > 0 && available <= minStock,
      updatedAt: U.isoOrNull(row.updated_at),
      createdAt: U.isoOrNull(row.created_at),
      ...qc,
    });
  }

  return items;
}

/** Resolves the warehouse that receiving / dispatch defaults to. */
async function mainWarehouseId(query) {
  const r = await query(`SELECT id FROM warehouses ORDER BY is_main DESC, id ASC LIMIT 1`);
  return r.rows[0] ? r.rows[0].id : null;
}

async function warehouseQty(query, warehouseId, code) {
  const r = await query(
    `SELECT qty FROM warehouse_stock WHERE warehouse_id = $1 AND code = $2`,
    [warehouseId, U.upper(code)]
  );
  return r.rows[0] ? U.num(r.rows[0].qty, 0) : 0;
}

async function addWarehouseStock(query, warehouseId, code, delta) {
  if (!warehouseId || !delta) return;
  await query(
    `INSERT INTO warehouse_stock (warehouse_id, code, qty, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (warehouse_id, code)
     DO UPDATE SET qty = warehouse_stock.qty + EXCLUDED.qty, updated_at = NOW()`,
    [warehouseId, U.upper(code), delta]
  );
}

async function setWarehouseStock(query, warehouseId, code, qty) {
  if (!warehouseId) return;
  await query(
    `INSERT INTO warehouse_stock (warehouse_id, code, qty, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (warehouse_id, code)
     DO UPDATE SET qty = EXCLUDED.qty, updated_at = NOW()`,
    [warehouseId, U.upper(code), qty]
  );
}

async function addProjectStock(query, projectId, code, delta) {
  if (!projectId || !delta) return;
  await query(
    `INSERT INTO project_stock (project_id, code, qty, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (project_id, code)
     DO UPDATE SET qty = project_stock.qty + EXCLUDED.qty, updated_at = NOW()`,
    [projectId, U.upper(code), delta]
  );
}

async function projectQty(query, projectId, code) {
  const r = await query(
    `SELECT qty FROM project_stock WHERE project_id = $1 AND code = $2`,
    [projectId, U.upper(code)]
  );
  return r.rows[0] ? U.num(r.rows[0].qty, 0) : 0;
}

module.exports = {
  QC_DUE_SOON_DAYS,
  qcStatusFor,
  snapshot,
  mainWarehouseId,
  warehouseQty,
  addWarehouseStock,
  setWarehouseStock,
  addProjectStock,
  projectQty,
};
