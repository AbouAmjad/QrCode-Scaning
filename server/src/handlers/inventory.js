const U = require("../lib/util");
const stock = require("../lib/stock");
const custody = require("../custody");

/* ---------------------------------------------------------- outstanding */

async function getOutstanding(ctx) {
  ctx.requireAny(["tool.return", "inventory.view", "dashboard.view"]);
  const overdueDays = Math.max(1, U.int(ctx.params.overdueDays, 1));
  const now = Date.now();
  const ledger = await ctx.ledger();

  const profiles = await ctx.query(
    `SELECT c.code,
            c.description AS name,
            COALESCE(pp.residence_no, '')    AS residence_no,
            COALESCE(pp.phone, '')           AS phone,
            COALESCE(pp.supervisor_name, '') AS supervisor_name,
            COALESCE(s.name, '')             AS supplier_name,
            COALESCE(ph.image_url, '')       AS image_url
       FROM catalog c
       LEFT JOIN person_profiles pp ON pp.code = c.code
       LEFT JOIN suppliers s        ON s.id = pp.supplier_id
       LEFT JOIN product_photos ph  ON ph.code = c.code
      WHERE c.kind = 'person'`
  );
  const byCode = new Map(profiles.rows.map((r) => [U.upper(r.code), r]));

  const items = custody
    .personsWithHoldings(ledger)
    .map((personCode) => {
      const tools = custody.holdingsForPerson(ledger, personCode, { overdueDays, now });
      if (!tools.length) return null;
      const profile = byCode.get(personCode) || {};
      const person = ledger.people.get(personCode);
      const qty = tools.reduce((s, t) => s + t.qty, 0);
      const daysOut = tools.reduce((m, t) => Math.max(m, t.daysOut), 0);
      const lastOutAt = person && person.lastOutAt ? person.lastOutAt : null;
      return {
        code: personCode,
        name: profile.name || (person && person.name) || personCode,
        phone: profile.phone || "",
        residenceNo: profile.residence_no || "",
        supplierName: profile.supplier_name || "",
        supervisorName: profile.supervisor_name || "",
        imageUrl: profile.image_url || "",
        lastOutAt: U.isoOrNull(lastOutAt),
        lastOutDate: lastOutAt ? U.fmtDate(lastOutAt) : "",
        lastOutDateTime: lastOutAt ? U.fmtDateTime(lastOutAt) : "",
        daysOut,
        overdue: daysOut >= overdueDays,
        qty,
        tools,
      };
    })
    .filter(Boolean);

  items.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      b.daysOut - a.daysOut ||
      String(a.name).localeCompare(String(b.name))
  );

  return {
    overdueDays,
    items,
    totals: {
      people: items.length,
      tools: items.reduce((s, p) => s + p.qty, 0),
      overduePeople: items.filter((p) => p.overdue).length,
      maxDays: items.reduce((m, p) => Math.max(m, p.daysOut), 0),
    },
  };
}

async function lookupToolHolder(ctx) {
  ctx.requireAny(["terminal.use", "tool.search", "tool.return"]);
  const code = U.upper(ctx.params.code);
  const personCode = U.upper(ctx.params.personCode);
  if (!code) return { error: "NO_CODE" };

  const ledger = await ctx.ledger();
  const holders = custody.holdersOfTool(ledger, code).map((h) => ({
    personCode: h.personCode,
    personName: h.personName,
    qty: h.qty,
    takenAt: U.isoOrNull(h.takenAt),
    daysOut: U.daysSince(h.takenAt),
  }));

  if (!holders.length) return { held: false, code, holders: [] };

  const self = holders.find((h) => h.personCode === personCode);
  if (self) return { held: true, code, clearsFromSelf: true, holder: self, holders };
  if (holders.length > 1) return { held: true, code, ambiguous: true, holders };
  return { held: true, code, holder: holders[0], holders };
}

/* ----------------------------------------------------------- receiving */

async function getReceiving(ctx) {
  ctx.requireAny(["tool.receive", "inventory.view"]);
  const limit = Math.min(1000, U.posInt(ctx.params.limit, 200));
  const r = await ctx.query(`SELECT * FROM receiving ORDER BY id DESC LIMIT $1`, [limit]);
  return {
    items: r.rows.map((row) => ({
      id: row.id,
      timestamp: U.isoOrNull(row.created_at),
      date: U.isoOrNull(row.created_at),
      code: row.code,
      description: row.description,
      category: row.category || "",
      subcategory: row.subcategory || "",
      supplier: row.supplier || "",
      invoice: row.invoice || "",
      po: row.po || "",
      cost: row.cost || "",
      warranty: row.warranty || "",
      byUser: row.by_user || "",
      qty: U.num(row.qty, 1),
    })),
  };
}

async function receiveItem(ctx) {
  ctx.require("tool.receive");
  const { params, query } = ctx;
  const code = U.upper(params.code);
  const description = U.trimmed(params.description);
  const invoice = U.trimmed(params.invoice);
  if (!code) return { success: false, error: "Code required" };
  if (!description) return { success: false, error: "Description required" };
  if (!invoice && !U.trimmed(params.po)) return { success: false, error: "INVOICE_OR_DN_REQUIRED" };

  const qty = Math.max(0.001, U.num(params.qty, 1));
  const kind = U.isPersonCode(code) ? "person" : U.isConsumableCode(code) ? "consumable" : "tool";
  if (kind === "person") return { success: false, error: "CODE_USED_BY_PERSON" };

  const requestId = U.int(params.requestId, 0) || null;
  const requestLineId = U.int(params.requestLineId, 0) || null;

  if (requestLineId) {
    const line = await query(
      `SELECT id, qty_requested, qty_received, line_status FROM store_request_lines WHERE id = $1`,
      [requestLineId]
    );
    if (line.rows.length && line.rows[0].line_status === "done") {
      return { success: false, error: "LINE_ALREADY_DONE" };
    }
  }

  await query(
    `INSERT INTO catalog (code, description, kind, category, subcategory, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (code) DO UPDATE
       SET description = EXCLUDED.description,
           kind = EXCLUDED.kind,
           category = COALESCE(NULLIF(EXCLUDED.category,''), catalog.category),
           subcategory = COALESCE(NULLIF(EXCLUDED.subcategory,''), catalog.subcategory),
           updated_at = NOW()`,
    [code, description, kind, U.trimmed(params.category), U.trimmed(params.subcategory)]
  );

  const warehouseId = U.int(params.warehouseId, 0) || (await stock.mainWarehouseId(query));
  const ins = await query(
    `INSERT INTO receiving (code, description, category, subcategory, supplier, invoice, po,
                            cost, warranty, qty, by_user, warehouse_id, request_id, request_line_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [
      code,
      description,
      U.trimmed(params.category),
      U.trimmed(params.subcategory),
      U.trimmed(params.supplier),
      invoice,
      U.trimmed(params.po || params.purchaseOrder),
      U.trimmed(params.cost),
      U.trimmed(params.warranty),
      qty,
      U.trimmed(params.user) || ctx.user.username,
      warehouseId,
      requestId,
      requestLineId,
    ]
  );

  await stock.addWarehouseStock(query, warehouseId, code, qty);
  await query(
    `INSERT INTO tool_lifecycle (code, state, note, by_user) VALUES ($1,'Active','Received',$2)`,
    [code, U.trimmed(params.user) || ctx.user.username]
  );

  if (requestLineId) await settleRequestLine(query, requestLineId, qty);

  custody.invalidate();
  await ctx.audit({ action: "RECEIVE_ITEM", after: JSON.stringify({ code, qty, invoice }) });
  return { success: true, id: ins.rows[0].id, code, description, qty };
}

async function settleRequestLine(query, lineId, qty) {
  const r = await query(
    `UPDATE store_request_lines
        SET qty_received = qty_received + $2,
            line_status = CASE WHEN qty_received + $2 >= qty_requested THEN 'done' ELSE 'partial' END
      WHERE id = $1
      RETURNING request_id`,
    [lineId, qty]
  );
  if (!r.rows.length) return;
  const requestId = r.rows[0].request_id;
  const open = await query(
    `SELECT COUNT(*)::int AS n FROM store_request_lines
      WHERE request_id = $1 AND line_status <> 'done'`,
    [requestId]
  );
  await query(
    `UPDATE store_requests SET status = $2 WHERE id = $1 AND status NOT IN ('Cancelled')`,
    [requestId, open.rows[0].n === 0 ? "Done" : "Partial"]
  );
}

/* -------------------------------------------------------------- damage */

async function getDamageDates(ctx) {
  ctx.requireAny(["damage.review", "damage.create"]);
  const r = await ctx.query(`SELECT DISTINCT row_date FROM damage ORDER BY row_date DESC`);
  return r.rows.map((x) => U.stripBraces(x.row_date));
}

async function getDamage(ctx) {
  ctx.requireAny(["damage.review", "damage.create"]);
  const filter = U.stripBraces(ctx.params.date);
  const sql = filter
    ? `SELECT * FROM damage WHERE REPLACE(REPLACE(row_date,'{',''),'}','') = $1 ORDER BY id DESC LIMIT 500`
    : `SELECT * FROM damage ORDER BY id DESC LIMIT 500`;
  const r = await ctx.query(sql, filter ? [filter] : []);
  return {
    items: r.rows.map((row) => ({
      id: row.id,
      date: U.stripBraces(row.row_date),
      code: row.tool_code,
      name: row.tool_name || row.tool_code,
      image: row.image_url || "",
      imageUrl: row.image_url || "",
      damagedBy: row.damaged_by,
      count: U.num(row.qty, 1),
      qty: U.num(row.qty, 1),
      remark: row.remark || "",
      createdAt: U.isoOrNull(row.created_at),
    })),
  };
}

/**
 * Append synthetic custody returns so a damaged tool leaves Not returned.
 * Tape shape: person → IN → tool × qty (same as a terminal return).
 * Consumables are skipped — they never create custody holdings.
 */
async function clearCustodyOnDamage(query, { personCode, toolCode, qty, username }) {
  if (!personCode || !toolCode || U.isConsumableCode(toolCode)) {
    return { cleared: 0, skipped: true };
  }
  const n = Math.max(1, U.posInt(qty, 1));
  const scannedAt = new Date();
  const scanRowDate = U.rowDateOf(scannedAt);
  const codes = [personCode, "IN"];
  for (let i = 0; i < n; i += 1) codes.push(toolCode);

  for (const code of codes) {
    await query(
      `INSERT INTO scans (tool_code, scanned_at, row_date, created_by, device_id, session_id, client_seq)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [code, scannedAt, scanRowDate, username || "damage-auto", "damage", null, null]
    );
  }
  return { cleared: n, skipped: false };
}

async function submitDamage(ctx) {
  ctx.requireAny(["damage.create", "damage.review", "damage.approve"]);
  const { params, query } = ctx;
  const toolCode = U.upper(params.toolCode || params.code);
  const personCode = U.upper(params.personCode || params.damagedBy);
  const qty = Math.max(1, U.posInt(params.qty || params.count, 1));
  const remark = U.trimmed(params.remark || params.remarks) || "No remark";
  const rowDate = U.stripBraces(params.date) || U.stripBraces(U.rowDateNow());
  if (!toolCode) return { success: false, error: "Tool code is required" };
  if (!personCode) return { success: false, error: "Person code is required" };

  let imageUrl = "";
  if (params.imageBase64 || params.image) {
    try {
      imageUrl = U.saveDataUrl(params.imageBase64 || params.image, `damage_${toolCode}`);
    } catch {
      imageUrl = "";
    }
  }

  const desc = await query(`SELECT description FROM catalog WHERE code = $1`, [toolCode]);
  const toolName = (desc.rows[0] && desc.rows[0].description) || toolCode;

  const ins = await query(
    `INSERT INTO damage (tool_code, tool_name, image_url, damaged_by, qty, remark, row_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [toolCode, toolName, imageUrl, personCode, qty, remark, rowDate]
  );

  // Damaged units leave the shelf.
  const warehouseId = await stock.mainWarehouseId(query);
  await stock.addWarehouseStock(query, warehouseId, toolCode, -qty);

  // Damaged units also leave the person's custody (Not returned / outstanding).
  const custodyClear = await clearCustodyOnDamage(query, {
    personCode,
    toolCode,
    qty,
    username: ctx.user && ctx.user.username,
  });

  custody.invalidate();
  await ctx.audit({
    action: "DAMAGE_CREATE",
    after: JSON.stringify({ code: toolCode, qty, custodyCleared: custodyClear.cleared }),
  });
  return {
    success: true,
    row: ins.rows[0].id,
    custodyCleared: custodyClear.cleared,
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

/* ----------------------------------------------------------- lifecycle */

async function setLifecycle(ctx) {
  ctx.requireAny(["repair.create", "repair.manage", "tool.edit"]);
  const code = U.upper(ctx.params.code);
  const state = U.trimmed(ctx.params.state);
  const allowed = ["Active", "Under Repair", "Awaiting Parts", "Scrap", "Returned"];
  if (!code) return { success: false, error: "Code required" };
  if (!allowed.includes(state)) return { success: false, error: "Invalid state" };
  await ctx.query(
    `INSERT INTO tool_lifecycle (code, state, note, by_user) VALUES ($1,$2,$3,$4)`,
    [code, state, U.trimmed(ctx.params.note), U.trimmed(ctx.params.user) || ctx.user.username]
  );
  await ctx.audit({ action: "LIFECYCLE_SET", after: JSON.stringify({ code, state }) });
  return { success: true, code, state };
}

async function getLifecycle(ctx) {
  ctx.requireAny(["inventory.view", "tool.view"]);
  const filter = U.upper(ctx.params.code);
  const r = await ctx.query(`SELECT * FROM tool_lifecycle ORDER BY id ASC`);
  const latest = new Map();
  r.rows.forEach((row) => {
    latest.set(row.code, {
      code: row.code,
      state: row.state,
      updatedAt: U.isoOrNull(row.created_at),
      note: row.note || "",
      byUser: row.by_user || "",
    });
  });
  let items = [...latest.values()];
  if (filter) items = items.filter((i) => i.code === filter);
  return { items };
}

/* ----------------------------------------------------------- dashboard */

function monthKey(d) {
  return `${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}`;
}

async function getInventoryDashboard(ctx) {
  ctx.requireAny(["dashboard.view", "dashboard.full", "inventory.view"]);
  const { query, params } = ctx;
  const days = Math.min(365, Math.max(1, U.int(params.days, 30)));
  const categoryFilter = U.trimmed(params.category);
  const now = Date.now();
  const since = new Date(now - days * 86400000);

  const ledger = await ctx.ledger();
  const snap = await stock.snapshot(query, ledger);
  const all = [...snap.values()];
  const items = categoryFilter ? all.filter((i) => i.category === categoryFilter) : all;
  const scoped = new Set(items.map((i) => i.code));

  const [suppliers, requests, receivingRows] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM suppliers`),
    query(`SELECT * FROM store_requests ORDER BY id DESC LIMIT 60`),
    query(`SELECT * FROM receiving WHERE created_at >= $1 ORDER BY created_at DESC`, [since]),
  ]);

  /* -- KPIs ------------------------------------------------------------- */
  const kpis = {
    totalProducts: items.length,
    inStock: items.filter((i) => i.available > 0).length,
    lowStock: items.filter((i) => i.lowStock && i.available > 0).length,
    outOfStock: items.filter((i) => i.available <= 0).length,
    inventoryValue: Math.round(
      items.reduce((s, i) => s + Math.max(0, i.available) * i.price, 0) * 100
    ) / 100,
    suppliers: suppliers.rows[0].n,
    ordersToday: requests.rows.filter(
      (r) => U.fmtDate(r.created_at) === U.fmtDate(new Date())
    ).length,
  };

  /* -- movement (stock in from receiving, stock out from custody) -------- */
  const dayIn = new Map();
  const dayOut = new Map();
  const monthIn = new Map();
  const monthOut = new Map();

  for (const row of receivingRows.rows) {
    if (categoryFilter && !scoped.has(U.upper(row.code))) continue;
    const d = new Date(row.created_at);
    const key = U.isoDateOnly(d);
    dayIn.set(key, (dayIn.get(key) || 0) + U.num(row.qty, 1));
    const mk = monthKey(d);
    monthIn.set(mk, (monthIn.get(mk) || 0) + U.num(row.qty, 1));
  }

  const topConsumed = new Map();
  for (const mv of ledger.movements) {
    if (mv.type !== "out" && mv.type !== "consumable") continue;
    if (categoryFilter && !scoped.has(U.upper(mv.code))) continue;
    const at = mv.scannedAt instanceof Date ? mv.scannedAt : new Date(mv.scannedAt);
    const mk = monthKey(at);
    monthOut.set(mk, (monthOut.get(mk) || 0) + mv.qty);
    if (at >= since) {
      const key = U.isoDateOnly(at);
      dayOut.set(key, (dayOut.get(key) || 0) + mv.qty);
      topConsumed.set(mv.code, (topConsumed.get(mv.code) || 0) + mv.qty);
    }
  }

  const movement = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = U.isoDateOnly(new Date(now - i * 86400000));
    movement.push({ date: key, stockIn: dayIn.get(key) || 0, stockOut: dayOut.get(key) || 0 });
  }

  const monthKeys = U.uniq([...monthIn.keys(), ...monthOut.keys()]).sort().slice(-12);
  const monthly = monthKeys.map((m) => ({
    month: m,
    stockIn: monthIn.get(m) || 0,
    stockOut: monthOut.get(m) || 0,
  }));

  /* -- breakdowns -------------------------------------------------------- */
  const catCount = new Map();
  all.forEach((i) => {
    const key = i.category || "—";
    catCount.set(key, (catCount.get(key) || 0) + 1);
  });
  const byCategory = [...catCount.entries()]
    .map(([category, products]) => ({ category, products }))
    .sort((a, b) => b.products - a.products);

  const topConsumedList = [...topConsumed.entries()]
    .map(([code, qty]) => ({ code, qty, description: (snap.get(code) || {}).description || "" }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 12);

  /* -- alerts ------------------------------------------------------------ */
  const reorder = items
    .filter((i) => i.available <= 0 || i.lowStock)
    .map((i) => ({
      code: i.code,
      description: i.description,
      available: i.available,
      minStock: i.minStock,
      status: i.available <= 0 ? "out" : "low",
    }))
    .sort((a, b) => a.available - b.available);

  const lastMovementAt = new Map();
  ledger.movements.forEach((mv) => {
    const at = mv.scannedAt instanceof Date ? mv.scannedAt : new Date(mv.scannedAt);
    const prev = lastMovementAt.get(mv.code);
    if (!prev || at > prev) lastMovementAt.set(mv.code, at);
  });
  const stagnant = items
    .filter((i) => {
      if (i.available <= 0) return false;
      const last = lastMovementAt.get(i.code);
      if (!last) return true;
      return U.daysSince(last, now) >= 90;
    })
    .slice(0, 20)
    .map((i) => ({ code: i.code, description: i.description, available: i.available }));

  const expiring = items
    .filter((i) => i.calibrationRequired && i.qcDaysLeft != null && i.qcDaysLeft <= stock.QC_DUE_SOON_DAYS)
    .map((i) => ({ code: i.code, description: i.description, daysLeft: i.qcDaysLeft }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const pendingRequests = requests.rows
    .filter((r) => r.status !== "Done" && r.status !== "Cancelled")
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      byUser: r.by_user || "",
      note: r.note || "",
      status: r.status || "Open",
      date: U.isoOrNull(r.created_at),
    }));

  /* -- tables ------------------------------------------------------------ */
  const recentActivities = ledger.movements
    .slice(-40)
    .reverse()
    .map((mv) => ({
      date: U.isoOrNull(mv.scannedAt),
      code: mv.code,
      action: mv.type === "in" ? "Return" : mv.type === "consumable" ? "Issue" : "Checkout",
      qty: mv.qty,
      personCode: mv.personCode || "",
    }));

  return {
    days,
    category: categoryFilter,
    categories: [...new Set(all.map((i) => i.category).filter(Boolean))].sort(),
    kpis,
    movement,
    monthly,
    byCategory,
    topConsumed: topConsumedList,
    alerts: { reorder: reorder.slice(0, 20), pendingRequests, stagnant, expiring },
    tables: {
      reorderList: reorder.slice(0, 50),
      recentProducts: [...items]
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
        .slice(0, 10)
        .map((i) => ({
          code: i.code,
          description: i.description,
          available: i.available,
          category: i.category,
        })),
      recentActivities,
      recentReceiving: receivingRows.rows.slice(0, 10).map((r) => ({
        date: U.isoOrNull(r.created_at),
        code: r.code,
        qty: U.num(r.qty, 1),
        supplier: r.supplier || "",
      })),
      recentRequests: requests.rows.slice(0, 10).map((r) => ({
        id: r.id,
        byUser: r.by_user || "",
        status: r.status || "Open",
        note: r.note || "",
      })),
    },
  };
}

module.exports = {
  getOutstanding,
  lookupToolHolder,
  getReceiving,
  receiveItem,
  getDamage,
  getDamageDates,
  submitDamage,
  setLifecycle,
  getLifecycle,
  getInventoryDashboard,
  settleRequestLine,
};
