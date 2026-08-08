/**
 * End-to-end smoke test.
 *
 * Boots the schema against DATABASE_URL, seeds a small but representative
 * dataset, then drives every registered action through the real dispatcher and
 * asserts the response shapes the frontend depends on.
 *
 *   DATABASE_URL=postgresql://toolcustody:toolcustody@127.0.0.1:5432/toolcustody \
 *     node test/smoke.js
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { query, pool } = require("../src/db");
const { ensureSchema } = require("../src/schema");
const permissions = require("../src/permissions");
const custody = require("../src/custody");
const { handle, ACTIONS } = require("../src/server");

const TOKEN = "smoketest-admin-token";
const exercised = new Set();
let failures = 0;
let checks = 0;

function ok(label, condition, detail) {
  checks += 1;
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ""}`);
}

async function call(params) {
  if (params.action) exercised.add(params.action);
  const res = await handle({ token: TOKEN, ...params });
  if (res && res.error && res.error !== "NOT_FOUND") {
    // Surface unexpected errors loudly but keep going.
    console.log(`       (${params.action || "scan"} → ${res.error})`);
  }
  return res;
}

async function reset() {
  await query(`DROP TABLE IF EXISTS inventory_count_lines CASCADE`).catch(() => {});
  await query(`DROP TABLE IF EXISTS inventory_count_sheets CASCADE`).catch(() => {});
  await query(`DROP TABLE IF EXISTS inventory_counts CASCADE`).catch(() => {});
  await query(`DROP TABLE IF EXISTS project_dispatch_lines CASCADE`).catch(() => {});
  await query(`DROP TABLE IF EXISTS project_dispatches CASCADE`).catch(() => {});
  const tables = [
    "project_dispatch_lines", "project_dispatches", "project_stock", "projects",
    "warehouse_transfer_lines", "warehouse_transfers", "warehouse_stock",
    "inventory_count_lines", "inventory_counts", "inventory_count_sheets",
    "store_request_lines", "store_requests",
    "user_warehouse_scope", "user_project_scope",
    "qc_calibrations", "label_templates", "terminal_sessions",
    "person_profiles", "product_photos", "catalog_items", "subcategories",
    "categories", "suppliers", "damage", "receiving", "tool_lifecycle",
    "scans", "audit_log", "role_permissions", "catalog", "users", "warehouses",
  ];
  for (const t of tables) {
    await query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`).catch(() => {});
  }
  const { STATEMENTS } = require("../src/schema");
  for (const stmt of STATEMENTS) {
    if (stmt.includes("inventory_count") || stmt.includes("project_dispatch")) {
      await query(stmt).catch(() => {});
    }
  }
}

async function seed() {
  await query(
    `INSERT INTO users (username, password_hash, role, api_token, full_name, approval_status)
     VALUES ($1,$2,'admin',$3,'Smoke Admin','approved')`,
    ["smoke", await bcrypt.hash("Smoke123!", 10), TOKEN]
  );
  await query(
    `INSERT INTO warehouses (name, is_main) VALUES ('Main Warehouse', TRUE)
     ON CONFLICT (name) DO UPDATE SET is_main = TRUE`
  );
  await query(
    `INSERT INTO warehouses (name, is_main) VALUES ('Site Store', FALSE)
     ON CONFLICT (name) DO NOTHING`
  );
  const mainWh = await query(`SELECT id FROM warehouses WHERE is_main = TRUE ORDER BY id ASC LIMIT 1`);
  const mainWarehouseId = mainWh.rows[0].id;

  const products = [
    ["I1-A", "WELDING MASK", "tool", "PPE", "Head", 2, true],
    ["I2-A", "GRINDER FACE SHIELD", "tool", "PPE", "Head", 1, false],
    ["E20-A", "SMALL GRINDER", "tool", "Power Tools", "Grinders", 1, true],
    ["C12-A", "WELDING GLOVES (LONG)", "consumable", "PPE", "Hands", 10, false],
    ["C12-B", "MECHANICAL GLOVES", "consumable", "PPE", "Hands", 10, false],
    ["C13-B", "SAFTEY SUNGLASS", "consumable", "PPE", "Eyes", 10, false],
    ["B1-A", "ANCHOR BOLTS", "tool", "Fixings", "Bolts", 5, false],
  ];
  for (const [code, description, kind, category, subcategory, minStock, serialized] of products) {
    await query(
      `INSERT INTO catalog (code, description, kind, category, subcategory, min_stock, price, serialized)
       VALUES ($1,$2,$3,$4,$5,$6,25,$7)`,
      [code, description, kind, category, subcategory, minStock, serialized]
    );
    await query(
      `INSERT INTO warehouse_stock (warehouse_id, code, qty) VALUES ($1,$2,10)`,
      [mainWarehouseId, code]
    );
    await query(
      `INSERT INTO receiving (code, description, qty, warehouse_id, by_user)
       VALUES ($1,$2,10,$3,'smoke')`,
      [code, description, mainWarehouseId]
    );
  }
  await query(
    `INSERT INTO catalog (code, description, kind, calibration_required, calibration_next_due)
     VALUES ('E30-Q','TORQUE WRENCH','tool',TRUE, CURRENT_DATE + 5)`
  );
  await query(`INSERT INTO warehouse_stock (warehouse_id, code, qty) VALUES ($1,'E30-Q',3)`, [mainWarehouseId]);
  await query(
    `INSERT INTO receiving (code, description, qty, warehouse_id, by_user)
     VALUES ('E30-Q','TORQUE WRENCH',3,$1,'smoke')`,
    [mainWarehouseId]
  );

  await query(`INSERT INTO suppliers (name, phone) VALUES ('HALIM','0500000000')`);
  for (const [code, name] of [["P101", "MD ALI AKBAR"], ["P177", "RAFIQ ISLAM"]]) {
    await query(`INSERT INTO catalog (code, description, kind) VALUES ($1,$2,'person')`, [code, name]);
    await query(
      `INSERT INTO person_profiles (code, residence_no, phone, supervisor_name, supplier_id)
       VALUES ($1,'2618169649','0512345678','FOREMAN',1)`,
      [code]
    );
  }

  // Scan tape: P101 takes two tools and returns one; P177 takes one + gloves.
  const tape = [
    ["P101", -8], ["OUT", -8], ["I1-A", -8], ["E20-A", -8],
    ["P101", -2], ["IN", -2], ["I1-A", -2],
    ["P177", -1], ["OUT", -1], ["I2-A", -1], ["C12-A", -1], ["B1-A", -1],
  ];
  for (const [code, daysAgo] of tape) {
    const at = new Date(Date.now() + daysAgo * 86400000);
    const rowDate = `{${String(at.getDate()).padStart(2, "0")}/${String(at.getMonth() + 1).padStart(2, "0")}/${at.getFullYear()}}`;
    await query(
      `INSERT INTO scans (tool_code, scanned_at, row_date, created_by, device_id, session_id)
       VALUES ($1,$2,$3,'smoke','dev_test','ses_test')`,
      [code, at, rowDate]
    );
  }
  custody.invalidate();
}

/* ------------------------------------------------------------------ suites */

async function testAuth() {
  console.log("\nauth / users");
  const bad = await handle({ action: "login", user: "smoke", pass: "nope" });
  ok("login rejects a wrong password", bad.success === false, bad);

  const good = await handle({ action: "login", user: "smoke", pass: "Smoke123!" });
  ok("login returns token + permissions", good.success === true && good.token === TOKEN, good);
  ok("login role is normalized", good.role === "admin", good.role);
  ok("admin gets the whole permission catalog", good.permissions.length === permissions.PERMISSIONS.length);
  exercised.add("login");

  ok("unauthenticated calls are rejected", (await handle({ action: "listUsers" })).error === "UNAUTHORIZED");

  const users = await call({ action: "listUsers" });
  ok("listUsers shape", Array.isArray(users.items) && users.items[0].scopes, users.items && users.items[0]);

  const created = await call({
    action: "createUser",
    username: "storekeeper",
    password: "Store123!",
    role: "employee",
    warehouseIds: JSON.stringify([1]),
    projectIds: "[]",
  });
  ok("createUser", created.success === true, created);

  ok("updateUser role", (await call({ action: "updateUser", username: "storekeeper", role: "logistics" })).success);
  ok("approveUser", (await call({ action: "approveUser", username: "storekeeper" })).success);
  ok("rejectUser", (await call({ action: "rejectUser", username: "storekeeper" })).success);

  const reg = await handle({ action: "registerUser", username: "newbie", password: "Newbie123!", role: "engineer" });
  ok("registerUser leaves the account pending", reg.success === true && reg.pending === true, reg);
  exercised.add("registerUser");

  ok("deleteUser", (await call({ action: "deleteUser", username: "storekeeper" })).success);

  const perms = await call({ action: "listPermissions" });
  ok("listPermissions catalog + matrices", perms.items.length > 0 && !!perms.roles.employee);

  const setPerms = await call({
    action: "setRolePermissions",
    role: "employee",
    permissions: ["terminal.use", "tool.view", "bogus.code"],
  });
  ok("setRolePermissions drops unknown codes", setPerms.permissions.length === 2, setPerms.permissions);

  const mine = await call({ action: "getMyPermissions" });
  ok("getMyPermissions", mine.role === "admin" && Array.isArray(mine.permissions));

  ok("getMyProfile", (await call({ action: "getMyProfile" })).username === "smoke");
  ok("updateMyProfile", (await call({ action: "updateMyProfile", fullName: "Smoke Admin", phone: "0500" })).success);
  ok("changeMyPassword rejects a wrong current password",
    (await call({ action: "changeMyPassword", currentPassword: "wrong", newPassword: "Another123!" })).error === "WRONG_PASSWORD");
}

async function testCustody() {
  console.log("\ncustody ledger");
  const outstanding = await call({ action: "getOutstanding", overdueDays: 1 });
  ok("getOutstanding returns overdueDays/items/totals",
    outstanding.overdueDays === 1 && Array.isArray(outstanding.items) && !!outstanding.totals, Object.keys(outstanding));
  ok("two people still hold tools", outstanding.totals.people === 2, outstanding.totals);
  // E20-A with P101; I2-A + B1-A with P177. C12-A is a consumable, never custody.
  ok("three tool units are out", outstanding.totals.tools === 3, outstanding.totals);

  const p101 = outstanding.items.find((p) => p.code === "P101");
  ok("returned tool cleared from custody", p101 && p101.tools.every((t) => t.code !== "I1-A"), p101 && p101.tools);
  ok("person carries profile fields", p101 && p101.supplierName === "HALIM" && p101.residenceNo === "2618169649");
  ok("tool lots include takenAt/daysOut/overdue",
    p101 && p101.tools[0].lots[0].takenAt && p101.tools[0].lots[0].daysOut >= 7, p101 && p101.tools[0].lots[0]);
  ok("consumables never become custody",
    !outstanding.items.some((p) => p.tools.some((t) => t.code === "C12-A")));

  const person = await call({ action: "getPersonCustody", code: "P101", overdueDays: 1 });
  ok("getPersonCustody stats", person.stats.totalTaken === 2 && person.stats.totalReturned === 1, person.stats);
  ok("getPersonCustody events", person.events.length === 3, person.events.length);
  ok("getPersonCustody flags overdue", person.overdue === true && person.maxDaysOut >= 7, person.maxDaysOut);

  const holder = await call({ action: "lookupToolHolder", code: "E20-A", personCode: "P177" });
  ok("lookupToolHolder finds the other holder", holder.held === true && holder.holder.personCode === "P101", holder);
  const self = await call({ action: "lookupToolHolder", code: "E20-A", personCode: "P101" });
  ok("lookupToolHolder detects self-return", self.clearsFromSelf === true, self);

  const desc = await call({ action: "getDesc", code: "P101", overdueDays: 1 });
  ok("getDesc on a person returns held tools", desc.toolsHeldQty === 1 && desc.toolsHeld.length === 1, desc.toolsHeldQty);
  ok("getDesc on a product", (await call({ action: "getDesc", code: "I1-A" })).description === "WELDING MASK");
  ok("getDesc on an unknown code",
    (await call({ action: "getDesc", code: "ZZ9" })).description === "DESCRIPTION NOT FOUND");
}

async function testTerminal() {
  console.log("\nterminal");
  const keys = { deviceId: "dev_smoke", sessionId: "ses_smoke" };
  const acquired = await call({ action: "acquireTerminalSession", ...keys });
  ok("acquireTerminalSession", acquired.success === true, acquired);

  const clash = await call({ action: "acquireTerminalSession", deviceId: "dev_other", sessionId: "ses_other" });
  ok("second session conflicts", clash.error === "TERMINAL_SESSION_CONFLICT", clash);

  ok("heartbeatTerminalSession", (await call({ action: "heartbeatTerminalSession", ...keys })).success);
  ok("heartbeat rejects a stale session id",
    (await call({ action: "heartbeatTerminalSession", deviceId: "dev_smoke", sessionId: "ses_stale" })).error
      === "TERMINAL_SESSION_CONFLICT");

  const check = await call({ action: "checkScanCode", code: "I1-A", expectKind: "item" });
  ok("checkScanCode accepts a known product", check.ok === true && check.serialized === true, check);
  ok("checkScanCode rejects unknown codes",
    (await call({ action: "checkScanCode", code: "NOPE1" })).error === "UNKNOWN_CODE");
  ok("checkScanCode enforces expectKind",
    (await call({ action: "checkScanCode", code: "I1-A", expectKind: "person" })).error === "NOT_A_PERSON");

  // Scan a person + OUT + tool through the bare scanData path.
  for (const code of ["P101", "OUT", "I1-A"]) {
    const res = await call({ scanData: code, ...keys });
    ok(`scan ${code} accepted`, res.status === "OK", res);
  }
  ok("unknown scan codes are refused", (await call({ scanData: "QQ9", ...keys })).error === "UNKNOWN_CODE");
  ok("scans without a lease are refused",
    (await call({ scanData: "I1-A", deviceId: "dev_ghost", sessionId: "ses_ghost" })).error
      === "TERMINAL_SESSION_REQUIRED");

  const after = await call({ action: "getPersonCustody", code: "P101" });
  ok("fresh scan lands in custody immediately", after.toolsHeldQty === 2, after.toolsHeldQty);

  const ppe = await call({ action: "checkPpeCooldownoldown", personCode: "P177", itemCode: "C12-A" });
  ok("PPE cooldown recognises the gloves family", ppe.applies === true && ppe.family === "gloves", ppe);
  ok("PPE cooldown is restricted inside the window", ppe.restricted === true && ppe.daysLeft > 0, ppe);
  exercised.add("checkPpeCooldown");

  // Per-SKU: P177 took C12-A yesterday — C12-B (mechanical) must still be allowed.
  const ppeOtherSku = await call({ action: "checkPpeCooldownoldown", personCode: "P177", itemCode: "C12-B" });
  ok("PPE cooldown is per product code, not whole gloves family",
    ppeOtherSku.applies === true && ppeOtherSku.restricted === false, ppeOtherSku);

  // P177 drew C12-A yesterday, so re-issuing the same SKU must trip the cooldown.
  await call({ scanData: "P177", ...keys });
  await call({ scanData: "OUT", ...keys });
  const blocked = await call({ scanData: "C12-A", ...keys });
  ok("PPE re-issue is blocked at scan time", blocked.error === "PPE_COOLDOWN", blocked);
  const otherSkuOk = await call({ scanData: "C12-B", ...keys });
  ok("different glove SKU is not blocked by another SKU cooldown", otherSkuOk.status === "OK", otherSkuOk);
  const forced = await call({ scanData: "C12-A", ppeOverride: "1", ...keys });
  ok("PPE override lets it through", forced.status === "OK", forced);

  ok("releaseTerminalSession", (await call({ action: "releaseTerminalSession", ...keys })).success);
  ok("resetTerminalSession", (await call({ action: "resetTerminalSession" })).success);
}

async function testCatalog() {
  console.log("\ncatalog / products");
  const stockList = await call({ action: "getCatalogStock" });
  const mask = stockList.items.find((i) => i.code === "I1-A");
  ok("getCatalogStock totals", stockList.totals.products === 8, stockList.totals);
  // 10 received, 1 unit still out with P101 after the terminal suite.
  ok("available = received − damaged − custody", mask.available === 9 && mask.out === 1, mask);
  ok("item carries qc + image + minStock fields",
    "qcStatus" in mask && "imageUrl" in mask && mask.minStock === 2);
  const torque = stockList.items.find((i) => i.code === "E30-Q");
  ok("calibration due soon is flagged", torque.qcStatus === "Due soon", torque.qcStatus);

  ok("checkCatalogCode free code", (await call({ action: "checkCatalogCode", code: "I99-Z" })).available === true);
  ok("checkCatalogCode taken by a product",
    (await call({ action: "checkCatalogCode", code: "I1-A" })).error === "CODE_EXISTS");
  ok("checkCatalogCode taken by a person",
    (await call({ action: "checkCatalogCode", code: "P101" })).error === "CODE_USED_BY_PERSON");

  const last = await call({ action: "getLastCodes" });
  const bucketE = last.items.find((i) => i.prefix === "E");
  ok("getLastCodes suggests the next number", bucketE.highestCode === "E30-Q" && bucketE.suggestedCode === "E31", bucketE);

  const created = await call({
    action: "upsertProduct", code: "I50-N", description: "NEW TOOL",
    category: "PPE", subcategory: "Head", minStock: "3", stockQty: "12", isEdit: "0",
  });
  ok("upsertProduct create", created.success === true, created);
  const afterCreate = await call({ action: "getCatalogStock" });
  ok("stockQty lands on available",
    afterCreate.items.find((i) => i.code === "I50-N").available === 12);

  ok("upsertProduct blocks duplicate codes",
    (await call({ action: "upsertProduct", code: "I50-N", description: "DUP", isEdit: "0" })).error === "CODE_EXISTS");
  ok("upsertProduct demands a due date when calibration is required",
    (await call({ action: "upsertProduct", code: "I50-N", description: "NEW TOOL",
      calibrationRequired: "1", isEdit: "1" })).error === "CALIBRATION_DUE_REQUIRED");

  const bulk = await call({
    action: "bulkUpsertProducts",
    mode: "upsert",
    rows: [
      { row: 1, code: "I60-A", description: "IMPORTED ONE", category: "Fixings", stockQty: 4 },
      { row: 2, code: "I1-A", description: "WELDING MASK V2" },
      { row: 3, code: "", description: "no code" },
    ],
  });
  ok("bulkUpsertProducts counts", bulk.created === 1 && bulk.updated === 1 && bulk.failed === 1, bulk);

  ok("deleteProduct blocks while in custody",
    (await call({ action: "deleteProduct", code: "I1-A" })).error === "HAS_CUSTODY");
  ok("deleteProduct", (await call({ action: "deleteProduct", code: "I60-A" })).success);

  ok("setProductImage", (await call({
    action: "setProductImage", code: "I50-N",
    imageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  })).success);
  ok("getProductImages", Object.keys((await call({ action: "getProductImages" })).images).length === 1);
  ok("clearProductImage", (await call({ action: "clearProductImage", code: "I50-N" })).success);

  console.log("\ncategories / labels");
  const cat = await call({ action: "upsertCategory", name: "Power Tools" });
  const sub = await call({ action: "upsertSubcategory", name: "Grinders", categoryId: cat.id });
  const item = await call({ action: "upsertCatalogItem", name: "Angle grinder", subcategoryId: sub.id });
  const cats = await call({ action: "listCategories" });
  ok("listCategories three levels",
    cats.categories.length === 1 && cats.subcategories[0].categoryId === cat.id && cats.items[0].subcategoryId === sub.id,
    cats);
  ok("deleteCatalogItem", (await call({ action: "deleteCatalogItem", id: item.id })).success);
  ok("deleteSubcategory", (await call({ action: "deleteSubcategory", id: sub.id })).success);
  ok("deleteCategory", (await call({ action: "deleteCategory", id: cat.id })).success);

  const tpl = await call({ action: "saveLabelTemplate", name: "Asset 50x30", config: { w: 50, h: 30 } });
  ok("saveLabelTemplate", tpl.success && tpl.item.config.w === 50, tpl);
  const tpls = await call({ action: "listLabelTemplates" });
  ok("listLabelTemplates parses config", tpls.items[0].config.h === 30, tpls.items[0]);
  ok("saveLabelTemplate update", (await call({
    action: "saveLabelTemplate", id: tpl.item.id, name: "Asset 50x30", config: '{"w":60}',
  })).item.config.w === 60);
  ok("deleteLabelTemplate", (await call({ action: "deleteLabelTemplate", id: tpl.item.id })).success);
}

async function testPeople() {
  console.log("\npeople / suppliers");
  const list = await call({ action: "listPeople" });
  ok("listPeople totals", list.totals.people === 2 && list.totals.withTools === 2, list.totals);
  ok("listPeople carries holdings + profile",
    list.items[0].toolsHeldCount > 0 && list.items[0].supplierName === "HALIM", list.items[0]);

  const made = await call({
    action: "upsertPerson", code: "P900", name: "TEST WORKER",
    residenceNo: "111", phone: "222", supervisorName: "BOSS", supplierName: "NEW SUPPLIER", isEdit: "0",
  });
  ok("upsertPerson creates the person and the supplier", made.success && made.supplierId > 0, made);
  ok("upsertPerson rejects non-P codes",
    (await call({ action: "upsertPerson", code: "I1-A", name: "X" })).error === "CODE_MUST_START_WITH_P");

  const renamed = await call({
    action: "upsertPerson", code: "P901", originalCode: "P900", name: "TEST WORKER", isEdit: "1",
  });
  ok("upsertPerson renames a code", renamed.success === true, renamed);
  const afterRename = await call({ action: "listPeople" });
  ok("rename leaves exactly one row", afterRename.items.filter((p) => p.code === "P901").length === 1
    && !afterRename.items.some((p) => p.code === "P900"));

  ok("deletePerson asks before dropping custody",
    (await call({ action: "deletePerson", code: "P101" })).error === "HAS_TOOLS");
  ok("deletePerson force", (await call({ action: "deletePerson", code: "P101", force: "1" })).success);
  ok("deletePerson clean", (await call({ action: "deletePerson", code: "P901" })).success);

  const sup = await call({ action: "upsertSupplier", name: "ACME", phone: "0999" });
  ok("upsertSupplier", sup.success === true, sup);
  ok("listSuppliers", (await call({ action: "listSuppliers" })).items.length >= 2);
  ok("deleteSupplier blocks while people are linked",
    (await call({ action: "deleteSupplier", id: 1 })).error === "SUPPLIER_IN_USE");
  ok("deleteSupplier", (await call({ action: "deleteSupplier", id: sup.id })).success);
  ok("setPersonIdImage", (await call({
    action: "setPersonIdImage", code: "P177",
    imageBase64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  })).success);
  ok("clearPersonIdImage", (await call({ action: "clearPersonIdImage", code: "P177" })).success);
}

async function testWarehouses() {
  console.log("\nwarehouses");
  const list = await call({ action: "listWarehouses" });
  ok("listWarehouses marks the main one", list.items[0].isMain === true, list.items[0]);
  const mainId = list.items.find((w) => w.isMain).id;
  const siteId = list.items.find((w) => !w.isMain).id;

  const made = await call({ action: "createWarehouse", name: "Yard" });
  ok("createWarehouse", made.success === true, made);
  ok("createWarehouse rejects duplicates",
    (await call({ action: "createWarehouse", name: "Yard" })).error === "NAME_TAKEN");
  ok("deleteWarehouse", (await call({ action: "deleteWarehouse", id: made.item.id })).success);
  ok("deleteWarehouse protects the main warehouse",
    (await call({ action: "deleteWarehouse", id: mainId })).error === "CANNOT_DELETE_MAIN");

  const stockView = await call({ action: "listWarehouseStock", warehouseId: mainId });
  ok("listWarehouseStock", stockView.items.length > 0 && stockView.items[0].description, stockView.items[0]);

  ok("createWarehouseTransfer needs stock",
    (await call({
      action: "createWarehouseTransfer", fromWarehouseId: mainId, toWarehouseId: siteId,
      lines: JSON.stringify([{ code: "I1-A", qty: 999 }]),
    })).error === "INSUFFICIENT_STOCK");

  const xfer = await call({
    action: "createWarehouseTransfer", fromWarehouseId: mainId, toWarehouseId: siteId, note: "restock",
    lines: JSON.stringify([{ code: "I1-A", qty: 3 }]),
  });
  ok("createWarehouseTransfer", xfer.success && /^TR-\d{4}-\d{4}$/.test(xfer.transfer.formNo), xfer.transfer);
  ok("transfer moved the stock", (await call({ action: "listWarehouseStock", warehouseId: siteId }))
    .items.find((i) => i.code === "I1-A").qty === 3);
  ok("listWarehouseTransfers", (await call({ action: "listWarehouseTransfers" })).items.length === 1);
  const detail = await call({ action: "getWarehouseTransfer", id: xfer.transfer.id });
  ok("getWarehouseTransfer lines", detail.transfer.lines[0].qty === 3, detail.transfer.lines);

  const sheet = await call({
    action: "createInventoryCountSheet", locationType: "warehouse", warehouseId: mainId, countType: "full",
  });
  ok("createInventoryCountSheet", sheet.success && sheet.sheet.lines.length > 0, sheet.sheet && sheet.sheet.formNo);
  ok("createInventoryCountSheet frontend shape", sheet.count && sheet.count.formNo && sheet.lines.length > 0, sheet);
  ok("count sheet needs a category for category counts",
    (await call({ action: "createInventoryCountSheet", locationType: "warehouse", warehouseId: mainId, countType: "category" }))
      .error === "CATEGORY_REQUIRED");
}

async function testProjects() {
  console.log("\nprojects");
  const made = await call({ action: "upsertProject", code: "PRJ01", name: "Opera House", site: "Jeddah" });
  ok("upsertProject", made.success === true, made);
  const projectId = made.item.id;
  ok("upsertProject rejects duplicate codes",
    (await call({ action: "upsertProject", code: "PRJ01", name: "Clash" })).error === "CODE_EXISTS");

  const dispatch = await call({
    action: "createProjectDispatch", projectId, recipientName: "Driver One", vehiclePlate: "ABC-123",
    lines: [{ code: "E20-A", qty: 2, condition: "Good" }, { code: "B1-A", qty: 1, condition: "Good" }],
  });
  ok("createProjectDispatch", dispatch.success && /^PDN-\d{4}-\d{4}$/.test(dispatch.formNo), dispatch.formNo);
  ok("dispatch needs enough stock",
    (await call({
      action: "createProjectDispatch", projectId, recipientName: "Driver",
      lines: [{ code: "E20-A", qty: 500 }],
    })).error === "INSUFFICIENT_STOCK");

  const project = await call({ action: "getProject", id: projectId });
  ok("getProject holdings", project.holdings.reduce((s, h) => s + h.qty, 0) === 3, project.holdings);
  ok("getProject dispatches", project.dispatches.length === 1 && project.dispatches[0].totalQty === 3);

  const listed = await call({ action: "listProjects" });
  ok("listProjects totals", listed.totals.toolsAtProjects === 3 && listed.totals.projectsWithStock === 1, listed.totals);
  ok("listProjects rolls up dispatch counts", listed.items[0].dispatchCount === 1);

  const dispatchId = dispatch.dispatch.id;
  const updated = await call({
    action: "updateProjectDispatch", id: dispatchId, recipientName: "Driver Two",
    lines: [{ code: "E20-A", qty: 1, condition: "Fair" }, { code: "B1-A", qty: 1 }],
  });
  ok("updateProjectDispatch rebalances stock", updated.success === true, updated);
  ok("project holdings follow the edit",
    (await call({ action: "getProject", id: projectId })).holdings.reduce((s, h) => s + h.qty, 0) === 2);

  const ret = await call({
    action: "returnProjectTools", projectId, recipientName: "Driver Two",
    lines: [{ code: "B1-A", qty: 1 }],
  });
  ok("returnProjectTools", ret.success && /^PRT-/.test(ret.formNo), ret.formNo);
  ok("returns reduce site stock",
    (await call({ action: "getProject", id: projectId })).holdings.reduce((s, h) => s + h.qty, 0) === 1);

  ok("getProjectDispatch", (await call({ action: "getProjectDispatch", id: dispatchId })).dispatch.lines.length === 2);
  ok("deleteProject blocks while stock is on site",
    (await call({ action: "deleteProject", id: projectId })).error === "PROJECT_HAS_STOCK");

  ok("deleteProjectDispatch reverses the return",
    (await call({ action: "deleteProjectDispatch", id: ret.dispatch.id })).success);
  ok("deleteProjectDispatch", (await call({ action: "deleteProjectDispatch", id: dispatchId })).success);
  ok("deleteProject", (await call({ action: "deleteProject", id: projectId })).success);
}

async function testInventory() {
  console.log("\nreceiving / damage / dashboard");
  ok("receiveItem demands an invoice or DN",
    (await call({ action: "receiveItem", code: "I1-A", description: "WELDING MASK" }))
      .error === "INVOICE_OR_DN_REQUIRED");

  const before = (await call({ action: "listWarehouseStock", warehouseId: 1 }))
    .items.find((i) => i.code === "I1-A").qty;
  const recv = await call({
    action: "receiveItem", code: "I1-A", description: "WELDING MASK",
    qty: "5", supplier: "HALIM", invoice: "INV-1", cost: "100",
  });
  ok("receiveItem", recv.success === true, recv);
  ok("receiving raises warehouse stock",
    (await call({ action: "listWarehouseStock", warehouseId: 1 })).items.find((i) => i.code === "I1-A").qty
      === before + 5);
  ok("getReceiving", (await call({ action: "getReceiving" })).items[0].invoice === "INV-1");

  const dmg = await call({
    action: "submitDamage", toolCode: "I2-A", personCode: "P177", qty: "2", remark: "Cracked",
  });
  ok("submitDamage", dmg.success === true, dmg);
  ok("getDamage", (await call({ action: "getDamage" })).items[0].code === "I2-A");
  ok("getDamageDates", (await call({ action: "getDamageDates" })).length === 1);
  ok("damage removes units from the shelf",
    (await call({ action: "listWarehouseStock", warehouseId: 1 })).items.find((i) => i.code === "I2-A").qty === 8);
  const outstandingAfterDmg = await call({ action: "getOutstanding" });
  const p177AfterDmg = (outstandingAfterDmg.items || []).find((p) => p.code === "P177");
  const stillHoldsI2 = !!(p177AfterDmg && (p177AfterDmg.tools || []).some((t) => t.code === "I2-A"));
  ok("damage clears tool from Not returned / outstanding", !stillHoldsI2, {
    custodyCleared: dmg.custodyCleared,
    p177: p177AfterDmg,
  });
  ok("other tools remain outstanding after damage",
    !!(p177AfterDmg && (p177AfterDmg.tools || []).some((t) => t.code === "B1-A")), p177AfterDmg);

  ok("setLifecycle rejects unknown states",
    (await call({ action: "setLifecycle", code: "I2-A", state: "Exploded" })).error === "Invalid state");
  ok("setLifecycle", (await call({ action: "setLifecycle", code: "I2-A", state: "Under Repair" })).success);
  const lifecycle = await call({ action: "getLifecycle", code: "I2-A" });
  ok("getLifecycle keeps only the latest state", lifecycle.items[0].state === "Under Repair", lifecycle.items);

  const dash = await call({ action: "getInventoryDashboard", days: 30 });
  ok("dashboard kpis", dash.kpis.totalProducts > 0 && typeof dash.kpis.inventoryValue === "number", dash.kpis);
  ok("dashboard movement covers the window", dash.movement.length === 30, dash.movement.length);
  ok("dashboard alert buckets",
    !!dash.alerts.reorder && !!dash.alerts.pendingRequests && !!dash.alerts.stagnant && !!dash.alerts.expiring);
  ok("dashboard tables", !!dash.tables.reorderList && !!dash.tables.recentActivities && !!dash.tables.recentReceiving);
  ok("dashboard exposes categories", Array.isArray(dash.categories) && dash.categories.includes("PPE"));
  ok("dashboard flags the calibration due soon",
    dash.alerts.expiring.some((e) => e.code === "E30-Q"), dash.alerts.expiring);
}

async function testRequests() {
  console.log("\nstore requests");
  const made = await call({
    action: "createStoreRequest", note: "urgent",
    lines: [{ code: "C12-A", description: "GLOVES", qty: 4 }, { code: "I2-A", description: "SHIELD", qty: 1 }],
  });
  ok("createStoreRequest", made.success && made.lines === 2, made);

  const list = await call({ action: "getStoreRequests" });
  const req = list.items[0];
  ok("getStoreRequests progress", req.progress.linesTotal === 2 && req.progress.pct === 0, req.progress);
  ok("request lines carry remaining qty", req.lines[0].qtyRemaining === 4, req.lines[0]);

  await call({
    action: "receiveItem", code: "C12-A", description: "GLOVES", qty: "4", invoice: "INV-2",
    requestId: req.id, requestLineId: req.lines[0].id,
  });
  const afterRecv = await call({ action: "getStoreRequests" });
  ok("receiving settles the request line",
    afterRecv.items[0].lines[0].lineStatus === "done" && afterRecv.items[0].progress.linesDone === 1,
    afterRecv.items[0].progress);
  ok("partially received requests flip to Partial", afterRecv.items[0].status === "Partial", afterRecv.items[0].status);

  ok("cancelStoreRequest", (await call({ action: "cancelStoreRequest", id: req.id })).success);
  ok("deleteStoreRequest", (await call({ action: "deleteStoreRequest", id: req.id })).success);
}

async function testQc() {
  console.log("\nQC");
  const list = await call({ action: "listQcItems", status: "all" });
  ok("listQcItems summary", list.summary.total === 1 && list.summary.dueSoon === 1, list.summary);
  ok("listQcItems filter", (await call({ action: "listQcItems", status: "overdue" })).items.length === 0);

  ok("recordCalibration demands a next due date",
    (await call({ action: "recordCalibration", code: "E30-Q" })).error === "CALIBRATION_DUE_REQUIRED");
  const rec = await call({
    action: "recordCalibration", code: "E30-Q",
    calibrationLastDone: "2026-01-01", calibrationNextDue: "2027-01-01", notes: "annual",
  });
  ok("recordCalibration", rec.success === true, rec);
  ok("calibration moves the item back to OK",
    (await call({ action: "listQcItems", status: "all" })).summary.ok === 1);
}

async function testLogs() {
  console.log("\nlogs / audit");
  ok("getDates", (await call({ action: "getDates" })).length > 0);
  const data = await call({ action: "getData", date: "" });
  ok("getData legacy tape shape", !!data[0].toolCode && "isTargetDay" in data[0], data[0]);

  const log = await call({ action: "getScanLog", limit: 100 });
  ok("getScanLog classifies rows",
    log.items.some((i) => i.type === "person") && log.items.some((i) => i.type === "direction")
      && log.items.some((i) => i.type === "consumable"), log.items.slice(0, 3));

  const search = await call({ action: "searchAll", q: "WELD" });
  ok("searchAll finds catalog matches", search.catalog.length > 0, search.catalog);

  ok("auditLog", (await call({ action: "auditLog", auditAction: "TEST_EVENT", detail: "smoke" })).success);
  const audit = await call({ action: "getAuditLog" });
  ok("getAuditLog", audit.items.some((a) => a.action === "TEST_EVENT"), audit.items.length);
}

async function testPermissionGate() {
  console.log("\npermission gate");
  await query(
    `INSERT INTO users (username, password_hash, role, api_token, approval_status)
     VALUES ('eng', 'x', 'engineer', 'engineer-token', 'approved')`
  );
  await query(
    `INSERT INTO role_permissions (role, permission_code) VALUES ('engineer','request.create')
     ON CONFLICT DO NOTHING`
  );
  const denied = await handle({ token: "engineer-token", action: "listUsers" });
  ok("a role without users.manage is refused", denied.error === "FORBIDDEN", denied);
  const allowed = await handle({
    token: "engineer-token", action: "createStoreRequest",
    lines: [{ code: "C12-A", qty: 1 }],
  });
  ok("a granted permission passes", allowed.success === true, allowed);
}

/* --------------------------------------------------------------------- run */

async function main() {
  await ensureSchema(query);
  await permissions.seedPermissions(query);
  await reset();
  await seed();

  await testAuth();
  await testCustody();
  await testTerminal();
  await testCatalog();
  await testPeople();
  await testWarehouses();
  await testProjects();
  await testInventory();
  await testRequests();
  await testQc();
  await testLogs();
  await testPermissionGate();

  console.log("\ncoverage");
  const missing = Object.keys(ACTIONS).filter((a) => !exercised.has(a));
  ok(`every registered action is exercised (${exercised.size}/${Object.keys(ACTIONS).length})`,
    missing.length === 0, missing);

  console.log(`\n${checks - failures}/${checks} checks passed`);
  await pool.end();
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
