const U = require("../lib/util");
const custody = require("../custody");

const PERSON_SELECT = `
  SELECT c.code,
         c.description AS name,
         COALESCE(pp.residence_no, '')    AS residence_no,
         COALESCE(pp.phone, '')           AS phone,
         COALESCE(pp.supervisor_name, '') AS supervisor_name,
         pp.supplier_id                   AS supplier_id,
         COALESCE(s.name, '')             AS supplier_name,
         COALESCE(ph.image_url, '')       AS image_url,
         c.updated_at
    FROM catalog c
    LEFT JOIN person_profiles pp ON pp.code = c.code
    LEFT JOIN suppliers s        ON s.id = pp.supplier_id
    LEFT JOIN product_photos ph  ON ph.code = c.code
   WHERE c.kind = 'person'`;

function baseView(row) {
  return {
    code: U.upper(row.code),
    name: row.name || row.code,
    residenceNo: row.residence_no || "",
    phone: row.phone || "",
    supervisorName: row.supervisor_name || "",
    supplierId: row.supplier_id || null,
    supplierName: row.supplier_name || "",
    imageUrl: row.image_url || "",
  };
}

async function listPeople(ctx) {
  ctx.requireAny(["worker.view", "worker.create", "worker.edit", "worker.delete", "tool.search", "terminal.use"]);
  const { query, params } = ctx;
  const ledger = await ctx.ledger();
  const overdueDays = Math.max(1, U.int(params.overdueDays, 1));
  const now = Date.now();

  const r = await query(`${PERSON_SELECT} ORDER BY c.code ASC`);
  const items = r.rows.map((row) => {
    const view = baseView(row);
    const person = ledger.people.get(view.code);
    const held = custody.holdingsForPerson(ledger, view.code, { overdueDays, now });
    const heldQty = held.reduce((s, t) => s + t.qty, 0);
    const lastOutAt = person && person.lastOutAt ? person.lastOutAt : null;
    return {
      ...view,
      toolsHeldCount: heldQty,
      toolsHeld: held,
      neverTookTools: !person || !person.totalTaken,
      lastOutAt: U.isoOrNull(lastOutAt),
      lastOutDate: lastOutAt ? U.fmtDate(lastOutAt) : "",
      lastOutDateTime: lastOutAt ? U.fmtDateTime(lastOutAt) : "",
      daysSinceLastOut: lastOutAt ? U.daysSince(lastOutAt, now) : null,
      totalTaken: person ? person.totalTaken : 0,
      totalReturned: person ? person.totalReturned : 0,
    };
  });

  const totals = {
    people: items.length,
    withTools: items.filter((p) => p.toolsHeldCount > 0).length,
    neverTook: items.filter((p) => p.neverTookTools).length,
  };

  const inactiveMonths = U.int(params.inactiveMonths, 0);
  if (inactiveMonths > 0) {
    const cutoff = now - inactiveMonths * 30 * 86400000;
    const filtered = items.filter((p) => {
      if (p.toolsHeldCount > 0) return false;
      if (!p.lastOutAt) return true;
      return new Date(p.lastOutAt).getTime() < cutoff;
    });
    return { items: filtered, totals, inactiveMonths };
  }

  return { items, totals };
}

async function getPersonCustody(ctx) {
  const { params } = ctx;
  const code = U.upper(params.code);
  if (!code) return { error: "NO_CODE" };

  const r = await ctx.query(`${PERSON_SELECT} AND c.code = $1 LIMIT 1`, [code]);
  const row = r.rows[0];
  const ledger = await ctx.ledger();
  const person = ledger.people.get(code);
  if (!row && !person) return { error: "NOT_FOUND" };

  const overdueDays = Math.max(1, U.int(params.overdueDays, 1));
  const now = Date.now();
  const view = row
    ? baseView(row)
    : { code, name: person.name || code, residenceNo: "", phone: "", supervisorName: "", supplierId: null, supplierName: "", imageUrl: custody.imageFor(ledger, code) };

  const toolsHeld = custody.holdingsForPerson(ledger, code, { overdueDays, now });
  const toolsHeldQty = toolsHeld.reduce((s, t) => s + t.qty, 0);
  const maxDaysOut = toolsHeld.reduce((m, t) => Math.max(m, t.daysOut), 0);
  const lastOutAt = person && person.lastOutAt ? person.lastOutAt : null;

  const events = (person ? person.events : [])
    .slice()
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, U.int(params.limit, 400))
    .map((e) => ({
      type: e.type,
      code: e.code,
      description: e.description || "",
      scannedAt: U.isoOrNull(e.scannedAt),
      dateLabel: U.fmtDate(e.scannedAt),
      dateTimeLabel: U.fmtDateTime(e.scannedAt),
      rowDate: e.rowDate || "",
      returnedBy: e.returnedBy || "",
      recoveredFrom: e.recoveredFrom || "",
      createdBy: e.createdBy || "",
      deviceId: e.deviceId || "",
      sessionId: e.sessionId || "",
    }));

  return {
    success: true,
    ...view,
    overdueDays,
    toolsHeld,
    toolsHeldQty,
    maxDaysOut,
    overdue: maxDaysOut >= overdueDays && toolsHeldQty > 0,
    lastOutAt: U.isoOrNull(lastOutAt),
    lastOutDate: lastOutAt ? U.fmtDate(lastOutAt) : "",
    lastOutDateTime: lastOutAt ? U.fmtDateTime(lastOutAt) : "",
    stats: {
      currentlyHeld: toolsHeldQty,
      totalTaken: person ? person.totalTaken : 0,
      totalReturned: person ? person.totalReturned : 0,
      consumablesIssued: person ? person.consumablesIssued : 0,
    },
    events,
  };
}

async function resolveSupplierId(ctx, params) {
  const explicit = U.int(params.supplierId, 0);
  if (explicit) return explicit;
  const name = U.trimmed(params.supplierName);
  if (!name) return null;
  const r = await ctx.query(
    `INSERT INTO suppliers (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return r.rows[0].id;
}

/**
 * Next free person code, filling deleted/skipped gaps.
 * If most people are in the P100+ series, search gaps from 100 upward
 * (avoids suggesting P002 when P001 is a lone outlier and the real series is P101…).
 * Otherwise fill the lowest free number from 1.
 */
function nextAvailablePersonCode(existingCodes) {
  const nums = [];
  for (const raw of existingCodes || []) {
    const m = String(raw || "")
      .toUpperCase()
      .match(/^P(\d+)$/);
    if (m) nums.push(Number(m[1]));
  }
  if (!nums.length) return { code: "P101", number: 101, filledGap: false, seriesStart: 101 };

  const used = new Set(nums);
  const max = Math.max(...nums);
  const highCount = nums.filter((n) => n >= 100).length;
  const seriesStart = highCount * 2 >= nums.length ? 100 : 1;

  let n = seriesStart;
  while (n <= max && used.has(n)) n += 1;
  if (n > max) n = max + 1;

  return {
    code: `P${n}`,
    number: n,
    filledGap: n <= max,
    seriesStart,
    max,
    usedCount: nums.length,
  };
}

async function loadPersonNumbers(query) {
  const r = await query(
    `SELECT code FROM catalog WHERE kind = 'person' AND code ~ '^P[0-9]+$' ORDER BY code ASC`
  );
  return r.rows.map((row) => U.upper(row.code));
}

async function suggestPersonCode(ctx) {
  ctx.requireAny(["worker.create", "worker.edit", "worker.view"]);
  const codes = await loadPersonNumbers(ctx.query);
  const next = nextAvailablePersonCode(codes);
  // Surface a few upcoming free codes for the form hint.
  const used = new Set(
    codes
      .map((c) => {
        const m = c.match(/^P(\d+)$/);
        return m ? Number(m[1]) : null;
      })
      .filter((n) => n != null)
  );
  const upcoming = [];
  let cursor = next.seriesStart;
  const maxScan = (next.max || 100) + 20;
  while (upcoming.length < 5 && cursor <= maxScan) {
    if (!used.has(cursor)) upcoming.push(`P${cursor}`);
    cursor += 1;
  }
  return { ...next, upcoming };
}

async function upsertPerson(ctx) {
  const isEdit = U.bool(ctx.params.isEdit) || !!U.trimmed(ctx.params.originalCode);
  ctx.require(isEdit ? "worker.edit" : "worker.create");

  const { params, query } = ctx;
  let code = U.upper(params.code);
  const originalCode = U.upper(params.originalCode);
  const name = U.trimmed(params.name);
  let autoAssigned = false;

  // New person with empty code → fill the first free gap (or max+1).
  if (!code && !isEdit && !originalCode) {
    const next = nextAvailablePersonCode(await loadPersonNumbers(query));
    code = next.code;
    autoAssigned = true;
  }

  if (!code) return { success: false, error: "CODE_REQUIRED" };
  if (!U.isPersonCode(code)) return { success: false, error: "CODE_MUST_START_WITH_P" };
  if (!name) return { success: false, error: "NAME_REQUIRED" };

  const existing = await query(`SELECT code, kind FROM catalog WHERE code = $1`, [code]);
  if (existing.rows.length && code !== originalCode) {
    return {
      success: false,
      error: existing.rows[0].kind === "person" ? "CODE_USED_BY_PERSON" : "CODE_USED_BY_PRODUCT",
    };
  }

  const supplierId = await resolveSupplierId(ctx, params);

  if (originalCode && originalCode !== code) {
    // Renaming a person rewrites their identity everywhere the code is stored.
    try {
      await query("BEGIN");
      await query(
        `INSERT INTO catalog (code, description, kind, updated_at)
         VALUES ($1,$2,'person',NOW())`,
        [code, name]
      );
      await query(
        `INSERT INTO person_profiles (code, residence_no, phone, supervisor_name, supplier_id, updated_at)
         SELECT $1, residence_no, phone, supervisor_name, supplier_id, NOW()
           FROM person_profiles WHERE code = $2`,
        [code, originalCode]
      );
      await query(
        `INSERT INTO product_photos (code, image_url, by_user, updated_at)
         SELECT $1, image_url, by_user, NOW() FROM product_photos WHERE code = $2
         ON CONFLICT (code) DO UPDATE SET image_url = EXCLUDED.image_url`,
        [code, originalCode]
      );
      await query(`UPDATE scans SET tool_code = $1 WHERE tool_code = $2`, [code, originalCode]);
      await query(`UPDATE damage SET damaged_by = $1 WHERE damaged_by = $2`, [code, originalCode]);
      await query(`DELETE FROM person_profiles WHERE code = $1`, [originalCode]);
      await query(`DELETE FROM product_photos WHERE code = $1`, [originalCode]);
      await query(`DELETE FROM catalog WHERE code = $1`, [originalCode]);
      await query("COMMIT");
    } catch (e) {
      await query("ROLLBACK").catch(() => {});
      return { success: false, error: "RENAME_FAILED", message: (e && e.message) || "" };
    }
    custody.invalidate();
  }

  await query(
    `INSERT INTO catalog (code, description, kind, updated_at)
     VALUES ($1,$2,'person',NOW())
     ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, kind = 'person', updated_at = NOW()`,
    [code, name]
  );
  await query(
    `INSERT INTO person_profiles (code, residence_no, phone, supervisor_name, supplier_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,NOW())
     ON CONFLICT (code) DO UPDATE SET residence_no = EXCLUDED.residence_no,
                                      phone = EXCLUDED.phone,
                                      supervisor_name = EXCLUDED.supervisor_name,
                                      supplier_id = EXCLUDED.supplier_id,
                                      updated_at = NOW()`,
    [
      code,
      U.trimmed(params.residenceNo),
      U.trimmed(params.phone),
      U.trimmed(params.supervisorName),
      supplierId,
    ]
  );

  custody.invalidate();
  await ctx.audit({
    action: isEdit ? "PERSON_UPDATE" : "PERSON_CREATE",
    after: JSON.stringify({ code, name, autoAssigned }),
  });
  return { success: true, code, name, supplierId, autoAssigned };
}

async function deletePerson(ctx) {
  ctx.require("worker.delete");
  const { params, query } = ctx;
  const code = U.upper(params.code);
  if (!code) return { success: false, error: "CODE_REQUIRED" };

  const ledger = await ctx.ledger();
  const held = custody.holdingsForPerson(ledger, code);
  const heldQty = held.reduce((s, t) => s + t.qty, 0);
  if (heldQty > 0 && !U.bool(params.force)) {
    return {
      success: false,
      error: "HAS_TOOLS",
      needConfirm: true,
      toolsHeldCount: heldQty,
      toolsHeld: held.map((t) => ({ code: t.code, qty: t.qty, description: t.description })),
    };
  }

  const photo = await query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  await query(`DELETE FROM person_profiles WHERE code = $1`, [code]);
  await query(`DELETE FROM product_photos WHERE code = $1`, [code]);
  const del = await query(`DELETE FROM catalog WHERE code = $1 AND kind = 'person'`, [code]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  if (photo.rows[0]) U.removeUpload(photo.rows[0].image_url);

  custody.invalidate();
  await ctx.audit({ action: "PERSON_DELETE", before: JSON.stringify({ code, heldQty }) });
  return { success: true, code };
}

async function setPersonIdImage(ctx) {
  ctx.require("worker.edit");
  const { params, query } = ctx;
  const code = U.upper(params.code);
  const image = params.imageBase64 || params.image || "";
  if (!code) return { success: false, error: "CODE_REQUIRED" };
  if (!image) return { success: false, error: "IMAGE_REQUIRED" };

  const prev = await query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  const imageUrl = U.saveDataUrl(image, `person_${code}`);
  await query(
    `INSERT INTO product_photos (code, image_url, by_user, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (code) DO UPDATE SET image_url = EXCLUDED.image_url,
                                      by_user = EXCLUDED.by_user,
                                      updated_at = NOW()`,
    [code, imageUrl, ctx.user.username]
  );
  if (prev.rows[0]) U.removeUpload(prev.rows[0].image_url);
  return { success: true, code, image: imageUrl, imageUrl };
}

async function clearPersonIdImage(ctx) {
  ctx.require("worker.edit");
  const code = U.upper(ctx.params.code);
  if (!code) return { success: false, error: "CODE_REQUIRED" };
  const prev = await ctx.query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  await ctx.query(`DELETE FROM product_photos WHERE code = $1`, [code]);
  if (prev.rows[0]) U.removeUpload(prev.rows[0].image_url);
  return { success: true, code };
}

/* ------------------------------------------------------------- suppliers */

async function listSuppliers(ctx) {
  const r = await ctx.query(`SELECT * FROM suppliers ORDER BY name ASC`);
  return {
    items: r.rows.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone || "",
      note: s.note || "",
      createdAt: U.isoOrNull(s.created_at),
    })),
  };
}

async function upsertSupplier(ctx) {
  ctx.requireAny(["worker.create", "worker.edit", "tool.receive"]);
  const { params, query } = ctx;
  const name = U.trimmed(params.name);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  const id = U.int(params.id, 0);

  if (id) {
    const r = await query(
      `UPDATE suppliers SET name = $1, phone = $2, note = $3 WHERE id = $4 RETURNING id`,
      [name, U.trimmed(params.phone), U.trimmed(params.note), id]
    );
    if (!r.rows.length) return { success: false, error: "NOT_FOUND" };
    return { success: true, id };
  }

  const r = await query(
    `INSERT INTO suppliers (name, phone, note) VALUES ($1,$2,$3)
     ON CONFLICT (name) DO UPDATE SET phone = COALESCE(NULLIF(EXCLUDED.phone,''), suppliers.phone),
                                      note  = COALESCE(NULLIF(EXCLUDED.note,''),  suppliers.note)
     RETURNING id`,
    [name, U.trimmed(params.phone), U.trimmed(params.note)]
  );
  return { success: true, id: r.rows[0].id, name };
}

async function deleteSupplier(ctx) {
  ctx.requireAny(["worker.delete", "worker.edit"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const linked = await ctx.query(
    `SELECT COUNT(*)::int AS n FROM person_profiles WHERE supplier_id = $1`,
    [id]
  );
  if (linked.rows[0].n > 0) {
    return { success: false, error: "SUPPLIER_IN_USE", message: `${linked.rows[0].n} people linked` };
  }
  const del = await ctx.query(`DELETE FROM suppliers WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  return { success: true, id };
}

module.exports = {
  listPeople,
  getPersonCustody,
  suggestPersonCode,
  nextAvailablePersonCode,
  upsertPerson,
  deletePerson,
  setPersonIdImage,
  clearPersonIdImage,
  listSuppliers,
  upsertSupplier,
  deleteSupplier,
};
