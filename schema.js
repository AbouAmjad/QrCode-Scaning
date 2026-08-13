/**
 * Additive, idempotent schema guard.
 *
 * Runs on every boot. Every statement is CREATE ... IF NOT EXISTS or
 * ALTER TABLE ... ADD COLUMN IF NOT EXISTS, so it never drops or rewrites
 * production rows. Existing installs simply no-op.
 */

const STATEMENTS = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

  /* ---------------------------------------------------------------- users */
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     username TEXT UNIQUE NOT NULL,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'employee',
     api_token TEXT UNIQUE NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'`,

  /* -------------------------------------------------------------- catalog */
  `CREATE TABLE IF NOT EXISTS catalog (
     code TEXT PRIMARY KEY,
     description TEXT NOT NULL DEFAULT '',
     kind TEXT NOT NULL DEFAULT 'tool',
     category TEXT NOT NULL DEFAULT '',
     subcategory TEXT NOT NULL DEFAULT '',
     unit TEXT NOT NULL DEFAULT 'pcs',
     min_stock NUMERIC NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'pcs'`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS min_stock NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS item TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS price NUMERIC NOT NULL DEFAULT 0`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS serialized BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS calibration_required BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS calibration_last_done DATE`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS calibration_next_due DATE`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS calibration_notes TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE catalog ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,

  /* ---------------------------------------------------------------- scans */
  `CREATE TABLE IF NOT EXISTS scans (
     id BIGSERIAL PRIMARY KEY,
     tool_code TEXT NOT NULL,
     scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     row_date TEXT NOT NULL,
     created_by TEXT
   )`,
  `ALTER TABLE scans ADD COLUMN IF NOT EXISTS device_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE scans ADD COLUMN IF NOT EXISTS session_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE scans ADD COLUMN IF NOT EXISTS client_seq BIGINT`,
  `CREATE INDEX IF NOT EXISTS idx_scans_code ON scans (tool_code)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_date ON scans (row_date)`,
  `CREATE INDEX IF NOT EXISTS idx_scans_at ON scans (scanned_at)`,

  /* ------------------------------------------------------------ receiving */
  `CREATE TABLE IF NOT EXISTS receiving (
     id BIGSERIAL PRIMARY KEY,
     code TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     supplier TEXT DEFAULT '',
     invoice TEXT DEFAULT '',
     po TEXT DEFAULT '',
     cost TEXT DEFAULT '',
     warranty TEXT DEFAULT '',
     qty NUMERIC NOT NULL DEFAULT 1,
     by_user TEXT DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE receiving ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE receiving ADD COLUMN IF NOT EXISTS subcategory TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE receiving ADD COLUMN IF NOT EXISTS warehouse_id INTEGER`,
  `ALTER TABLE receiving ADD COLUMN IF NOT EXISTS request_id BIGINT`,
  `ALTER TABLE receiving ADD COLUMN IF NOT EXISTS request_line_id BIGINT`,

  /* --------------------------------------------------------------- damage */
  `CREATE TABLE IF NOT EXISTS damage (
     id BIGSERIAL PRIMARY KEY,
     tool_code TEXT NOT NULL,
     tool_name TEXT DEFAULT '',
     image_url TEXT DEFAULT '',
     damaged_by TEXT NOT NULL,
     qty INTEGER NOT NULL DEFAULT 1,
     remark TEXT DEFAULT '',
     row_date TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ------------------------------------------------------- product photos */
  `CREATE TABLE IF NOT EXISTS product_photos (
     code TEXT PRIMARY KEY,
     image_url TEXT NOT NULL,
     by_user TEXT DEFAULT '',
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ------------------------------------------------------- store requests */
  `CREATE TABLE IF NOT EXISTS store_requests (
     id BIGSERIAL PRIMARY KEY,
     by_user TEXT DEFAULT '',
     role TEXT DEFAULT 'engineer',
     items TEXT NOT NULL,
     note TEXT DEFAULT '',
     status TEXT NOT NULL DEFAULT 'Open',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE store_requests ALTER COLUMN items DROP NOT NULL`,
  `ALTER TABLE store_requests ALTER COLUMN items SET DEFAULT ''`,
  `CREATE TABLE IF NOT EXISTS store_request_lines (
     id BIGSERIAL PRIMARY KEY,
     request_id BIGINT NOT NULL REFERENCES store_requests(id) ON DELETE CASCADE,
     code TEXT NOT NULL DEFAULT '',
     description TEXT NOT NULL DEFAULT '',
     qty_requested NUMERIC NOT NULL DEFAULT 1,
     qty_received NUMERIC NOT NULL DEFAULT 0,
     line_status TEXT NOT NULL DEFAULT 'pending',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_request_lines_req ON store_request_lines (request_id)`,

  /* ------------------------------------------------------------ lifecycle */
  `CREATE TABLE IF NOT EXISTS tool_lifecycle (
     id BIGSERIAL PRIMARY KEY,
     code TEXT NOT NULL,
     state TEXT NOT NULL,
     note TEXT DEFAULT '',
     by_user TEXT DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ------------------------------------------------------------ audit log */
  `CREATE TABLE IF NOT EXISTS audit_log (
     id BIGSERIAL PRIMARY KEY,
     username TEXT DEFAULT '',
     role TEXT DEFAULT '',
     action TEXT NOT NULL,
     before_state TEXT DEFAULT '',
     after_state TEXT DEFAULT '',
     detail TEXT DEFAULT '',
     device TEXT DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ----------------------------------------------------------------- RBAC */
  `CREATE TABLE IF NOT EXISTS permissions (
     code TEXT PRIMARY KEY,
     module TEXT NOT NULL DEFAULT '',
     label TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
     role TEXT NOT NULL,
     permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
     PRIMARY KEY (role, permission_code)
   )`,

  /* --------------------------------------------------- category structure */
  `CREATE TABLE IF NOT EXISTS categories (
     id SERIAL PRIMARY KEY,
     name TEXT UNIQUE NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS subcategories (
     id SERIAL PRIMARY KEY,
     category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE (category_id, name)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories (category_id)`,
  `CREATE TABLE IF NOT EXISTS catalog_items (
     id SERIAL PRIMARY KEY,
     subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE (subcategory_id, name)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_catalog_items_sub ON catalog_items (subcategory_id)`,
  `ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0`,

  /* ------------------------------------------------------------ suppliers */
  `CREATE TABLE IF NOT EXISTS suppliers (
     id SERIAL PRIMARY KEY,
     name TEXT UNIQUE NOT NULL,
     phone TEXT NOT NULL DEFAULT '',
     note TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ------------------------------------------------------- person profile */
  `CREATE TABLE IF NOT EXISTS person_profiles (
     code TEXT PRIMARY KEY REFERENCES catalog(code) ON DELETE CASCADE,
     residence_no TEXT NOT NULL DEFAULT '',
     phone TEXT NOT NULL DEFAULT '',
     supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS supervisor_name TEXT NOT NULL DEFAULT ''`,

  /* ----------------------------------------------------------- warehouses */
  `CREATE TABLE IF NOT EXISTS warehouses (
     id SERIAL PRIMARY KEY,
     name TEXT UNIQUE NOT NULL,
     is_main BOOLEAN NOT NULL DEFAULT FALSE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS warehouse_stock (
     warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
     code TEXT NOT NULL,
     qty NUMERIC NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (warehouse_id, code)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_warehouse_stock_code ON warehouse_stock (code)`,
  `CREATE TABLE IF NOT EXISTS warehouse_transfers (
     id BIGSERIAL PRIMARY KEY,
     form_no TEXT NOT NULL DEFAULT '',
     from_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
     to_warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
     note TEXT NOT NULL DEFAULT '',
     by_user TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS warehouse_transfer_lines (
     id BIGSERIAL PRIMARY KEY,
     transfer_id BIGINT NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
     code TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     qty NUMERIC NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_transfer_lines_transfer ON warehouse_transfer_lines (transfer_id)`,

  /* ------------------------------------------------------ inventory count */
  `CREATE TABLE IF NOT EXISTS inventory_counts (
     id BIGSERIAL PRIMARY KEY,
     form_no TEXT NOT NULL DEFAULT '',
     warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE SET NULL,
     warehouse_name TEXT NOT NULL DEFAULT '',
     count_type TEXT NOT NULL DEFAULT 'full',
     category TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'sheet',
     by_user TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     location_type TEXT NOT NULL DEFAULT 'warehouse',
     project_id INTEGER
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS inventory_counts_form_no_key ON inventory_counts (form_no)`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_counts_created ON inventory_counts (created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS inventory_count_lines (
     id BIGSERIAL PRIMARY KEY,
     count_id BIGINT NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
     code TEXT NOT NULL DEFAULT '',
     description TEXT NOT NULL DEFAULT '',
     system_qty NUMERIC,
     counted_qty NUMERIC,
     remarks TEXT NOT NULL DEFAULT '',
     sort_order INTEGER NOT NULL DEFAULT 0
   )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_count_lines_count ON inventory_count_lines (count_id)`,

  /* ------------------------------------------------------------- projects */
  `CREATE TABLE IF NOT EXISTS projects (
     id SERIAL PRIMARY KEY,
     code TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL DEFAULT '',
     site TEXT NOT NULL DEFAULT '',
     client TEXT NOT NULL DEFAULT '',
     status TEXT NOT NULL DEFAULT 'active',
     notes TEXT NOT NULL DEFAULT '',
     created_by TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS project_stock (
     project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     code TEXT NOT NULL,
     qty NUMERIC NOT NULL DEFAULT 0,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (project_id, code)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_stock_code ON project_stock (code)`,
  `CREATE TABLE IF NOT EXISTS project_dispatches (
     id BIGSERIAL PRIMARY KEY,
     form_no TEXT NOT NULL UNIQUE,
     project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     type TEXT NOT NULL DEFAULT 'out',
     status TEXT NOT NULL DEFAULT 'issued',
     recipient_name TEXT NOT NULL DEFAULT '',
     recipient_phone TEXT NOT NULL DEFAULT '',
     issued_by TEXT NOT NULL DEFAULT '',
     issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     notes TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     recipient_residence_no TEXT NOT NULL DEFAULT '',
     vehicle_plate TEXT NOT NULL DEFAULT '',
     logistics_name TEXT NOT NULL DEFAULT '',
     logistics_signature TEXT NOT NULL DEFAULT '',
     store_manager_name TEXT NOT NULL DEFAULT '',
     store_manager_signature TEXT NOT NULL DEFAULT '',
     expected_return_date DATE
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_dispatches_project ON project_dispatches (project_id)`,
  `CREATE INDEX IF NOT EXISTS idx_project_dispatches_type ON project_dispatches (type)`,
  `CREATE INDEX IF NOT EXISTS idx_project_dispatches_issued ON project_dispatches (issued_at DESC)`,
  `CREATE TABLE IF NOT EXISTS project_dispatch_lines (
     id BIGSERIAL PRIMARY KEY,
     dispatch_id BIGINT NOT NULL REFERENCES project_dispatches(id) ON DELETE CASCADE,
     code TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     qty_sent NUMERIC NOT NULL DEFAULT 0,
     qty_returned NUMERIC NOT NULL DEFAULT 0,
     notes TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE INDEX IF NOT EXISTS idx_project_dispatch_lines_dispatch ON project_dispatch_lines (dispatch_id)`,
  `CREATE INDEX IF NOT EXISTS idx_project_dispatch_lines_code ON project_dispatch_lines (code)`,

  /* --------------------------------------------------------- user scoping */
  `CREATE TABLE IF NOT EXISTS user_warehouse_scope (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     warehouse_id INTEGER NOT NULL,
     PRIMARY KEY (user_id, warehouse_id)
   )`,
  `CREATE TABLE IF NOT EXISTS user_project_scope (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id INTEGER NOT NULL,
     PRIMARY KEY (user_id, project_id)
   )`,

  /* ------------------------------------------------------------------- QC */
  `CREATE TABLE IF NOT EXISTS qc_calibrations (
     id BIGSERIAL PRIMARY KEY,
     code TEXT NOT NULL,
     last_done DATE,
     next_due DATE,
     notes TEXT NOT NULL DEFAULT '',
     by_user TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_qc_code ON qc_calibrations (code)`,

  /* -------------------------------------------------------- label studio */
  `CREATE TABLE IF NOT EXISTS label_templates (
     id BIGSERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     config TEXT NOT NULL DEFAULT '{}',
     by_user TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  /* ----------------------------------------------------- terminal leases */
  `CREATE TABLE IF NOT EXISTS terminal_sessions (
     id BIGSERIAL PRIMARY KEY,
     username TEXT NOT NULL,
     device_id TEXT NOT NULL DEFAULT '',
     session_id TEXT NOT NULL DEFAULT '',
     lease_until TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     blocked_reason TEXT NOT NULL DEFAULT '',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_terminal_sessions_key
     ON terminal_sessions (username, device_id)`,
];

async function ensureSchema(query) {
  for (const sql of STATEMENTS) {
    try {
      await query(sql);
    } catch (e) {
      // A failing guard statement must never stop the API from booting.
      console.warn("[schema] skipped:", (e && e.message) || e);
    }
  }
  await ensureMainWarehouse(query);
}

async function ensureMainWarehouse(query) {
  try {
    const r = await query(`SELECT id FROM warehouses ORDER BY is_main DESC, id ASC LIMIT 1`);
    if (!r.rows.length) {
      await query(
        `INSERT INTO warehouses (name, is_main) VALUES ($1, TRUE)
         ON CONFLICT (name) DO NOTHING`,
        [process.env.MAIN_WAREHOUSE_NAME || "Main Warehouse"]
      );
    }
  } catch (e) {
    console.warn("[schema] main warehouse:", (e && e.message) || e);
  }
}

module.exports = { ensureSchema, STATEMENTS };
