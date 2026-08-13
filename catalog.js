const U = require("../lib/util");
const stock = require("../lib/stock");
const custody = require("../custody");

const CODE_PREFIXES = ["I", "E", "C", "B"];

function kindOf(code) {
  return U.isPersonCode(code) ? "person" : U.isConsumableCode(code) ? "consumable" : "tool";
}

/* ------------------------------------------------------------ stock views */

async function getCatalogStock(ctx) {
  ctx.require("tool.view");
  const items = [...(await stock.snapshot(ctx.query, await ctx.ledger())).values()];
  items.sort(U.sortByCode);
  const totals = {
    products: items.length,
    available: items.reduce((s, i) => s + Math.max(0, i.available), 0),
    out: items.reduce((s, i) => s + i.out + i.issued, 0),
    projectOut: items.reduce((s, i) => s + i.projectOut, 0),
    lowStock: items.filter((i) => i.lowStock).length,
    damaged: items.reduce((s, i) => s + i.damaged, 0),
  };
  return { items, totals };
}

async function getDesc(ctx) {
  ctx.requireAny(["terminal.use", "tool.view", "tool.search"]);
  const { params } = ctx;
  const code = U.upper(params.code);
  if (!code) return { description: "NO CODE", found: false, hasDescription: false };

  const r = await ctx.query(
    `SELECT c.code, c.description, c.kind, c.serialized,
            COALESCE(p.image_url, '') AS image_url
       FROM catalog c
       LEFT JOIN product_photos p ON p.code = c.code
      WHERE c.code = $1`,
    [code]
  );
  const row = r.rows[0];
  if (!row) {
    return { description: "DESCRIPTION NOT FOUND", found: false, hasDescription: false, code };
  }

  const base = {
    code,
    found: true,
    hasDescription: !!U.trimmed(row.description) && U.upper(row.description) !== code,
    description: row.description || code,
    kind: row.kind || kindOf(code),
    serialized: row.serialized === true,
    imageUrl: row.image_url || "",
  };

  if (base.kind !== "person") return base;

  // Terminal shows what the scanned person is still holding.
  const overdueDays = Math.max(1, U.int(params.overdueDays, 1));
  const ledger = await ctx.ledger();
  const toolsHeld = custody.holdingsForPerson(ledger, code, { overdueDays });
  return {
    ...base,
    overdueDays,
    toolsHeld,
    toolsHeldQty: toolsHeld.reduce((s, t) => s + t.qty, 0),
  };
}

/* --------------------------------------------------------------- products */

async function checkCatalogCode(ctx) {
  const code = U.upper(ctx.params.code);
  const intendedKind = U.trimmed(ctx.params.intendedKind) || "tool";
  const isEdit = U.bool(ctx.params.isEdit);
  if (!code) return { available: false, error: "CODE_REQUIRED" };

  const r = await ctx.query(`SELECT code, kind, description FROM catalog WHERE code = $1`, [code]);
  if (!r.rows.length) return { available: true, code };
  if (isEdit) return { available: true, code, existing: true };

  const kind = r.rows[0].kind || "tool";
  const error =
    kind === "person"
      ? "CODE_USED_BY_PERSON"
      : intendedKind === "person"
        ? "CODE_USED_BY_PRODUCT"
        : "CODE_EXISTS";
  return { available: false, code, kind, error, description: r.rows[0].description || "" };
}

async function getLastCodes(ctx) {
  const r = await ctx.query(
    `SELECT code, description FROM catalog WHERE kind <> 'person' ORDER BY code ASC`
  );
  const buckets = new Map(CODE_PREFIXES.map((p) => [p, { prefix: p, count: 0, highest: 0, highestCode: "", highestDescription: "" }]));

  for (const row of r.rows) {
    const code = U.upper(row.code);
    const prefix = code.charAt(0);
    const bucket = buckets.get(prefix);
    if (!bucket) continue;
    bucket.count += 1;
    const m = code.match(/^[A-Z](\d+)/);
    const n = m ? Number(m[1]) : 0;
    if (n > bucket.highest) {
      bucket.highest = n;
      bucket.highestCode = code;
      bucket.highestDescription = row.description || "";
    }
  }

  return {
    items: [...buckets.values()].map((b) => ({
      prefix: b.prefix,
      count: b.count,
      highestCode: b.highestCode,
      highestNumber: b.highest,
      highestDescription: b.highestDescription,
      suggestedCode: `${b.prefix}${b.highest + 1}`,
    })),
  };
}

/** Adjusts receiving so `available` (= received − damaged − locked) lands on `stockQty`. */
async function applyStockLevel(ctx, code, stockQty) {
  const query = ctx.query;
  const c = U.upper(code);
  const warehouseId = await stock.mainWarehouseId(query);
  if (!warehouseId) return;

  const ledger = await ctx.ledger();
  const cat = await query(`SELECT description, kind FROM catalog WHERE code = $1`, [c]);
  const isConsumable =
    (cat.rows[0] && cat.rows[0].kind === "consumable") || U.isConsumableCode(c);
  const out = isConsumable ? 0 : U.num(custody.outQtyByCode(ledger).get(c), 0);
  const issued = isConsumable ? U.num(custody.issuedQtyByCode(ledger).get(c), 0) : 0;
  const locked = isConsumable ? issued : out;

  const [dmgR, rcvR] = await Promise.all([
    query(`SELECT COALESCE(SUM(qty),0)::numeric AS qty FROM damage WHERE tool_code = $1`, [c]),
    query(`SELECT COALESCE(SUM(qty),0)::numeric AS qty FROM receiving WHERE code = $1`, [c]),
  ]);
  const damaged = U.num(dmgR.rows[0].qty, 0);
  const received = U.num(rcvR.rows[0].qty, 0);
  const targetReceived = stockQty + damaged + locked;
  const delta = targetReceived - received;
  if (!delta) return;

  const description = (cat.rows[0] && cat.rows[0].description) || c;
  await query(
    `INSERT INTO receiving (code, description, supplier, invoice, qty, by_user, warehouse_id)
     VALUES ($1,$2,'Stock adjustment','ADJ',$3,$4,$5)`,
    [c, description, delta, ctx.user.username, warehouseId]
  );
  await stock.addWarehouseStock(query, warehouseId, c, delta);
}

async function upsertProduct(ctx) {
  const isEdit = U.bool(ctx.params.isEdit);
  ctx.require(isEdit ? "tool.edit" : "tool.create");

  const { params, query } = ctx;
  const code = U.upper(params.code);
  const description = U.trimmed(params.description);
  if (!code) return { success: false, error: "CODE_REQUIRED" };
  if (!description) return { success: false, error: "DESCRIPTION_REQUIRED" };
  if (U.isPersonCode(code)) return { success: false, error: "CODE_USED_BY_PERSON" };

  const existing = await query(`SELECT code, kind FROM catalog WHERE code = $1`, [code]);
  if (existing.rows.length && !isEdit) {
    return {
      success: false,
      error: existing.rows[0].kind === "person" ? "CODE_USED_BY_PERSON" : "CODE_EXISTS",
    };
  }

  const calibrationRequired = U.bool(params.calibrationRequired);
  const calibrationNextDue = U.nullableDate(params.calibrationNextDue);
  if (calibrationRequired && !calibrationNextDue) {
    return { success: false, error: "CALIBRATION_DUE_REQUIRED" };
  }
  const calibratedNow = U.bool(params.calibratedNow);
  const calibrationLastDone = calibratedNow
    ? U.isoDateOnly(new Date())
    : U.nullableDate(params.calibrationLastDone);

  await query(
    `INSERT INTO catalog (code, description, kind, category, subcategory, item, unit,
                          min_stock, price, serialized, calibration_required,
                          calibration_last_done, calibration_next_due, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
     ON CONFLICT (code) DO UPDATE
       SET description = EXCLUDED.description,
           kind = EXCLUDED.kind,
           category = EXCLUDED.category,
           subcategory = EXCLUDED.subcategory,
           item = EXCLUDED.item,
           unit = EXCLUDED.unit,
           min_stock = EXCLUDED.min_stock,
           price = EXCLUDED.price,
           serialized = EXCLUDED.serialized,
           calibration_required = EXCLUDED.calibration_required,
           calibration_last_done = COALESCE(EXCLUDED.calibration_last_done, catalog.calibration_last_done),
           calibration_next_due = EXCLUDED.calibration_next_due,
           updated_at = NOW()`,
    [
      code,
      description,
      kindOf(code),
      U.trimmed(params.category),
      U.trimmed(params.subcategory),
      U.trimmed(params.item),
      U.trimmed(params.unit) || "pcs",
      U.num(params.minStock, 0),
      U.num(params.price, 0),
      U.bool(params.serialized),
      calibrationRequired,
      calibrationLastDone,
      calibrationNextDue,
    ]
  );

  if (params.stockQty !== undefined && U.trimmed(params.stockQty) !== "") {
    await applyStockLevel(ctx, code, U.num(params.stockQty, 0));
  }
  if (calibratedNow && calibrationRequired) {
    await query(
      `INSERT INTO qc_calibrations (code, last_done, next_due, notes, by_user)
       VALUES ($1,$2,$3,$4,$5)`,
      [code, calibrationLastDone, calibrationNextDue, "Recorded with product save", ctx.user.username]
    );
  }

  custody.invalidate();
  const auditAfter = { code, description };
  if (params.stockQty !== undefined && U.trimmed(params.stockQty) !== "") {
    auditAfter.stockQty = U.num(params.stockQty, 0);
  }
  if (params.minStock !== undefined && U.trimmed(params.minStock) !== "") {
    auditAfter.minStock = U.num(params.minStock, 0);
  }
  await ctx.audit({
    action: isEdit ? "PRODUCT_UPDATE" : "PRODUCT_CREATE",
    after: JSON.stringify(auditAfter),
  });
  return { success: true, code, description };
}

async function deleteProduct(ctx) {
  ctx.require("tool.delete");
  const { query } = ctx;
  const code = U.upper(ctx.params.code);
  if (!code) return { success: false, error: "CODE_REQUIRED" };

  const ledger = await ctx.ledger();
  const holders = custody.holdersOfTool(ledger, code);
  if (holders.length && !U.bool(ctx.params.force)) {
    return {
      success: false,
      error: "HAS_CUSTODY",
      needConfirm: true,
      holders,
    };
  }

  const photo = await query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  await query(`DELETE FROM product_photos WHERE code = $1`, [code]);
  await query(`DELETE FROM warehouse_stock WHERE code = $1`, [code]);
  const del = await query(`DELETE FROM catalog WHERE code = $1 AND kind <> 'person'`, [code]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  if (photo.rows[0]) U.removeUpload(photo.rows[0].image_url);

  custody.invalidate();
  await ctx.audit({ action: "PRODUCT_DELETE", before: JSON.stringify({ code }) });
  return { success: true, code };
}

async function bulkUpsertProducts(ctx) {
  ctx.requireAny(["tool.create", "tool.edit", "inventory.adjust"]);
  const { params, query } = ctx;
  const rows = U.asArray(params.rows);
  const mode = U.trimmed(params.mode) || "upsert"; // upsert | createOnly | updateOnly
  if (!rows.length) return { error: "NO_ROWS" };

  const results = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += 1) {
    const raw = rows[i] || {};
    const rowNo = raw.row != null ? raw.row : i + 1;
    const code = U.upper(raw.code);
    const description = U.trimmed(raw.description);
    try {
      if (!code) throw new Error("CODE_REQUIRED");
      if (!description) throw new Error("DESCRIPTION_REQUIRED");
      if (U.isPersonCode(code)) throw new Error("CODE_USED_BY_PERSON");

      const existing = await query(`SELECT code, kind FROM catalog WHERE code = $1`, [code]);
      const exists = existing.rows.length > 0;
      if (exists && existing.rows[0].kind === "person") throw new Error("CODE_USED_BY_PERSON");
      if (exists && mode === "createOnly") {
        skipped += 1;
        results.push({ row: rowNo, code, ok: true, skipped: true });
        continue;
      }
      if (!exists && mode === "updateOnly") {
        skipped += 1;
        results.push({ row: rowNo, code, ok: true, skipped: true });
        continue;
      }

      await query(
        `INSERT INTO catalog (code, description, kind, category, subcategory, item, unit,
                              min_stock, price, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (code) DO UPDATE
           SET description = EXCLUDED.description,
               category = COALESCE(NULLIF(EXCLUDED.category,''), catalog.category),
               subcategory = COALESCE(NULLIF(EXCLUDED.subcategory,''), catalog.subcategory),
               item = COALESCE(NULLIF(EXCLUDED.item,''), catalog.item),
               unit = COALESCE(NULLIF(EXCLUDED.unit,''), catalog.unit),
               min_stock = EXCLUDED.min_stock,
               price = EXCLUDED.price,
               updated_at = NOW()`,
        [
          code,
          description,
          kindOf(code),
          U.trimmed(raw.category),
          U.trimmed(raw.subcategory),
          U.trimmed(raw.item),
          U.trimmed(raw.unit) || "pcs",
          U.num(raw.minStock, 0),
          U.num(raw.price, 0),
        ]
      );

      if (raw.stockQty !== undefined && U.trimmed(raw.stockQty) !== "") {
        await applyStockLevel(ctx, code, U.num(raw.stockQty, 0));
      }
      if (U.trimmed(raw.imageUrl)) {
        await query(
          `INSERT INTO product_photos (code, image_url, by_user, updated_at)
           VALUES ($1,$2,$3,NOW())
           ON CONFLICT (code) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()`,
          [code, U.trimmed(raw.imageUrl), ctx.user.username]
        );
      }

      if (exists) updated += 1;
      else created += 1;
      results.push({ row: rowNo, code, ok: true });
    } catch (e) {
      failed += 1;
      results.push({ row: rowNo, code, ok: false, error: (e && e.message) || "FAILED" });
    }
  }

  custody.invalidate();
  await ctx.audit({
    action: "PRODUCT_BULK_IMPORT",
    after: JSON.stringify({ created, updated, skipped, failed }),
  });
  return { success: true, created, updated, skipped, failed, results };
}

/* --------------------------------------------------------------- photos */

async function setProductImage(ctx) {
  ctx.requireAny(["tool.edit", "tool.create", "worker.edit", "worker.create"]);
  const { params, query } = ctx;
  const code = U.upper(params.code);
  const image = params.imageBase64 || params.image || "";
  if (!code) return { success: false, error: "CODE_REQUIRED" };
  if (!image) return { success: false, error: "IMAGE_REQUIRED" };

  const prev = await query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  const imageUrl = U.saveDataUrl(image, `product_${code}`);
  await query(
    `INSERT INTO product_photos (code, image_url, by_user, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (code) DO UPDATE SET image_url = EXCLUDED.image_url,
                                      by_user = EXCLUDED.by_user,
                                      updated_at = NOW()`,
    [code, imageUrl, U.trimmed(params.user) || ctx.user.username]
  );
  if (prev.rows[0]) U.removeUpload(prev.rows[0].image_url);
  custody.invalidate();
  return { success: true, code, image: imageUrl, imageUrl };
}

async function getProductImages(ctx) {
  const only = U.upper(ctx.params.code);
  const images = {};
  if (only) {
    const r = await ctx.query(`SELECT code, image_url FROM product_photos WHERE code = $1`, [only]);
    if (r.rows[0]) images[r.rows[0].code] = r.rows[0].image_url;
    return { images, image: images[only] || "" };
  }
  const r = await ctx.query(`SELECT code, image_url FROM product_photos ORDER BY code`);
  r.rows.forEach((row) => {
    images[row.code] = row.image_url;
  });
  return { images };
}

async function clearProductImage(ctx) {
  ctx.requireAny(["tool.edit", "worker.edit"]);
  const code = U.upper(ctx.params.code);
  if (!code) return { success: false, error: "CODE_REQUIRED" };
  const prev = await ctx.query(`SELECT image_url FROM product_photos WHERE code = $1`, [code]);
  await ctx.query(`DELETE FROM product_photos WHERE code = $1`, [code]);
  if (prev.rows[0]) U.removeUpload(prev.rows[0].image_url);
  custody.invalidate();
  return { success: true, code };
}

/* ----------------------------------------------------------- categories */

const CAT_ORDER = `ORDER BY COALESCE(sort_order, 0) ASC, id ASC`;

async function nextSortOrder(ctx, table, whereSql = "", params = []) {
  const r = await ctx.query(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM ${table} ${whereSql}`,
    params
  );
  return U.int(r.rows[0] && r.rows[0].n, 0);
}

function parseIdList(raw) {
  const src = Array.isArray(raw)
    ? raw
    : String(raw || "")
        .split(/[,\s]+/)
        .filter(Boolean);
  return src.map((x) => U.int(x, 0)).filter((n) => n > 0);
}

async function listCategories(ctx) {
  const [cats, subs, items, used] = await Promise.all([
    ctx.query(`SELECT id, name, COALESCE(sort_order, 0) AS sort_order FROM categories ${CAT_ORDER}`),
    ctx.query(
      `SELECT id, category_id, name, COALESCE(sort_order, 0) AS sort_order FROM subcategories ${CAT_ORDER}`
    ),
    ctx.query(
      `SELECT ci.id, ci.subcategory_id, s.category_id, ci.name, COALESCE(ci.sort_order, 0) AS sort_order
         FROM catalog_items ci
         JOIN subcategories s ON s.id = ci.subcategory_id
        ORDER BY COALESCE(ci.sort_order, 0) ASC, ci.id ASC`
    ),
    ctx.query(
      `SELECT category, subcategory, item, COUNT(*)::int AS n
         FROM catalog WHERE kind <> 'person' GROUP BY category, subcategory, item`
    ),
  ]);

  const counts = new Map();
  used.rows.forEach((r) => {
    const cat = String(r.category || "");
    const sub = String(r.subcategory || "");
    const item = String(r.item || "");
    const n = r.n || 0;
    counts.set(`c:${cat}`, (counts.get(`c:${cat}`) || 0) + n);
    counts.set(`s:${cat}|${sub}`, (counts.get(`s:${cat}|${sub}`) || 0) + n);
    counts.set(`i:${cat}|${sub}|${item}`, (counts.get(`i:${cat}|${sub}|${item}`) || 0) + n);
  });

  const catNameById = new Map(cats.rows.map((c) => [c.id, c.name]));
  const subNameById = new Map(subs.rows.map((s) => [s.id, s.name]));

  return {
    categories: cats.rows.map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order || 0,
      productCount: counts.get(`c:${c.name}`) || 0,
    })),
    subcategories: subs.rows.map((s) => {
      const catName = catNameById.get(s.category_id) || "";
      return {
        id: s.id,
        name: s.name,
        categoryId: s.category_id,
        sortOrder: s.sort_order || 0,
        productCount: counts.get(`s:${catName}|${s.name}`) || 0,
      };
    }),
    items: items.rows.map((i) => {
      const catName = catNameById.get(i.category_id) || "";
      const subName = subNameById.get(i.subcategory_id) || "";
      return {
        id: i.id,
        name: i.name,
        subcategoryId: i.subcategory_id,
        categoryId: i.category_id,
        sortOrder: i.sort_order || 0,
        productCount: counts.get(`i:${catName}|${subName}|${i.name}`) || 0,
      };
    }),
  };
}

async function upsertCategory(ctx) {
  ctx.requireAny(["tool.create", "tool.edit"]);
  const name = U.trimmed(ctx.params.name);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  const id = U.int(ctx.params.id, 0);
  if (id) {
    const before = await ctx.query(`SELECT name FROM categories WHERE id = $1`, [id]);
    if (!before.rows.length) return { success: false, error: "NOT_FOUND" };
    await ctx.query(`UPDATE categories SET name = $1 WHERE id = $2`, [name, id]);
    if (before.rows[0].name !== name) {
      await ctx.query(`UPDATE catalog SET category = $1 WHERE category = $2`, [
        name,
        before.rows[0].name,
      ]);
    }
    return { success: true, id, name };
  }
  const sort = await nextSortOrder(ctx, "categories");
  const r = await ctx.query(
    `INSERT INTO categories (name, sort_order) VALUES ($1,$2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name, sort]
  );
  return { success: true, id: r.rows[0].id, name, sortOrder: sort };
}

async function upsertSubcategory(ctx) {
  ctx.requireAny(["tool.create", "tool.edit"]);
  const name = U.trimmed(ctx.params.name);
  const categoryId = U.int(ctx.params.categoryId, 0);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  if (!categoryId) return { success: false, error: "CATEGORY_REQUIRED" };
  const id = U.int(ctx.params.id, 0);
  if (id) {
    const before = await ctx.query(
      `SELECT s.name, c.name AS category
         FROM subcategories s
         JOIN categories c ON c.id = s.category_id
        WHERE s.id = $1`,
      [id]
    );
    if (!before.rows.length) return { success: false, error: "NOT_FOUND" };
    await ctx.query(`UPDATE subcategories SET name = $1, category_id = $2 WHERE id = $3`, [
      name,
      categoryId,
      id,
    ]);
    if (before.rows[0].name !== name) {
      await ctx.query(
        `UPDATE catalog SET subcategory = $1 WHERE category = $2 AND subcategory = $3`,
        [name, before.rows[0].category, before.rows[0].name]
      );
    }
    return { success: true, id, name, categoryId };
  }
  const sort = await nextSortOrder(ctx, "subcategories", "WHERE category_id = $1", [categoryId]);
  const r = await ctx.query(
    `INSERT INTO subcategories (category_id, name, sort_order) VALUES ($1,$2,$3)
     ON CONFLICT (category_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [categoryId, name, sort]
  );
  return { success: true, id: r.rows[0].id, name, categoryId, sortOrder: sort };
}

async function upsertCatalogItem(ctx) {
  ctx.requireAny(["tool.create", "tool.edit"]);
  const name = U.trimmed(ctx.params.name);
  const subcategoryId = U.int(ctx.params.subcategoryId, 0);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  if (!subcategoryId) return { success: false, error: "SUBCATEGORY_REQUIRED" };
  const id = U.int(ctx.params.id, 0);
  if (id) {
    const before = await ctx.query(
      `SELECT i.name, s.name AS subcategory, c.name AS category
         FROM catalog_items i
         JOIN subcategories s ON s.id = i.subcategory_id
         JOIN categories c ON c.id = s.category_id
        WHERE i.id = $1`,
      [id]
    );
    if (!before.rows.length) return { success: false, error: "NOT_FOUND" };
    await ctx.query(`UPDATE catalog_items SET name = $1, subcategory_id = $2 WHERE id = $3`, [
      name,
      subcategoryId,
      id,
    ]);
    if (before.rows[0].name !== name) {
      await ctx.query(
        `UPDATE catalog SET item = $1 WHERE category = $2 AND subcategory = $3 AND item = $4`,
        [name, before.rows[0].category, before.rows[0].subcategory, before.rows[0].name]
      );
    }
    return { success: true, id, name, subcategoryId };
  }
  const sort = await nextSortOrder(ctx, "catalog_items", "WHERE subcategory_id = $1", [subcategoryId]);
  const r = await ctx.query(
    `INSERT INTO catalog_items (subcategory_id, name, sort_order) VALUES ($1,$2,$3)
     ON CONFLICT (subcategory_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [subcategoryId, name, sort]
  );
  return { success: true, id: r.rows[0].id, name, subcategoryId, sortOrder: sort };
}

async function reorderCatalogNodes(ctx) {
  ctx.requireAny(["tool.create", "tool.edit"]);
  const kind = U.trimmed(ctx.params.kind);
  const table =
    kind === "category" ? "categories" : kind === "subcategory" ? "subcategories" : kind === "item" ? "catalog_items" : "";
  if (!table) return { success: false, error: "KIND_REQUIRED" };
  const ids = parseIdList(ctx.params.ids);
  if (!ids.length) return { success: false, error: "IDS_REQUIRED" };
  for (let i = 0; i < ids.length; i += 1) {
    await ctx.query(`UPDATE ${table} SET sort_order = $1 WHERE id = $2`, [i, ids[i]]);
  }
  return { success: true, kind, count: ids.length };
}

async function deleteCategory(ctx) {
  ctx.require("tool.delete");
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const del = await ctx.query(`DELETE FROM categories WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  return { success: true, id };
}

async function deleteSubcategory(ctx) {
  ctx.require("tool.delete");
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const del = await ctx.query(`DELETE FROM subcategories WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  return { success: true, id };
}

async function deleteCatalogItem(ctx) {
  ctx.require("tool.delete");
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const del = await ctx.query(`DELETE FROM catalog_items WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  return { success: true, id };
}

/* -------------------------------------------------------- label studio */

function templateView(row) {
  let config = row.config;
  if (typeof config === "string") {
    try {
      config = JSON.parse(config || "{}");
    } catch {
      config = {};
    }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) config = {};
  return {
    id: row.id,
    name: row.name,
    config,
    byUser: row.by_user || row.created_by || row.updated_by || "",
    createdAt: U.isoOrNull(row.created_at),
    updatedAt: U.isoOrNull(row.updated_at),
  };
}

async function listLabelTemplates(ctx) {
  const r = await ctx.query(`SELECT * FROM label_templates ORDER BY updated_at DESC, id DESC`);
  return { items: r.rows.map(templateView) };
}

async function saveLabelTemplate(ctx) {
  ctx.requireAny(["tool.edit", "tool.create"]);
  const { params } = ctx;
  const query = ctx.query;
  const name = U.trimmed(params.name);
  if (!name) return { success: false, error: "NAME_REQUIRED" };
  const config =
    typeof params.config === "string" ? params.config : JSON.stringify(params.config || {});
  const id = U.int(params.id, 0);

  const configValue =
    typeof config === "string" ? config : JSON.stringify(config || {});

  if (id) {
    const r = await query(
      `UPDATE label_templates
          SET name = $1,
              config = $2::jsonb,
              updated_by = $4,
              updated_at = NOW()
        WHERE id = $3
        RETURNING *`,
      [name, configValue, id, ctx.user.username]
    );
    if (!r.rows.length) return { success: false, error: "NOT_FOUND" };
    return { success: true, item: templateView(r.rows[0]) };
  }

  const r = await query(
    `INSERT INTO label_templates (name, config, created_by, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, $3, NOW()) RETURNING *`,
    [name, configValue, ctx.user.username]
  );
  return { success: true, item: templateView(r.rows[0]) };
}

async function deleteLabelTemplate(ctx) {
  ctx.requireAny(["tool.edit", "tool.create"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const del = await ctx.query(`DELETE FROM label_templates WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  return { success: true, id };
}

module.exports = {
  getCatalogStock,
  getDesc,
  checkCatalogCode,
  getLastCodes,
  upsertProduct,
  deleteProduct,
  bulkUpsertProducts,
  setProductImage,
  getProductImages,
  clearProductImage,
  listCategories,
  upsertCategory,
  upsertSubcategory,
  upsertCatalogItem,
  reorderCatalogNodes,
  deleteCategory,
  deleteSubcategory,
  deleteCatalogItem,
  listLabelTemplates,
  saveLabelTemplate,
  deleteLabelTemplate,
};
