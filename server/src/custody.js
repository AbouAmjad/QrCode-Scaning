/**
 * Custody ledger.
 *
 * Server-side port of the browser CustodyParser (parser.js). The scans table is
 * an append-only tape of bare codes; custody state only exists once that tape is
 * replayed in chronological order:
 *
 *   P<code>   selects the current person and clears the direction
 *   IN | OUT  sets the direction for every following item scan
 *   I/E/B…    tool movement against the current person + direction
 *   C…        consumable issue (no custody — it never comes back)
 *
 * Unlike the client parser, holdings are keyed by person CODE (not by the
 * person's display name) and every OUT keeps its own timestamped lot, which is
 * what getOutstanding / getPersonCustody report per take.
 */

const {
  upper,
  isPersonCode,
  isDirection,
  isToolCode,
  isConsumableCode,
  fmtDate,
  fmtDateTime,
  isoOrNull,
  daysSince,
} = require("./lib/util");

const CACHE_TTL_MS = Number(process.env.CUSTODY_CACHE_MS || 4000) || 4000;

let cache = null; // { key, ledger, at }

/* ------------------------------------------------------------------ replay */

function emptyTool(code, description) {
  return { code, description: description || code, lots: [], totalOut: 0, totalIn: 0 };
}

function emptyPerson(code, name) {
  return {
    code,
    name: name || code,
    totalTaken: 0,
    totalReturned: 0,
    consumablesIssued: 0,
    lastOutAt: null,
    lastSeenAt: null,
    events: [],
  };
}

/**
 * @param {Array} rows  scan rows ordered oldest → newest
 * @param {Map<string,object>} catalog  code → { description, kind }
 */
function replay(rows, catalog) {
  const descOf = (code) => {
    const hit = catalog && catalog.get(code);
    return (hit && hit.description) || code;
  };

  const tools = new Map();
  const people = new Map();
  const consumables = new Map();
  const warnings = [];
  const movements = []; // flat, chronological, used by logs / dashboards

  let personCode = null;
  let personName = null;
  let direction = null;

  for (const row of rows || []) {
    const code = upper(row.tool_code);
    if (!code) continue;
    const at = row.scanned_at instanceof Date ? row.scanned_at : new Date(row.scanned_at);
    const rowDate = row.row_date || "";

    if (isPersonCode(code)) {
      personCode = code;
      personName = descOf(code);
      direction = null;
      if (!people.has(code)) people.set(code, emptyPerson(code, personName));
      const p = people.get(code);
      p.name = personName;
      p.lastSeenAt = at;
      continue;
    }

    if (isDirection(code)) {
      direction = code;
      continue;
    }

    if (!isToolCode(code)) continue;

    const description = descOf(code);

    if (!personCode || !direction) {
      warnings.push({
        code,
        description,
        personCode: personCode || "",
        scannedAt: at,
        rowDate,
        reason: !personCode ? "NO_PERSON" : "NO_DIRECTION",
      });
      continue;
    }

    const person = people.get(personCode) || emptyPerson(personCode, personName);
    people.set(personCode, person);

    if (isConsumableCode(code)) {
      if (!consumables.has(code)) {
        consumables.set(code, { code, description, issued: 0, returned: 0, issues: [] });
      }
      const c = consumables.get(code);
      c.description = description;
      if (direction === "OUT") {
        c.issued += 1;
        c.issues.push({ personCode, personName: person.name, scannedAt: at, rowDate });
        person.consumablesIssued += 1;
        person.events.push({
          type: "consumable",
          code,
          description,
          scannedAt: at,
          rowDate,
          createdBy: row.created_by || "",
          deviceId: row.device_id || "",
          sessionId: row.session_id || "",
        });
        movements.push({ type: "consumable", code, description, personCode, scannedAt: at, qty: 1 });
      } else {
        c.returned += 1;
        movements.push({ type: "consumable-in", code, description, personCode, scannedAt: at, qty: 1 });
      }
      continue;
    }

    if (!tools.has(code)) tools.set(code, emptyTool(code, description));
    const tool = tools.get(code);
    tool.description = description;

    if (direction === "OUT") {
      tool.lots.push({
        code,
        description,
        personCode,
        personName: person.name,
        takenAt: at,
        rowDate,
        scanId: row.id,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      tool.totalOut += 1;
      person.totalTaken += 1;
      if (!person.lastOutAt || at > person.lastOutAt) person.lastOutAt = at;
      person.events.push({
        type: "out",
        code,
        description,
        scannedAt: at,
        rowDate,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      movements.push({ type: "out", code, description, personCode, scannedAt: at, qty: 1 });
      continue;
    }

    // direction === "IN"
    tool.totalIn += 1;
    person.totalReturned += 1;
    let idx = -1;
    for (let i = tool.lots.length - 1; i >= 0; i -= 1) {
      if (tool.lots[i].personCode === personCode) {
        idx = i;
        break;
      }
    }

    if (idx >= 0) {
      const [lot] = tool.lots.splice(idx, 1);
      person.events.push({
        type: "in",
        code,
        description,
        scannedAt: at,
        rowDate,
        heldSince: lot.takenAt,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      movements.push({ type: "in", code, description, personCode, scannedAt: at, qty: 1 });
    } else if (tool.lots.length) {
      // Someone else brought it back — clear the oldest outstanding lot and
      // credit the return to the person who physically handed it over.
      const lot = tool.lots.shift();
      const owner = people.get(lot.personCode) || emptyPerson(lot.personCode, lot.personName);
      people.set(lot.personCode, owner);
      owner.events.push({
        type: "in",
        code,
        description,
        scannedAt: at,
        rowDate,
        heldSince: lot.takenAt,
        returnedBy: personCode,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      person.events.push({
        type: "in",
        code,
        description,
        scannedAt: at,
        rowDate,
        recoveredFrom: lot.personCode,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      warnings.push({
        code,
        description,
        personCode,
        scannedAt: at,
        rowDate,
        reason: "RECOVERED",
        lostBy: lot.personCode,
      });
      movements.push({ type: "in", code, description, personCode: lot.personCode, scannedAt: at, qty: 1 });
    } else {
      person.events.push({
        type: "in",
        code,
        description,
        scannedAt: at,
        rowDate,
        unregistered: true,
        createdBy: row.created_by || "",
        deviceId: row.device_id || "",
        sessionId: row.session_id || "",
      });
      movements.push({ type: "in", code, description, personCode, scannedAt: at, qty: 1 });
    }
  }

  return { tools, people, consumables, warnings, movements };
}

/* ------------------------------------------------------------------- load */

async function loadRows(query) {
  const r = await query(
    `SELECT s.id, s.tool_code, s.scanned_at, s.row_date, s.created_by,
            COALESCE(s.device_id, '') AS device_id,
            COALESCE(s.session_id, '') AS session_id
       FROM scans s
      ORDER BY s.scanned_at ASC, s.id ASC`
  );
  return r.rows;
}

async function loadCatalog(query) {
  const r = await query(
    `SELECT c.code, c.description, c.kind,
            COALESCE(p.image_url, '') AS image_url
       FROM catalog c
       LEFT JOIN product_photos p ON p.code = c.code`
  );
  const map = new Map();
  for (const row of r.rows) {
    map.set(upper(row.code), {
      code: upper(row.code),
      description: row.description || row.code,
      kind: row.kind || "tool",
      imageUrl: row.image_url || "",
    });
  }
  return map;
}

/**
 * Replays the whole tape, memoised for a few seconds and keyed on the scan
 * high-water mark so a fresh scan is reflected immediately.
 */
async function load(query, opts = {}) {
  const stamp = await query(
    `SELECT COALESCE(MAX(id), 0) AS max_id, COUNT(*)::bigint AS n FROM scans`
  );
  const key = `${stamp.rows[0].max_id}:${stamp.rows[0].n}`;

  if (
    !opts.force &&
    cache &&
    cache.key === key &&
    Date.now() - cache.at < CACHE_TTL_MS
  ) {
    return cache.ledger;
  }

  const [rows, catalog] = await Promise.all([loadRows(query), loadCatalog(query)]);
  const ledger = replay(rows, catalog);
  ledger.catalog = catalog;
  ledger.scanCount = rows.length;
  cache = { key, ledger, at: Date.now() };
  return ledger;
}

function invalidate() {
  cache = null;
}

/* ---------------------------------------------------------------- queries */

function lotView(lot, overdueDays, now) {
  const daysOut = daysSince(lot.takenAt, now);
  return {
    takenAt: isoOrNull(lot.takenAt),
    takenDate: fmtDate(lot.takenAt),
    takenDateTime: fmtDateTime(lot.takenAt),
    daysOut,
    overdue: daysOut >= overdueDays,
    createdBy: lot.createdBy || "",
    keeper: lot.createdBy || "",
  };
}

/** All outstanding lots for one person, grouped per tool code. */
function holdingsForPerson(ledger, personCode, opts = {}) {
  const code = upper(personCode);
  const overdueDays = Math.max(1, Number(opts.overdueDays) || 1);
  const now = opts.now || Date.now();
  const byCode = new Map();

  for (const tool of ledger.tools.values()) {
    for (const lot of tool.lots) {
      if (lot.personCode !== code) continue;
      if (!byCode.has(tool.code)) {
        byCode.set(tool.code, {
          code: tool.code,
          description: tool.description,
          qty: 0,
          imageUrl: imageFor(ledger, tool.code),
          lots: [],
          _latest: null,
        });
      }
      const entry = byCode.get(tool.code);
      entry.qty += 1;
      entry.lots.push(lot);
      if (!entry._latest || lot.takenAt > entry._latest) entry._latest = lot.takenAt;
    }
  }

  const tools = [...byCode.values()].map((entry) => {
    entry.lots.sort((a, b) => a.takenAt - b.takenAt);
    const oldest = entry.lots[0];
    const daysOut = daysSince(oldest.takenAt, now);
    const lotViews = entry.lots.map((lot) => lotView(lot, overdueDays, now));
    const keepers = [...new Set(lotViews.map((l) => l.keeper).filter(Boolean))];
    return {
      code: entry.code,
      description: entry.description,
      qty: entry.qty,
      imageUrl: entry.imageUrl,
      takenAt: isoOrNull(entry._latest),
      takenDate: fmtDate(entry._latest),
      takenDateTime: fmtDateTime(entry._latest),
      daysOut,
      overdue: daysOut >= overdueDays,
      keeper: (oldest && oldest.createdBy) || keepers[0] || "",
      keepers,
      lots: lotViews,
    };
  });

  tools.sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      b.daysOut - a.daysOut ||
      String(a.code).localeCompare(String(b.code))
  );
  return tools;
}

function imageFor(ledger, code) {
  const hit = ledger.catalog && ledger.catalog.get(upper(code));
  return (hit && hit.imageUrl) || "";
}

/** Person codes that currently hold at least one tool. */
function personsWithHoldings(ledger) {
  const set = new Set();
  for (const tool of ledger.tools.values()) {
    for (const lot of tool.lots) set.add(lot.personCode);
  }
  return [...set];
}

/** Current holders of one tool code, collapsed per person. */
function holdersOfTool(ledger, toolCode) {
  const code = upper(toolCode);
  const tool = ledger.tools.get(code);
  if (!tool) return [];
  const byPerson = new Map();
  for (const lot of tool.lots) {
    if (!byPerson.has(lot.personCode)) {
      byPerson.set(lot.personCode, {
        personCode: lot.personCode,
        personName: lot.personName,
        qty: 0,
        takenAt: lot.takenAt,
      });
    }
    const h = byPerson.get(lot.personCode);
    h.qty += 1;
    if (lot.takenAt < h.takenAt) h.takenAt = lot.takenAt;
  }
  return [...byPerson.values()];
}

/** Units currently out with people, per tool code. */
function outQtyByCode(ledger) {
  const map = new Map();
  for (const tool of ledger.tools.values()) {
    if (tool.lots.length) map.set(tool.code, tool.lots.length);
  }
  return map;
}

/** All-time issued qty per consumable code. */
function issuedQtyByCode(ledger) {
  const map = new Map();
  for (const c of ledger.consumables.values()) {
    const net = Math.max(0, c.issued - c.returned);
    if (net) map.set(c.code, net);
  }
  return map;
}

/**
 * Most recent OUT of a PPE item for one person.
 * When `itemCode` is set (normal path), cooldown is per SKU — so Mechanical
 * Gloves (C12-B) do not block Welding Gloves (C12-A) and vice versa.
 * Family-wide lookup remains available when `itemCode` is omitted.
 */
function lastPpeIssue(ledger, personCode, family, matcher, itemCode) {
  const code = upper(personCode);
  const wantItem = itemCode ? upper(itemCode) : "";
  const person = ledger.people.get(code);
  if (!person) return null;
  let best = null;
  for (const ev of person.events) {
    if (ev.type !== "out" && ev.type !== "consumable") continue;
    if (wantItem) {
      if (upper(ev.code) !== wantItem) continue;
    } else {
      const hit = matcher(`${ev.code} ${ev.description || ""}`);
      if (!hit || hit.id !== family) continue;
    }
    if (!best || ev.scannedAt > best.scannedAt) best = ev;
  }
  return best;
}

module.exports = {
  replay,
  load,
  loadCatalog,
  invalidate,
  holdingsForPerson,
  personsWithHoldings,
  holdersOfTool,
  outQtyByCode,
  issuedQtyByCode,
  lastPpeIssue,
  imageFor,
  lotView,
};
