const U = require("../lib/util");
const permissions = require("../permissions");

function lineView(row, imageUrl) {
  const requested = U.num(row.qty_requested, 0);
  const received = U.num(row.qty_received, 0);
  return {
    id: row.id,
    requestId: row.request_id,
    code: U.upper(row.code),
    description: row.description || "",
    imageUrl: imageUrl || "",
    qtyRequested: requested,
    qtyReceived: received,
    qtyRemaining: Math.max(0, requested - received),
    lineStatus: row.line_status || (received >= requested && requested > 0 ? "done" : received > 0 ? "partial" : "pending"),
  };
}

async function getStoreRequests(ctx) {
  ctx.requireAny(["request.create", "request.approve", "tool.receive", "dashboard.full"]);
  const limit = Math.min(500, U.posInt(ctx.params.limit, 120));
  const heads = await ctx.query(`SELECT * FROM store_requests ORDER BY id DESC LIMIT $1`, [limit]);
  if (!heads.rows.length) return { items: [] };

  const ids = heads.rows.map((r) => r.id);
  const [lines, photos] = await Promise.all([
    ctx.query(
      `SELECT * FROM store_request_lines WHERE request_id = ANY($1::bigint[]) ORDER BY id ASC`,
      [ids]
    ),
    ctx.query(`SELECT code, image_url FROM product_photos`),
  ]);
  const imageOf = new Map(photos.rows.map((p) => [U.upper(p.code), p.image_url]));

  const byRequest = new Map(ids.map((id) => [String(id), []]));
  lines.rows.forEach((l) => {
    const bucket = byRequest.get(String(l.request_id));
    if (bucket) bucket.push(lineView(l, imageOf.get(U.upper(l.code))));
  });

  const items = heads.rows.map((r) => {
    const rowLines = byRequest.get(String(r.id)) || [];
    const totalRequested = rowLines.reduce((s, l) => s + l.qtyRequested, 0);
    const totalReceived = rowLines.reduce((s, l) => s + Math.min(l.qtyReceived, l.qtyRequested), 0);
    const linesDone = rowLines.filter((l) => l.lineStatus === "done").length;
    return {
      id: r.id,
      timestamp: U.isoOrNull(r.created_at),
      createdAt: U.isoOrNull(r.created_at),
      byUser: r.by_user || "",
      role: r.role || "",
      items: r.items || "",
      note: r.note || "",
      status: r.status || "Open",
      lines: rowLines,
      progress: {
        linesTotal: rowLines.length,
        linesDone,
        totalRequested,
        totalReceived,
        pct: totalRequested > 0 ? Math.round((totalReceived / totalRequested) * 100) : 0,
      },
    };
  });

  return { items };
}

async function createStoreRequest(ctx) {
  ctx.require("request.create");
  const { params, query } = ctx;
  const lines = U.asArray(params.lines)
    .map((l) => ({
      code: U.upper(l && l.code),
      description: U.trimmed(l && l.description),
      qty: Math.max(0.001, U.num(l && l.qty, 1)),
    }))
    .filter((l) => l.code || l.description);

  const freeText = U.trimmed(params.items);
  if (!lines.length && !freeText) return { success: false, error: "Items required" };

  const summary =
    freeText ||
    lines.map((l) => `${l.code}${l.description ? ` · ${l.description}` : ""} ×${l.qty}`).join("\n");

  const head = await query(
    `INSERT INTO store_requests (by_user, role, items, note, status)
     VALUES ($1,$2,$3,$4,'Open') RETURNING id, created_at`,
    [
      U.trimmed(params.user) || ctx.user.username,
      permissions.normalizeRoleLocal(params.role || ctx.role),
      summary,
      U.trimmed(params.note),
    ]
  );
  const id = head.rows[0].id;

  for (const line of lines) {
    await query(
      `INSERT INTO store_request_lines (request_id, code, description, qty_requested)
       VALUES ($1,$2,$3,$4)`,
      [id, line.code, line.description, line.qty]
    );
  }

  await ctx.audit({ action: "REQUEST_CREATE", after: JSON.stringify({ id, lines: lines.length }) });
  return { success: true, id, lines: lines.length };
}

async function cancelStoreRequest(ctx) {
  ctx.requireAny(["request.create", "request.approve"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const r = await ctx.query(
    `UPDATE store_requests SET status = 'Cancelled' WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!r.rows.length) return { success: false, error: "NOT_FOUND" };
  await ctx.audit({ action: "REQUEST_CANCEL", after: JSON.stringify({ id }) });
  return { success: true, id };
}

async function deleteStoreRequest(ctx) {
  ctx.requireAny(["request.approve", "request.create"]);
  const id = U.int(ctx.params.id, 0);
  if (!id) return { success: false, error: "ID_REQUIRED" };
  const del = await ctx.query(`DELETE FROM store_requests WHERE id = $1`, [id]);
  if (!del.rowCount) return { success: false, error: "NOT_FOUND" };
  await ctx.audit({ action: "REQUEST_DELETE", before: JSON.stringify({ id }) });
  return { success: true, id };
}

module.exports = {
  getStoreRequests,
  createStoreRequest,
  cancelStoreRequest,
  deleteStoreRequest,
};
