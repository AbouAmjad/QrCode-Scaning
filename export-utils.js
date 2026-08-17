/** Shared Excel / PDF export helpers for AICS System */
const TCExport = (() => {
  const PRINT_CREDIT = "System Created & Designed By Mahmoud Iskandar +966 56 005 4242";

  function printCreditBlock(extraClass = "") {
    const cls = extraClass ? ` class="${extraClass}"` : ' class="tc-print-credit"';
    return `<div${cls}>${PRINT_CREDIT}</div>`;
  }

  function absImg(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    if (u.startsWith("/")) return origin + u;
    return origin + "/" + u.replace(/^\.\//, "");
  }

  function safeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /** Small product thumb for printable tables/cards. */
  function productThumbHtml(url, size = 40) {
    const src = absImg(url);
    const s = Math.max(24, Number(size) || 40);
    if (!src) {
      return `<div class="tc-pthumb ph" style="width:${s}px;height:${s}px">—</div>`;
    }
    return `<div class="tc-pthumb" style="width:${s}px;height:${s}px"><img src="${safeHtml(src)}" alt=""></div>`;
  }

  const PRODUCT_THUMB_CSS = `
  .tc-pthumb {
    width: 40px; height: 40px; border-radius: 7px; overflow: hidden;
    background: #f1f5f9; border: 1px solid #e2e8f0;
    display: grid; place-items: center; flex-shrink: 0;
  }
  .tc-pthumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .tc-pthumb.ph { font-size: 10px; font-weight: 800; color: #94a3b8; }
  td.photo, th.photo { width: 52px; text-align: center; vertical-align: middle; }
  `;

  function stamp() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${d.getFullYear()}${mm}${dd}-${hh}${mi}`;
  }

  function ensureXlsx() {
    if (typeof XLSX === "undefined") throw new Error("Excel library not loaded");
  }

  function excelFromSheets(sheets, filename) {
    ensureXlsx();
    const wb = XLSX.utils.book_new();
    (sheets || []).forEach((sheet) => {
      const name = String(sheet.name || "Sheet").slice(0, 31);
      const ws = Array.isArray(sheet.aoa)
        ? XLSX.utils.aoa_to_sheet(sheet.aoa)
        : XLSX.utils.json_to_sheet(sheet.rows || []);
      if (sheet.cols && ws["!cols"] == null) ws["!cols"] = sheet.cols;
      XLSX.utils.book_append_sheet(wb, ws, name);
    });
    const file = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, file);
  }

  function printHtmlPdf({ title, subtitle, headers, rows, filename }) {
    const safe = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const head = (headers || []).map((h) => `<th>${safe(h)}</th>`).join("");
    const body = (rows || []).map((r) =>
      `<tr>${(Array.isArray(r) ? r : []).map((c) => `<td>${safe(c)}</td>`).join("")}</tr>`
    ).join("");
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${safe(filename || title || "Report")}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: start; vertical-align: top; }
  th { background: #0f766e; color: #fff; }
  tr:nth-child(even) td { background: #f8fafc; }
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<h1>${safe(title || "Report")}</h1>
${subtitle ? `<div class="sub">${safe(subtitle)}</div>` : ""}
<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${(headers || []).length || 1}">—</td></tr>`}</tbody></table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function pdfTable({ title, subtitle, headers, rows, filename }) {
    printHtmlPdf({ title, subtitle, headers, rows, filename });
  }

  function outstandingRows(people) {
    const flat = [];
    (people || []).forEach((p) => {
      const tools = p.tools || [];
      if (!tools.length) {
        flat.push({
          Person: p.name || "",
          Code: p.code || "",
          Phone: p.phone || "",
          Supplier: p.supplierName || "",
          Tool: "",
          Description: "",
          Image: "",
          Qty: p.qty || 0,
          "Days out": p.daysOut || 0,
          "Taken at": p.lastOutDateTime || p.lastOutAt || "",
          Overdue: p.overdue ? "Yes" : "No"
        });
        return;
      }
      tools.forEach((tool) => {
        flat.push({
          Person: p.name || "",
          Code: p.code || "",
          Phone: p.phone || "",
          Supplier: p.supplierName || "",
          Tool: tool.code || "",
          Description: tool.description || "",
          Image: absImg(tool.imageUrl || ""),
          Qty: tool.qty || 1,
          "Days out": tool.daysOut || 0,
          "Taken at": tool.takenDateTime || tool.takenAt || "",
          Overdue: tool.overdue ? "Yes" : "No"
        });
      });
    });
    return flat;
  }

  function exportOutstandingExcel(people, label) {
    const rows = outstandingRows(people);
    const aoa = [
      ["Person", "Code", "Phone", "Supplier", "Tool", "Description", "Image URL", "Qty", "Days out", "Taken at", "Overdue"],
      ...rows.map((r) => [
        r.Person, r.Code, r.Phone, r.Supplier, r.Tool, r.Description, r.Image, r.Qty, r["Days out"], r["Taken at"], r.Overdue
      ])
    ];
    excelFromSheets(
      [{ name: "Not returned", aoa }],
      `not-returned-${label || stamp()}`
    );
  }

  function exportOutstandingPdf(people, label) {
    const rows = outstandingRows(people);
    const body = rows.map((r) => `<tr>
      <td>${safeHtml(r.Person)}</td>
      <td>${safeHtml(r.Code)}</td>
      <td class="photo">${productThumbHtml(r.Image, 36)}</td>
      <td>${safeHtml(r.Tool)}</td>
      <td>${safeHtml(r.Description)}</td>
      <td>${safeHtml(r.Qty)}</td>
      <td>${safeHtml(r["Days out"])}</td>
      <td>${safeHtml(r["Taken at"])}</td>
      <td>${safeHtml(r.Overdue)}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>not-returned-${safeHtml(label || stamp())}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: start; vertical-align: middle; }
  th { background: #0f766e; color: #fff; }
  tr:nth-child(even) td { background: #f8fafc; }
  ${PRODUCT_THUMB_CSS}
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<h1>Not returned · AICS System</h1>
<div class="sub">${rows.length} row(s) · ${safeHtml(label || stamp())}</div>
<table>
  <thead><tr>
    <th>Person</th><th>Code</th><th class="photo">Photo</th><th>Tool</th><th>Description</th>
    <th>Qty</th><th>Days</th><th>Taken at</th><th>Overdue</th>
  </tr></thead>
  <tbody>${body || `<tr><td colspan="9">—</td></tr>`}</tbody>
</table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function exportPersonExcel(report) {
    const p = report || {};
    const stats = p.stats || {};
    const actionLabel = (e) => {
      const t = String(e.type || "").toLowerCase();
      if (t === "in") return "RETURNED (IN)";
      if (t === "consumable") return "CONSUMABLE";
      return "TAKEN (OUT)";
    };
    const summary = [
      ["Field", "Value"],
      ["Code", p.code || ""],
      ["Name", p.name || ""],
      ["Phone", p.phone || ""],
      ["Residence", p.residenceNo || ""],
      ["Supplier", p.supplierName || ""],
      ["Foreman / Supervisor", p.supervisorName || ""],
      ["Last OUT", p.lastOutDateTime || p.lastOutAt || ""],
      ["Currently held", stats.currentlyHeld || 0],
      ["Total taken (OUT)", stats.totalTaken || 0],
      ["Total returned (IN)", stats.totalReturned || 0],
      ["Consumables", stats.consumablesIssued || 0],
      ["Overdue", p.overdue ? "Yes" : "No"],
      ["Max days out", p.maxDaysOut || 0]
    ];
    const held = [
      ["Tool", "Description", "Image URL", "Qty", "Days out", "Taken at", "Overdue"],
      ...(p.toolsHeld || []).flatMap((t) => {
        const lots = Array.isArray(t.lots) && t.lots.length > 1 ? t.lots : null;
        const img = absImg(t.imageUrl || "");
        if (lots) {
          return lots.map((lot, i) => [
            t.code || "",
            (t.description || "") + (lots.length > 1 ? ` (#${i + 1}/${lots.length})` : ""),
            img,
            1,
            lot.daysOut || 0,
            lot.takenDateTime || lot.takenAt || "",
            lot.overdue ? "Yes" : "No"
          ]);
        }
        return [[
          t.code || "",
          t.description || "",
          img,
          t.qty || 1,
          t.daysOut || 0,
          t.takenDateTime || t.takenAt || "",
          t.overdue ? "Yes" : "No"
        ]];
      })
    ];
    const history = [
      ["Action", "Meaning", "Tool", "Description", "Date/Time"],
      ...(p.events || []).map((e) => {
        const t = String(e.type || "").toLowerCase();
        const meaning = t === "in" ? "Tool returned to store"
          : t === "consumable" ? "Consumable issued (no return)"
          : "Tool taken from store";
        return [
          actionLabel(e),
          meaning,
          e.code || "",
          e.description || "",
          e.dateTimeLabel || e.scannedAt || e.dateLabel || ""
        ];
      })
    ];
    excelFromSheets(
      [
        { name: "Summary", aoa: summary },
        { name: "Currently held", aoa: held },
        { name: "History", aoa: history }
      ],
      `person-${p.code || "report"}-${stamp()}`
    );
  }

  function exportPersonPdf(report) {
    const p = report || {};
    const stats = p.stats || {};
    const events = p.events || [];
    const heldCount = stats.currentlyHeld || (p.toolsHeld || []).length || 0;
    const takenCount = stats.totalTaken || 0;
    const returnedCount = stats.totalReturned || 0;
    const consCount = stats.consumablesIssued || 0;

    const heldBody = (p.toolsHeld || []).flatMap((t) => {
      const lots = Array.isArray(t.lots) && t.lots.length > 1 ? t.lots : null;
      if (lots) {
        return lots.map((lot, i) => `<tr class="${lot.overdue ? "row-overdue" : ""}">
      <td class="photo">${i === 0 ? productThumbHtml(t.imageUrl, 42) : ""}</td>
      <td class="code">${safeHtml(t.code || "")}</td>
      <td>${safeHtml(t.description || "")} <span class="muted">(#${i + 1}/${lots.length})</span></td>
      <td class="num">1</td>
      <td class="num">${safeHtml(lot.daysOut || 0)}</td>
      <td>${safeHtml(lot.takenDateTime || lot.takenAt || "")}</td>
      <td>${lot.overdue ? '<span class="pill overdue">Overdue</span>' : '<span class="pill ok">OK</span>'}</td>
    </tr>`).join("");
      }
      return `<tr class="${t.overdue ? "row-overdue" : ""}">
      <td class="photo">${productThumbHtml(t.imageUrl, 42)}</td>
      <td class="code">${safeHtml(t.code || "")}</td>
      <td>${safeHtml(t.description || "")}</td>
      <td class="num">${safeHtml(t.qty || 1)}</td>
      <td class="num">${safeHtml(t.daysOut || 0)}</td>
      <td>${safeHtml(t.takenDateTime || t.takenAt || "")}</td>
      <td>${t.overdue ? '<span class="pill overdue">Overdue</span>' : '<span class="pill ok">OK</span>'}</td>
    </tr>`;
    }).join("");

    const histBody = events.map((e) => {
      const t = String(e.type || "").toLowerCase();
      const isIn = t === "in";
      const isCons = t === "consumable";
      const cls = isIn ? "in" : isCons ? "cons" : "out";
      const action = isIn ? "RETURNED" : isCons ? "CONSUMABLE" : "TAKEN";
      const hint = isIn ? "IN — back to store" : isCons ? "Issued, no return" : "OUT — left the store";
      const when = e.dateTimeLabel || e.scannedAt || e.dateLabel || "";
      return `<tr class="row-${cls}">
        <td><span class="badge ${cls}">${action}</span><div class="hint">${hint}</div></td>
        <td class="code">${safeHtml(e.code || "")}</td>
        <td>${safeHtml(e.description || "")}</td>
        <td>${safeHtml(when)}</td>
      </tr>`;
    }).join("");

    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    const logoUrl = origin + "/aics-logo.png";
    const companyName = "Arabian Integrated Construction Services";

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>person-${safeHtml(p.code || "report")}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px 12px; font-size: 12.5px; line-height: 1.35; }
  .hdr {
    display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: center;
    padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2px solid #14532d;
  }
  .hdr img {
    width: 58px; height: 58px; object-fit: contain; display: block;
  }
  .hdr .co-en {
    font-size: 13px; font-weight: 900; color: #14532d; text-transform: uppercase;
    letter-spacing: .04em; line-height: 1.2;
  }
  .hdr .co-ar {
    font-size: 12px; font-weight: 700; color: #374151; direction: rtl; margin-top: 3px;
  }
  .hdr .co-sub { margin-top: 4px; font-size: 10px; color: #64748b; }
  .hdr .docbox {
    border: 1px solid #c8d0c9; min-width: 118px; overflow: hidden;
  }
  .hdr .docbox .t {
    background: #14532d; color: #fff; font-size: 8.5px; font-weight: 800;
    letter-spacing: .12em; text-transform: uppercase; padding: 4px 8px; text-align: center;
  }
  .hdr .docbox .r {
    display: grid; grid-template-columns: 42px 1fr; border-top: 1px solid #e5e7eb; font-size: 10px;
  }
  .hdr .docbox .r span:first-child {
    padding: 3px 5px; color: #64748b; font-weight: 700; background: #f8fafc; border-right: 1px solid #e5e7eb;
  }
  .hdr .docbox .r span:last-child { padding: 3px 6px; font-weight: 800; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #14532d; letter-spacing: .02em; }
  .sub { color: #475569; font-size: 12px; margin-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 0 0 14px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .kpi .k { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  .kpi .v { font-size: 22px; font-weight: 900; margin-top: 2px; line-height: 1.1; }
  .kpi .s { font-size: 10.5px; color: #64748b; margin-top: 2px; }
  .kpi.held .v { color: #b45309; }
  .kpi.out .v { color: #b91c1c; }
  .kpi.in .v { color: #15803d; }
  .kpi.cons .v { color: #1d4ed8; }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 0 0 12px; font-size: 11.5px; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  h2 { font-size: 14px; margin: 16px 0 8px; color: #14532d; border-bottom: 2px solid #14532d; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: start; vertical-align: middle; }
  th { background: #14532d; color: #fff; font-size: 11px; letter-spacing: .03em; text-transform: uppercase; }
  td.photo { width: 52px; text-align: center; }
  td.code { font-weight: 800; font-family: ui-monospace, Consolas, monospace; color: #14532d; white-space: nowrap; }
  td.num { text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; width: 48px; }
  .muted { color: #64748b; font-size: 11px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 900; letter-spacing: .04em; padding: 3px 8px; border-radius: 4px; color: #fff; }
  .badge.out { background: #b91c1c; }
  .badge.in { background: #15803d; }
  .badge.cons { background: #1d4ed8; }
  .hint { margin-top: 3px; font-size: 10.5px; color: #64748b; font-weight: 600; }
  tr.row-out td:first-child { box-shadow: inset 4px 0 0 #b91c1c; }
  tr.row-in td:first-child { box-shadow: inset 4px 0 0 #15803d; }
  tr.row-cons td:first-child { box-shadow: inset 4px 0 0 #1d4ed8; }
  tr.row-overdue td { background: #fff7ed; }
  .pill { display: inline-block; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
  .pill.ok { background: #dcfce7; color: #166534; }
  .pill.overdue { background: #ffedd5; color: #9a3412; }
  .note { margin-top: 10px; margin-bottom: 8px; padding: 8px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-left: 4px solid #14532d; font-size: 11.5px; color: #14532d; }
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  ${PRODUCT_THUMB_CSS}
  @media print {
    .noprint { display: none !important; }
    body { padding: 0; }
    tr.row-out td, tr.row-in td, tr.row-cons td, .badge, .pill, th, tr.row-overdue td, .hdr .docbox .t {
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
  }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<div class="hdr">
  <img src="${safeHtml(logoUrl)}" alt="AICS" onerror="this.style.display='none'">
  <div>
    <div class="co-en">${safeHtml(companyName)}</div>
    <div class="co-ar">الشركة العربية المتكاملة لخدمات الإنشاءات</div>
    <div class="co-sub">AICS · Store / Warehouse · Person custody report</div>
  </div>
  <div class="docbox">
    <div class="t">Document</div>
    <div class="r"><span>Code</span><span>AICS-PR</span></div>
    <div class="r"><span>Person</span><span>${safeHtml(p.code || "—")}</span></div>
  </div>
</div>
<h1>Person report · ${safeHtml(p.name || p.code || "")}</h1>
<div class="sub">${safeHtml(p.code || "")}${p.phone ? " · " + safeHtml(p.phone) : ""}${p.supervisorName ? " · Foreman: " + safeHtml(p.supervisorName) : ""}${p.supplierName ? " · " + safeHtml(p.supplierName) : ""} · ${stamp()}</div>
<div class="kpis">
  <div class="kpi held"><div class="k">Currently held</div><div class="v">${heldCount}</div><div class="s">Still with worker</div></div>
  <div class="kpi out"><div class="k">Taken (OUT)</div><div class="v">${takenCount}</div><div class="s">Lifetime taken from store</div></div>
  <div class="kpi in"><div class="k">Returned (IN)</div><div class="v">${returnedCount}</div><div class="s">Lifetime returned to store</div></div>
  <div class="kpi cons"><div class="k">Consumables</div><div class="v">${consCount}</div><div class="s">Issued · no return</div></div>
</div>
<div class="legend">
  <span><span class="badge out">TAKEN</span> OUT — tool left the store</span>
  <span><span class="badge in">RETURNED</span> IN — tool came back</span>
  <span><span class="badge cons">CONSUMABLE</span> Issued, not returned</span>
</div>
<h2>1) Currently held (still with worker)</h2>
<table>
  <thead><tr>
    <th class="photo">Photo</th><th>Tool</th><th>Description</th><th>Qty</th><th>Days</th><th>Taken at</th><th>Status</th>
  </tr></thead>
  <tbody>${heldBody || `<tr><td colspan="7">No tools currently held — all clear.</td></tr>`}</tbody>
</table>
<h2>2) Custody history (chronological)</h2>
<div class="note"><strong>How to read:</strong> <span class="badge out">TAKEN</span> = worker received the tool. <span class="badge in">RETURNED</span> = worker brought it back. Compare Taken vs Returned above to analyze custody.</div>
<table>
  <thead><tr>
    <th style="width:28%">Action</th><th>Tool</th><th>Description</th><th style="width:22%">Date / Time</th>
  </tr></thead>
  <tbody>${histBody || `<tr><td colspan="4">No custody history.</td></tr>`}</tbody>
</table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function exportProjectOnSiteExcel(project, holdings, label) {
    const p = project || {};
    const list = holdings || [];
    const aoa = [
      ["Project code", "Project name", "Site", "Client", "Status"],
      [p.code || "", p.name || "", p.site || "", p.client || "", p.status || ""],
      [],
      ["Code", "Description", "Image URL", "Qty on site"],
      ...list.map((h) => [
        h.code || "",
        h.description || "",
        absImg(h.imageUrl || ""),
        h.qty != null ? h.qty : 1
      ]),
      [],
      ["Total lines", list.length],
      ["Total qty", list.reduce((s, h) => s + (Number(h.qty) || 0), 0)]
    ];
    excelFromSheets(
      [{ name: "On site now", aoa, cols: [{ wch: 14 }, { wch: 36 }, { wch: 42 }, { wch: 12 }] }],
      `project-onsite-${p.code || "report"}-${label || stamp()}`
    );
  }

  function exportProjectOnSitePdf(project, holdings, label) {
    const p = project || {};
    const list = holdings || [];
    const totalQty = list.reduce((s, h) => s + (Number(h.qty) || 0), 0);
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    const logoUrl = origin + "/aics-logo.png";
    const companyName = "Arabian Integrated Construction Services";
    const body = list.map((h, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td class="photo">${productThumbHtml(h.imageUrl, 36)}</td>
      <td class="code">${safeHtml(h.code || "")}</td>
      <td>${safeHtml(h.description || "")}</td>
      <td class="num">${safeHtml(h.qty != null ? h.qty : 1)}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>project-onsite-${safeHtml(p.code || "report")}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px 12px; font-size: 12.5px; line-height: 1.35; }
  .hdr {
    display: grid; grid-template-columns: 64px 1fr auto; gap: 12px; align-items: center;
    padding-bottom: 10px; margin-bottom: 12px; border-bottom: 2px solid #14532d;
  }
  .hdr img { width: 58px; height: 58px; object-fit: contain; display: block; }
  .hdr .co-en { font-size: 13px; font-weight: 900; color: #14532d; text-transform: uppercase; letter-spacing: .04em; }
  .hdr .co-ar { font-size: 12px; font-weight: 700; color: #374151; direction: rtl; margin-top: 3px; }
  .hdr .co-sub { margin-top: 4px; font-size: 10px; color: #64748b; }
  .hdr .docbox { border: 1px solid #c8d0c9; min-width: 118px; overflow: hidden; }
  .hdr .docbox .t {
    background: #14532d; color: #fff; font-size: 8.5px; font-weight: 800;
    letter-spacing: .12em; text-transform: uppercase; padding: 4px 8px; text-align: center;
  }
  .hdr .docbox .r {
    display: grid; grid-template-columns: 42px 1fr; border-top: 1px solid #e5e7eb; font-size: 10px;
  }
  .hdr .docbox .r span:first-child {
    padding: 3px 5px; color: #64748b; font-weight: 700; background: #f8fafc; border-right: 1px solid #e5e7eb;
  }
  .hdr .docbox .r span:last-child { padding: 3px 6px; font-weight: 800; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #14532d; }
  .sub { color: #475569; font-size: 12px; margin-bottom: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 0 14px; }
  .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; background: #f8fafc; }
  .kpi .k { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: #64748b; }
  .kpi .v { font-size: 20px; font-weight: 900; margin-top: 2px; color: #14532d; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: start; vertical-align: middle; }
  th { background: #14532d; color: #fff; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
  td.n, td.num { text-align: center; font-weight: 800; width: 52px; }
  td.code { font-weight: 800; font-family: ui-monospace, Consolas, monospace; color: #14532d; white-space: nowrap; }
  ${PRODUCT_THUMB_CSS}
  td.photo, th.photo { width: 48px; text-align: center; vertical-align: middle; }
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print {
    .noprint { display: none !important; }
    body { padding: 0; }
    th, .hdr .docbox .t { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<div class="hdr">
  <img src="${safeHtml(logoUrl)}" alt="AICS" onerror="this.style.display='none'">
  <div>
    <div class="co-en">${safeHtml(companyName)}</div>
    <div class="co-ar">الشركة العربية المتكاملة لخدمات الإنشاءات</div>
    <div class="co-sub">AICS · Store / Warehouse · Project on-site tools</div>
  </div>
  <div class="docbox">
    <div class="t">Document</div>
    <div class="r"><span>Code</span><span>AICS-PO</span></div>
    <div class="r"><span>Project</span><span>${safeHtml(p.code || "—")}</span></div>
  </div>
</div>
<h1>On site now · ${safeHtml(p.name || p.code || "")}</h1>
<div class="sub">${safeHtml(p.code || "")}${p.site ? " · " + safeHtml(p.site) : ""}${p.client ? " · " + safeHtml(p.client) : ""} · ${safeHtml(label || stamp())}</div>
<div class="kpis">
  <div class="kpi"><div class="k">Tool lines</div><div class="v">${list.length}</div></div>
  <div class="kpi"><div class="k">Total qty</div><div class="v">${totalQty}</div></div>
  <div class="kpi"><div class="k">Status</div><div class="v" style="font-size:14px;padding-top:6px">${safeHtml(p.status || "—")}</div></div>
</div>
<table>
  <thead><tr><th>#</th><th class="photo">Photo</th><th>Code</th><th>Description</th><th>Qty</th></tr></thead>
  <tbody>${body || `<tr><td colspan="5">No tools currently on this project.</td></tr>`}</tbody>
</table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /** Standard catalog sheet columns (import + export). */
  const CATALOG_SHEET_HEADERS = [
    "Code", "Category", "Subcategory", "Item", "Description",
    "Min stock", "Stock qty", "Price (Optional)", "Unit", "Image URL"
  ];

  /** Column keys in same order (import parser). */
  const IMPORT_COLUMN_ORDER = [
    "code", "category", "subcategory", "item", "description",
    "minStock", "stockQty", "price", "unit", "imageUrl"
  ];

  function catalogHeaders() {
    return [...CATALOG_SHEET_HEADERS];
  }

  function catalogRow(item) {
    return [
      item.code || "",
      item.category || "",
      item.subcategory || "",
      item.item || "",
      item.description || "",
      item.minStock != null ? item.minStock : "",
      item.available != null ? item.available : "",
      item.price != null ? item.price : item.cost != null ? item.cost : "",
      item.unit || "pcs",
      item.imageUrl || ""
    ];
  }

  function exportCatalogExcel(items, opts) {
    opts = opts || {};
    const label = opts.label || stamp();
    const rows = (items || []).map((i) => catalogRow(i));
    const aoa = [catalogHeaders(), ...rows];
    excelFromSheets(
      [{
        name: "Products",
        aoa,
        cols: [
          { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 32 },
          { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 36 }
        ]
      }],
      `products-${opts.withImages ? "with-images-" : ""}${label}`
    );
  }

  function exportCatalogPdf(items, opts) {
    opts = opts || {};
    const withImages = opts.withImages !== false; // default ON for printables
    const label = opts.label || stamp();
    const list = items || [];

    if (!withImages) {
      const body = list.map((i) => `<tr>
        <td class="photo">${productThumbHtml(i.imageUrl, 36)}</td>
        <td>${safeHtml(i.code || "")}</td>
        <td>${safeHtml(i.description || "")}</td>
        <td>${safeHtml(i.category || "")}</td>
        <td>${safeHtml(i.subcategory || "")}</td>
        <td>${safeHtml(i.item || "")}</td>
        <td>${safeHtml(i.available)}</td>
        <td>${safeHtml(i.out || i.issued || 0)}</td>
        <td>${safeHtml(i.minStock)}</td>
      </tr>`).join("");
      const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>products-${safeHtml(label)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: start; vertical-align: middle; }
  th { background: #0f766e; color: #fff; }
  tr:nth-child(even) td { background: #f8fafc; }
  ${PRODUCT_THUMB_CSS}
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<h1>Products catalog · AICS System</h1>
<div class="sub">${list.length} product(s) · ${safeHtml(label)}</div>
<table>
  <thead><tr>
    <th class="photo">Photo</th><th>Code</th><th>Description</th><th>Category</th><th>Subcategory</th>
    <th>Item</th><th>Avail</th><th>Out</th><th>Min</th>
  </tr></thead>
  <tbody>${body || `<tr><td colspan="9">—</td></tr>`}</tbody>
</table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
      const w = window.open("", "_blank");
      if (!w) throw new Error("Popup blocked — allow popups to export PDF");
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }

    const cards = list.map((i) => {
      const out = i.out || i.issued || 0;
      const img = absImg(i.imageUrl)
        ? `<img src="${safeHtml(absImg(i.imageUrl))}" alt="">`
        : `<div class="ph">—</div>`;
      return `<article class="card">
        <div class="thumb">${img}</div>
        <div class="info">
          <div class="name">${safeHtml(i.description || i.code || "")}</div>
          <div class="code">${safeHtml(i.code || "")}</div>
          <div class="meta">${safeHtml(i.category || "—")} / ${safeHtml(i.subcategory || "—")} / ${safeHtml(i.item || "—")}</div>
          <div class="stock">Avail ${safeHtml(i.available)} · Out ${safeHtml(out)} · Min ${safeHtml(i.minStock)}</div>
        </div>
      </article>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>products-with-images-${safeHtml(label)}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { display: grid; grid-template-columns: 72px 1fr; gap: 10px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; break-inside: avoid; page-break-inside: avoid; }
  .thumb { width: 72px; height: 72px; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: grid; place-items: center; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .ph { font-size: 12px; font-weight: 800; color: #94a3b8; }
  .name { font-weight: 800; font-size: 13px; }
  .code { font-size: 11px; color: #0f766e; font-weight: 700; margin: 2px 0 4px; }
  .meta, .stock { font-size: 10px; color: #64748b; }
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print { .noprint { display: none; } }
  @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<h1>Products catalog · with images</h1>
<div class="sub">${list.length} product(s) · ${safeHtml(label)}</div>
<div class="grid">${cards || "<p>No products</p>"}</div>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  const IMPORT_ALIASES = {
    code: ["code", "sku", "item code", "itemcode", "tool code", "toolcode", "product code", "productcode", "barcode"],
    category: ["category", "cat", "group"],
    subcategory: ["subcategory", "sub category", "subcat", "sub-category", "sub group", "subgroup"],
    item: ["item", "catalog item", "product item"],
    description: ["description", "name", "tool name", "toolname", "product name", "productname", "title", "desc"],
    minStock: ["min stock", "minstock", "min_stock", "reorder", "reorder level", "low stock"],
    stockQty: ["stock qty", "stockqty", "stock quantity", "stock", "qty", "quantity", "on hand", "onhand"],
    price: ["price", "cost", "unit price", "unitprice"],
    unit: ["unit", "uom"],
    imageUrl: ["image url", "imageurl", "image", "photo", "picture", "photo url", "picture url"]
  };

  function normHeader(h) {
    return String(h == null ? "" : h).trim().toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .replace(/[_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function mapImportHeaders(headers) {
    const map = {};
    const norms = headers.map(normHeader);
    Object.keys(IMPORT_ALIASES).forEach((field) => {
      const aliases = IMPORT_ALIASES[field];
      for (let i = 0; i < norms.length; i++) {
        if (aliases.includes(norms[i])) {
          map[field] = i;
          break;
        }
      }
    });
    return map;
  }

  function normalizeKind(v) {
    const s = String(v == null ? "" : v).trim().toLowerCase();
    if (!s) return "";
    if (["consumable", "consumables", "c", "cons"].includes(s)) return "consumable";
    if (["tool", "tools", "t", "equipment"].includes(s)) return "tool";
    return s;
  }

  /** Column order for import template / preview (matches user spreadsheet). */
  // IMPORT_COLUMN_ORDER defined above with CATALOG_SHEET_HEADERS

  function parseCatalogImportSheet(aoa) {
    const rowsRaw = Array.isArray(aoa) ? aoa : [];
    if (!rowsRaw.length) return { rows: [], errors: ["Empty file"], map: {} };
    const headers = rowsRaw[0] || [];
    const map = mapImportHeaders(headers);
    if (map.code == null || map.description == null) {
      return {
        rows: [],
        errors: ["Missing required columns: Code and Description (or Name)"],
        map
      };
    }
    const seen = new Set();
    const rows = [];
    const errors = [];
    for (let r = 1; r < rowsRaw.length; r++) {
      const line = rowsRaw[r] || [];
      if (!line.some((c) => String(c == null ? "" : c).trim() !== "")) continue;
      const cell = (field) => (map[field] == null ? "" : line[map[field]]);
      const code = String(cell("code") || "").trim().toUpperCase();
      const description = String(cell("description") || "").trim();
      const rowNum = r + 1;
      if (!code && !description) continue;
      if (!code) {
        errors.push({ row: rowNum, error: "CODE_REQUIRED" });
        continue;
      }
      if (!description) {
        errors.push({ row: rowNum, code, error: "DESCRIPTION_REQUIRED" });
        continue;
      }
      if (seen.has(code)) {
        errors.push({ row: rowNum, code, error: "DUPLICATE_IN_FILE" });
        continue;
      }
      seen.add(code);
      const stockRaw = cell("stockQty");
      const minRaw = cell("minStock");
      const itemName = String(cell("item") || "").trim();
      const row = {
        row: rowNum,
        code,
        category: String(cell("category") || "").trim(),
        subcategory: String(cell("subcategory") || "").trim(),
        item: itemName,
        description,
        minStock: String(minRaw == null ? "" : minRaw).trim() === "" ? 0 : Math.max(0, Number(minRaw) || 0),
        price: String(cell("price") || "").trim(),
        unit: String(cell("unit") || "").trim() || "pcs",
        imageUrl: String(cell("imageUrl") || "").trim()
      };
      if (String(stockRaw == null ? "" : stockRaw).trim() !== "") {
        row.stockQty = Math.max(0, Number(stockRaw) || 0);
      }
      rows.push(row);
    }
    return { rows, errors, map };
  }

  function parseCatalogImportWorkbook(wb) {
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) {
      return { rows: [], errors: ["No sheets in workbook"], map: {} };
    }
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    return parseCatalogImportSheet(aoa);
  }

  async function parseCatalogImportFile(file) {
    if (!file) throw new Error("No file selected");
    if (typeof XLSX === "undefined") throw new Error("Spreadsheet library not loaded");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return parseCatalogImportWorkbook(wb);
  }

  function downloadCatalogImportTemplate() {
    if (typeof XLSX === "undefined") throw new Error("Spreadsheet library not loaded");
    const aoa = [
      [...CATALOG_SHEET_HEADERS],
      ["C1-A", "CONSUMABLES", "WELDING CONSUMABLES", "CONSUMABLES", "WELDING GLASS NUMBER = 9", "10", "20", "30", "pcs", ""]
    ];
    excelFromSheets(
      [{
        name: "Import",
        aoa,
        cols: [
          { wch: 10 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 32 },
          { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }, { wch: 36 }
        ]
      }],
      "products-import-template"
    );
  }

  /** Store request Excel (with image URLs). */
  function exportStoreRequestExcel(request) {
    const req = request || {};
    const lines = Array.isArray(req.lines) ? req.lines : [];
    const label = stamp();
    const aoa = [
      ["Store Request", req.id || "", req.status || ""],
      ["By", req.byUser || "", "Created", req.timestamp ? new Date(req.timestamp).toLocaleString() : ""],
      ["Note", req.note || ""],
      [],
      ["Code", "Description", "Requested", "Received", "Remaining", "Line status", "Image URL"],
      ...lines.map((l) => [
        l.code || "",
        l.description || "",
        l.qtyRequested != null ? l.qtyRequested : "",
        l.qtyReceived != null ? l.qtyReceived : "",
        l.qtyRemaining != null ? l.qtyRemaining : "",
        l.lineStatus || "",
        l.imageUrl || "",
      ]),
    ];
    excelFromSheets(
      [{ name: "Request", aoa, cols: [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 40 }] }],
      `store-request-${req.id || "x"}-${label}`
    );
  }

  /** Store request PDF with product images + fulfillment progress. */
  function exportStoreRequestPdf(request) {
    const req = request || {};
    const lines = Array.isArray(req.lines) ? req.lines : [];
    const progress = req.progress || {};
    const safe = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const origin = (typeof location !== "undefined" && location.origin) ? location.origin : "https://aics.iskndr.com";
    const absImg = (url) => {
      const u = String(url || "").trim();
      if (!u) return "";
      if (/^https?:\/\//i.test(u) || u.startsWith("data:")) return u;
      if (u.startsWith("/")) return origin + u;
      return origin + "/" + u.replace(/^\.\//, "");
    };
    const status = String(req.status || "Open");
    const created = req.timestamp
      ? new Date(req.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : "";
    const cards = lines.map((l) => {
      const imgUrl = absImg(l.imageUrl);
      const img = imgUrl ? `<img src="${safe(imgUrl)}" alt="">` : `<div class="ph">📦</div>`;
      const rem = l.qtyRemaining != null ? l.qtyRemaining : Math.max(0, (l.qtyRequested || 0) - (l.qtyReceived || 0));
      return `<article class="card">
        <div class="thumb">${img}</div>
        <div class="info">
          <div class="name">${safe(l.description || l.code || "Item")}</div>
          <div class="code">${safe(l.code || "—")}</div>
          <div class="qty">
            <span>Req <b>${safe(l.qtyRequested)}</b></span>
            <span>Recv <b>${safe(l.qtyReceived)}</b></span>
            <span class="${rem > 0 ? "rem" : "ok"}">Left <b>${safe(rem)}</b></span>
          </div>
          <div class="lst">${safe(l.lineStatus || "")}</div>
        </div>
      </article>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>Store request #${safe(req.id || "")}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 14px; }
  .top { display: flex; justify-content: space-between; gap: 12px; border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 12px; }
  .brand { font-size: 16px; font-weight: 800; color: #0f766e; }
  .brand small { display: block; font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; }
  .meta { text-align: right; font-size: 12px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
  .Open { background: #e2e8f0; color: #334155; }
  .Partial { background: #ffedd5; color: #c2410c; }
  .Done { background: #dcfce7; color: #14532d; }
  .Cancelled { background: #fee2e2; color: #991b1b; }
  .bar { height: 8px; background: #e2e8f0; border-radius: 999px; overflow: hidden; margin: 8px 0 14px; }
  .bar > i { display: block; height: 100%; background: linear-gradient(90deg,#0f766e,#16a34a); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .card { display: grid; grid-template-columns: 64px 1fr; gap: 10px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 8px; break-inside: avoid; }
  .thumb { width: 64px; height: 64px; border-radius: 8px; overflow: hidden; background: #f1f5f9; display: grid; place-items: center; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }
  .ph { font-size: 20px; opacity: .5; }
  .name { font-weight: 800; font-size: 12px; }
  .code { font-size: 11px; color: #0f766e; font-weight: 700; margin: 2px 0 4px; }
  .qty { display: flex; gap: 10px; font-size: 10px; color: #64748b; }
  .qty .rem { color: #c2410c; font-weight: 700; }
  .qty .ok { color: #14532d; }
  .lst { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; margin-top: 4px; font-weight: 700; }
  .note { font-size: 12px; color: #475569; margin: 0 0 12px; }
  .foot { margin-top: 14px; font-size: 9px; color: #94a3b8; text-align: center; }
  @media print { .noprint { display: none !important; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer;border-radius:8px;border:0;background:#0f766e;color:#fff">Print / Save PDF</button>
<div class="top">
  <div class="brand">Store Request #${safe(req.id || "—")}<small>AICS System</small></div>
  <div class="meta">
    <div><span class="badge ${safe(status)}">${safe(status)}</span></div>
    <div style="margin-top:6px">${safe(req.byUser || "")}</div>
    <div style="color:#64748b">${safe(created)}</div>
  </div>
</div>
${req.note ? `<p class="note"><strong>Note:</strong> ${safe(req.note)}</p>` : ""}
<div style="font-size:12px;font-weight:700;margin-bottom:4px">
  Progress ${safe(progress.pct || 0)}% · ${safe(progress.linesDone || 0)}/${safe(progress.linesTotal || lines.length)} lines ·
  Received ${safe(progress.totalReceived || 0)} / ${safe(progress.totalRequested || 0)}
</div>
<div class="bar"><i style="width:${safe(progress.pct || 0)}%"></i></div>
<div class="grid">${cards || "<p>No lines</p>"}</div>
<div class="foot">${PRINT_CREDIT}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},450);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /** Printable A4 tool issue / return form + optional client-only photo pages. */
  function printProjectHandover(dispatch) {
    const d = dispatch || {};
    const project = d.project || {};
    const lines = Array.isArray(d.lines) ? d.lines : [];
    const photos = Array.isArray(d.printPhotos) ? d.printPhotos.filter(Boolean) : [];
    const safe = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const isReturn = String(d.type || "").toLowerCase() === "return";
    const title = isReturn ? "Tool Return Form" : "Tool Dispatch & Handover Form";
    const companyName = "ARABIAN INTEGRATED CONSTRUCTION SERVICES";
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    const logoUrl = origin + "/aics-logo.png";
    const issued = d.issuedAt ? new Date(d.issuedAt) : new Date();
    const dateStr = Number.isNaN(issued.getTime())
      ? ""
      : issued.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

    const phone = String(d.recipientPhone || "").trim();
    const iqama = String(d.recipientResidenceNo || "").trim();
    const recipientRows = [
      `<div class="val">${safe(d.recipientName || "—")}</div>`,
      phone ? `<div class="hint"><strong>Phone:</strong> ${safe(phone)}</div>` : "",
      iqama ? `<div class="hint"><strong>Iqama / residence:</strong> ${safe(iqama)}</div>` : "",
    ].join("");

    const vehicle = String(d.vehiclePlate || "").trim();
    const vehicleDisp = vehicle && vehicle !== "—" ? vehicle : "Not Assigned";

    const qrTarget = origin + "/project.html?id=" + encodeURIComponent(d.projectId || "")
      + "&form=" + encodeURIComponent(d.formNo || "");
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=6&data="
      + encodeURIComponent(qrTarget);
    const editUrl = origin + "/project-dispatch.html?edit=" + encodeURIComponent(d.id || "");

    const rows = lines.map((l, i) => {
      const cond = String(l.condition || l.notes || "Good").trim() || "Good";
      return `<tr>
      <td class="n">${i + 1}</td>
      <td class="photo">${productThumbHtml(l.imageUrl, 42)}</td>
      <td class="code">${safe(l.code)}</td>
      <td>${safe(l.description || "")}</td>
      <td class="n qty">${safe(l.qty != null ? l.qty : l.qtySent)}</td>
      <td class="cond"><span class="pill">${safe(cond)}</span></td>
    </tr>`;
    }).join("");

    const totalPages = 1 + photos.length;
    const formNo = d.formNo || "—";
    const pageFoot = (n) =>
      `<div class="page-foot">
        <div class="credit">${PRINT_CREDIT}</div>
        <div class="formref">${safe(companyName)} · ${safe(formNo)}</div>
        <div class="pagenum">Page ${n} of ${totalPages}</div>
      </div>`;

    const photoPages = photos.map((src, i) => `
  <div class="print-page photo-page">
    <div class="photo-head">
      <div>
        <div class="lbl">Attachment</div>
        <div class="val">${safe(formNo)} · Photo ${i + 1} of ${photos.length}</div>
      </div>
      <div class="sub">${safe(project.name || "")} · ${safe(project.code || "")}</div>
    </div>
    <div class="photo-body"><img src="${safe(src)}" alt="Attachment ${i + 1}"></div>
    ${pageFoot(i + 2)}
  </div>`).join("");

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${safe(d.formNo || "Tool form")}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: "Plus Jakarta Sans", "Segoe UI", Tahoma, sans-serif;
    color: #0f172a; background: #e2e8f0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .print-page {
    max-width: 190mm; margin: 12px auto; background: #fff;
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 24px 60px -28px rgba(15,23,42,.45);
    border: 1px solid #cbd5e1;
    position: relative;
    page-break-after: always;
    break-after: page;
  }
  .print-page:last-child { page-break-after: auto; break-after: auto; }
  .accent-bar {
    height: 6px;
    background: linear-gradient(90deg, #14532d 0%, #16a34a 45%, #a3e635 100%);
  }
  .header {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 16px 22px 14px;
    background:
      radial-gradient(120% 80% at 0% 0%, rgba(34,197,94,.12), transparent 55%),
      linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    border-bottom: 1px solid #e2e8f0;
  }
  .brand-wrap { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .brand-logo {
    width: 68px; height: 68px; object-fit: contain; flex-shrink: 0;
    filter: drop-shadow(0 6px 14px rgba(20,83,45,.18));
  }
  .brand .co {
    display: block; font-size: 12.5px; font-weight: 800; letter-spacing: .04em;
    color: #14532d; text-transform: uppercase; line-height: 1.3; max-width: 290px;
  }
  .brand .tag {
    display: inline-flex; margin-top: 6px;
    font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
    color: #166534; background: #dcfce7; border: 1px solid #bbf7d0;
    padding: 3px 9px; border-radius: 999px;
  }
  .header-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
  .doc-meta {
    text-align: right; min-width: 148px; padding: 10px 12px; border-radius: 12px;
    background: linear-gradient(180deg, #f0fdf4 0%, #fff 100%); border: 1px solid #bbf7d0;
  }
  .doc-meta .lbl {
    font-size: 9px; font-weight: 800; letter-spacing: .14em;
    text-transform: uppercase; color: #64748b; margin-bottom: 4px;
  }
  .doc-meta .no { font-size: 14px; font-weight: 800; color: #14532d; }
  .doc-meta .sub { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 600; }
  .qr-box {
    width: 78px; height: 78px; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 4px; background: #fff; display: flex; align-items: center; justify-content: center;
  }
  .qr-box img { width: 100%; height: 100%; object-fit: contain; }
  .body { padding: 16px 22px 8px; }
  .title-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-bottom: 14px;
  }
  .title-row h1 {
    margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: #0f172a;
  }
  .badge {
    font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
    padding: 7px 14px; border-radius: 999px; display: inline-flex; align-items: center; gap: 7px;
  }
  .badge.dispatch { background: #dcfce7; color: #14532d; border: 1px solid #86efac; }
  .badge.return { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px; }
  .box {
    position: relative; overflow: hidden;
    border: 1px solid #e2e8f0; border-radius: 12px;
    padding: 10px 12px 11px; background: #f8fafc;
  }
  .box::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, #16a34a, #14532d);
  }
  .box .lbl {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .1em; color: #64748b; margin-bottom: 4px;
  }
  .box .val { font-size: 13px; font-weight: 700; color: #0f172a; line-height: 1.35; }
  .box .hint { font-size: 11px; font-weight: 600; color: #64748b; margin-top: 3px; }
  .box.span-2 { grid-column: span 2; }
  .section-label {
    font-size: 10px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
    color: #64748b; margin: 2px 0 8px;
  }
  table.items {
    width: 100%; border-collapse: separate; border-spacing: 0;
    font-size: 12px; margin: 0 0 14px; border-radius: 12px; overflow: hidden;
    border: 1px solid #e2e8f0;
  }
  table.items th, table.items td {
    padding: 8px 10px; text-align: left; vertical-align: top;
    border-bottom: 1px solid #e2e8f0;
  }
  table.items th {
    background: linear-gradient(180deg, #14532d, #166534);
    color: #fff; font-size: 10px; font-weight: 800;
    text-transform: uppercase; letter-spacing: .06em;
  }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  table.items tbody tr:last-child td { border-bottom: 0; }
  td.n, th.n { text-align: center; width: 34px; }
  td.qty, th.qty { text-align: center; width: 48px; font-weight: 800; }
  td.code { font-weight: 800; color: #166534; white-space: nowrap; }
  td.cond { width: 88px; }
  ${PRODUCT_THUMB_CSS}
  .pill {
    display: inline-block; font-size: 10px; font-weight: 800;
    padding: 3px 8px; border-radius: 999px;
    background: #ecfdf5; color: #14532d; border: 1px solid #bbf7d0;
  }
  .decl {
    font-size: 11.5px; line-height: 1.55; color: #334155; margin: 0 0 16px;
    padding: 11px 13px; border-radius: 12px;
    background: linear-gradient(135deg, #f0fdf4, #f8fafc);
    border: 1px solid #bbf7d0;
  }
  .decl strong { color: #14532d; }
  .signs { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 6px; }
  .sign {
    border: 1px solid #cbd5e1; border-radius: 14px; min-height: 110px;
    padding: 12px; display: flex; flex-direction: column;
    background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
  }
  .sign .ttl {
    font-size: 9.5px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .06em; color: #64748b; margin-bottom: 4px;
  }
  .sign .who { font-size: 13px; font-weight: 800; color: #0f172a; }
  .sign .line {
    margin-top: auto; border-top: 1px dashed #94a3b8; padding-top: 6px;
    font-size: 10px; color: #64748b; display: flex; justify-content: space-between; gap: 8px;
    font-weight: 600;
  }
  .page-foot {
    margin-top: 8px; padding: 8px 22px 12px;
    border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;
  }
  .page-foot .credit {
    font-size: 9px; font-weight: 700; color: #475569; margin-bottom: 4px;
  }
  .page-foot .formref {
    font-size: 9px; font-weight: 600; color: #94a3b8; letter-spacing: .02em;
  }
  .page-foot .pagenum {
    margin-top: 4px; font-size: 11px; font-weight: 800; color: #14532d; letter-spacing: .04em;
  }
  .photo-page { min-height: 260mm; display: flex; flex-direction: column; }
  .photo-head {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding: 14px 18px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  }
  .photo-head .lbl {
    font-size: 9px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #64748b;
  }
  .photo-head .val { font-size: 14px; font-weight: 800; color: #14532d; margin-top: 3px; }
  .photo-head .sub { font-size: 11px; font-weight: 600; color: #64748b; text-align: right; }
  .photo-body {
    flex: 1; display: flex; align-items: center; justify-content: center;
    padding: 16px; min-height: 210mm;
  }
  .photo-body img {
    max-width: 100%; max-height: 220mm; object-fit: contain;
    border-radius: 8px; border: 1px solid #e2e8f0;
  }
  .noprint { margin: 14px auto; max-width: 190mm; text-align: center; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .noprint button, .noprint a {
    padding: 10px 18px; font-weight: 800; cursor: pointer; border-radius: 10px;
    border: 0; background: #14532d; color: #fff; font-family: inherit; font-size: 13px;
    text-decoration: none; display: inline-flex; align-items: center;
  }
  .noprint a.secondary { background: #fff; color: #14532d; border: 1px solid #14532d; }
  @media print {
    body { background: #fff; }
    .print-page { margin: 0; box-shadow: none; border: 0; border-radius: 0; max-width: none; }
    .noprint { display: none !important; }
  }
</style></head><body>
  <div class="noprint">
    ${d.id ? `<a class="secondary" href="${safe(editUrl)}">✎ Edit invoice</a>` : ""}
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>
  <div class="print-page">
    <div class="accent-bar"></div>
    <div class="header">
      <div class="brand-wrap">
        <img class="brand-logo" src="${safe(logoUrl)}" alt="AICS">
        <div class="brand">
          <span class="co">${safe(companyName)}</span>
          <span class="tag">AICS · Projects</span>
        </div>
      </div>
      <div class="header-right">
        <div class="doc-meta">
          <div class="lbl">Dispatch ID</div>
          <div class="no">${safe(formNo)}</div>
          <div class="sub">${safe(dateStr)}</div>
        </div>
        <div class="qr-box"><img src="${safe(qrUrl)}" alt="QR"></div>
      </div>
    </div>

    <div class="body">
      <div class="title-row">
        <h1>${safe(title)}</h1>
        ${isReturn
          ? '<span class="badge return">↩ RETURNED</span>'
          : '<span class="badge dispatch">DISPATCHED</span>'}
      </div>

      <div class="grid">
        <div class="box span-2">
          <div class="lbl">Project</div>
          <div class="val">${safe(project.name || "—")}</div>
          ${project.site ? `<div class="hint">${safe(project.site)}</div>` : ""}
        </div>
        <div class="box">
          <div class="lbl">Project Code</div>
          <div class="val">${safe(project.code || "—")}</div>
        </div>
        <div class="box span-2">
          <div class="lbl">${isReturn ? "Returned by / to" : "Recipient"}</div>
          ${recipientRows}
        </div>
        <div class="box">
          <div class="lbl">Vehicle Plate</div>
          <div class="val">${safe(vehicleDisp)}</div>
        </div>
      </div>

      <div class="section-label">Items</div>
      <table class="items">
        <thead>
          <tr>
            <th class="n">#</th>
            <th class="photo">Photo</th>
            <th>Code</th>
            <th>Description</th>
            <th class="n qty">Qty</th>
            <th>Condition</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#64748b;padding:18px">No lines</td></tr>'}</tbody>
      </table>

      <p class="decl"><strong>Declaration:</strong> ${isReturn
        ? "I confirm the tools listed above have been returned to the store in the quantities and condition shown."
        : "I confirm receipt of the tools listed above for the named project. I am responsible for their custody on site until returned to the store."}</p>

      <div class="section-label">Handwritten approvals</div>
      <div class="signs">
        <div class="sign">
          <div class="ttl">Logistic Manager</div>
          <div class="who">Suheil Murad</div>
          <div class="line"><span>Sign</span><span>Date</span></div>
        </div>
        <div class="sign">
          <div class="ttl">Store Manager</div>
          <div class="who">MAHMOUD ISKANDAR</div>
          <div class="line"><span>Sign</span><span>Date</span></div>
        </div>
        <div class="sign">
          <div class="ttl">${isReturn ? "Returned by" : "Recipient"}</div>
          <div class="who">${safe(d.recipientName || "—")}</div>
          <div class="line"><span>Sign</span><span>Date</span></div>
        </div>
      </div>
    </div>
    ${pageFoot(1)}
  </div>
  ${photoPages}
<script>window.onload=function(){setTimeout(function(){window.print();},500);};</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to print");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  /** Blind inventory count sheet — Code / Description / Counted Qty / Remarks only */
  function printInventoryCountSheet(payload) {
    const p = payload || {};
    const count = p.count || {};
    const lines = Array.isArray(p.lines) ? p.lines : [];
    const safe = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const companyName = "ARABIAN INTEGRATED CONSTRUCTION SERVICES";
    const companyShort = "AICS";
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    const logoUrl = origin + "/aics-logo.png";
    const created = count.createdAt ? new Date(count.createdAt) : new Date();
    const dateStr = Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const isCategory = String(count.countType || "").toLowerCase() === "category";
    const isProject = String(count.locationType || "").toLowerCase() === "project";
    const typeLabel = isCategory ? "Category Inventory" : "Full Inventory";
    const formNo = count.formNo || "—";
    const category = String(count.category || "").trim();
    const warehouse = String(count.locationName || count.warehouseName || "").trim();
    const locationLabel = isProject ? "Project" : "Warehouse";
    const byUser = String(count.byUser || "").trim();
    // ~18 data rows fit on first A4 page with this header/footer layout
    const estPages = Math.max(1, Math.ceil(Math.max(lines.length, 1) / 18));

    const rows = lines.map((l, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td class="photo">${productThumbHtml(l.imageUrl, 40)}</td>
      <td class="code">${safe(l.code)}</td>
      <td class="desc">${safe(l.description || "")}</td>
      <td class="blank qty"></td>
      <td class="blank rem"></td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${safe(formNo)} — Inventory Count</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait;
    margin: 9mm 10mm 16mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: "IBM Plex Sans", "Segoe UI", Tahoma, sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: "IBM Plex Sans", "Segoe UI", Tahoma, sans-serif;
    color: #0f172a; background: #e8eef4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    max-width: 190mm; margin: 12px auto; background: #fff;
    border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;
    box-shadow: 0 18px 40px -24px rgba(15,23,42,.4);
  }
  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 14px;
    background: linear-gradient(90deg, #0f3d36 0%, #14532d 55%, #166534 100%);
    color: #fff;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand img {
    width: 42px; height: 42px; object-fit: contain; background: #fff;
    border-radius: 8px; padding: 3px; flex-shrink: 0;
  }
  .brand .co {
    font-size: 11px; font-weight: 700; letter-spacing: .04em;
    text-transform: uppercase; line-height: 1.25; max-width: 280px;
  }
  .brand .sub {
    display: block; margin-top: 3px; font-size: 10px; font-weight: 600;
    opacity: .85; letter-spacing: .08em; text-transform: uppercase;
  }
  .doc-no {
    text-align: right; flex-shrink: 0;
    background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22);
    border-radius: 8px; padding: 7px 10px; min-width: 132px;
  }
  .doc-no .lbl { font-size: 8px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
  .doc-no .val { font-family: "IBM Plex Mono", monospace; font-size: 13px; font-weight: 700; margin-top: 2px; }
  .body { padding: 12px 14px 14px; }
  .title {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #14532d;
  }
  .title h1 {
    margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -.01em;
  }
  .pill {
    font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    padding: 5px 10px; border-radius: 999px;
    background: #ecfdf5; color: #14532d; border: 1px solid #86efac;
    white-space: nowrap;
  }
  .meta {
    display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr; gap: 6px;
    margin-bottom: 8px;
  }
  .meta .cell {
    border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 8px; background: #f8fafc;
  }
  .meta .lbl {
    font-size: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase;
    color: #64748b; margin-bottom: 2px;
  }
  .meta .val { font-size: 11.5px; font-weight: 700; line-height: 1.3; word-break: break-word; }
  .note {
    font-size: 10px; font-weight: 600; color: #475569;
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px;
    padding: 5px 8px; margin: 0 0 8px;
  }
  table.items {
    width: 100%; border-collapse: collapse;
    font-size: 10.5px; border: 1px solid #cbd5e1;
  }
  table.items th, table.items td {
    border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: middle;
  }
  table.items th {
    background: #14532d; color: #fff;
    font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;
    text-align: left;
  }
  table.items th.n, table.items th.qty, table.items th.rem { text-align: center; }
  table.items tbody tr:nth-child(even) td.n,
  table.items tbody tr:nth-child(even) td.code,
  table.items tbody tr:nth-child(even) td.desc { background: #f8fafc; }
  ${PRODUCT_THUMB_CSS}
  td.n { width: 28px; text-align: center; color: #64748b; font-weight: 600; }
  td.code {
    width: 78px; font-family: "IBM Plex Mono", monospace;
    font-weight: 700; color: #14532d; white-space: nowrap;
  }
  td.desc { line-height: 1.25; }
  td.blank {
    background: #fff !important; height: 22px;
  }
  td.qty { width: 88px; }
  td.rem { width: 110px; }
  th.qty { width: 88px; }
  th.rem { width: 110px; }
  .sign {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;
    margin-top: 14px; padding-top: 6px;
  }
  .sign .box .lbl {
    font-size: 9px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: #64748b; margin-bottom: 22px;
  }
  .sign .line {
    border-top: 1px solid #94a3b8; padding-top: 4px;
    font-size: 9px; color: #64748b; font-weight: 600;
  }
  .foot {
    margin-top: 10px; display: flex; flex-direction: column; gap: 4px;
    font-size: 9px; font-weight: 600; color: #64748b;
    border-top: 1px solid #e2e8f0; padding-top: 6px;
  }
  .foot .row {
    display: flex; justify-content: space-between; align-items: baseline; gap: 10px; flex-wrap: wrap;
  }
  .foot .credit { color: #475569; font-weight: 700; }
  .foot .pages { white-space: nowrap; }
  .noprint {
    position: sticky; top: 0; z-index: 5;
    display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;
    padding: 10px; background: rgba(15,23,42,.92); backdrop-filter: blur(6px);
  }
  .noprint button {
    font-family: inherit; font-weight: 700; font-size: 13px;
    padding: 9px 18px; border-radius: 9px; border: 0; cursor: pointer;
  }
  .noprint .print { background: #16a34a; color: #fff; }
  .noprint .close { background: #334155; color: #fff; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; max-width: none; border: 0; border-radius: 0; box-shadow: none; }
    .noprint { display: none !important; }
    .foot .pages-screen { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    .sign { page-break-inside: avoid; }
  }
</style></head><body>
<div class="noprint">
  <button type="button" class="print" onclick="window.print()">Print / Save as PDF</button>
  <button type="button" class="close" onclick="window.close()">Close</button>
</div>
<div class="sheet">
  <div class="topbar">
    <div class="brand">
      <img src="${safe(logoUrl)}" alt="${safe(companyShort)}" onerror="this.style.display='none'">
      <div>
        <div class="co">${safe(companyName)}</div>
        <span class="sub">Blind inventory count</span>
      </div>
    </div>
    <div class="doc-no">
      <div class="lbl">Count No.</div>
      <div class="val">${safe(formNo)}</div>
    </div>
  </div>
  <div class="body">
    <div class="title">
      <h1>Inventory Count Sheet</h1>
      <span class="pill">${safe(typeLabel)}</span>
    </div>
    <div class="meta">
      <div class="cell"><div class="lbl">${safe(locationLabel)}</div><div class="val">${safe(warehouse || "—")}</div></div>
      <div class="cell"><div class="lbl">Count type</div><div class="val">${safe(typeLabel)}</div></div>
      <div class="cell"><div class="lbl">${isCategory ? "Category" : "Date"}</div><div class="val">${safe(isCategory ? (category || "—") : dateStr)}</div></div>
      <div class="cell"><div class="lbl">${isCategory ? "Date / By" : "Created by"}</div><div class="val">${safe(isCategory ? (dateStr + (byUser ? " · " + byUser : "")) : (byUser || "—"))}</div></div>
    </div>
    ${!isCategory ? "" : `<div class="note">Category filter: <strong>${safe(category || "—")}</strong> · Created by <strong>${safe(byUser || "—")}</strong></div>`}
    <div class="note">Write Counted Quantity and Remarks by hand. System stock is hidden (blind count).</div>
    <table class="items">
      <thead>
        <tr>
          <th class="n">#</th>
          <th class="photo">Photo</th>
          <th>Code</th>
          <th>Description</th>
          <th class="qty">Counted Qty</th>
          <th class="rem">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="6" style="text-align:center;color:#64748b;padding:16px">No products</td></tr>`}
      </tbody>
    </table>
    <div class="sign">
      <div class="box"><div class="lbl">Counted by</div><div class="line">Name / Signature / Date</div></div>
      <div class="box"><div class="lbl">Checked by</div><div class="line">Name / Signature / Date</div></div>
      <div class="box"><div class="lbl">Approved by</div><div class="line">Name / Signature / Date</div></div>
    </div>
    <div class="foot">
      <div class="row">
        <span>${safe(companyShort)} · ${safe(formNo)} · ${lines.length} item(s)</span>
        <span class="pages pages-screen">Page 1 of ${estPages}</span>
      </div>
      <div class="row">
        <span class="credit">${PRINT_CREDIT}</span>
      </div>
    </div>
  </div>
</div>
<script>
  window.onload = function () {
    setTimeout(function () { try { window.print(); } catch (e) {} }, 450);
  };
</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to print");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function exportScrapExcel(items, label) {
    const rows = (items || []).map((i) => [
      i.code || "",
      i.description || "",
      absImg(i.imageUrl || ""),
      i.state || "Scrap",
      i.updatedAt || "",
      i.note || "",
      i.byUser || ""
    ]);
    excelFromSheets(
      [{
        name: "Scrap",
        aoa: [["Code", "Description", "Image URL", "State", "Updated", "Note", "By"], ...rows],
        cols: [{ wch: 12 }, { wch: 36 }, { wch: 42 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 14 }]
      }],
      `scrap-list-${label || stamp()}`
    );
  }

  function exportScrapPdf(items, label) {
    const list = items || [];
    const body = list.map((i) => `<tr>
      <td class="photo">${productThumbHtml(i.imageUrl, 36)}</td>
      <td>${safeHtml(i.code || "")}</td>
      <td>${safeHtml(i.description || "")}</td>
      <td>${safeHtml(i.state || "Scrap")}</td>
      <td>${safeHtml(i.updatedAt || "")}</td>
      <td>${safeHtml(i.note || "")}</td>
      <td>${safeHtml(i.byUser || "")}</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>scrap-list-${safeHtml(label || stamp())}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #0f172a; margin: 0; padding: 12px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #64748b; font-size: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: middle; text-align: start; }
  th { background: #0f766e; color: #fff; }
  tr:nth-child(even) td { background: #f8fafc; }
  ${PRODUCT_THUMB_CSS}
  .tc-print-credit { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 9px; font-weight: 700; color: #64748b; }
  @media print { .noprint { display: none; } }
</style></head><body>
<button class="noprint" onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700;cursor:pointer">Print / Save PDF</button>
<h1>Scrap list</h1>
<div class="sub">AICS System · ${safeHtml(label || stamp())} · ${list.length} item(s)</div>
<table>
  <thead><tr>
    <th class="photo">Photo</th><th>Code</th><th>Description</th><th>State</th><th>Updated</th><th>Note</th><th>By</th>
  </tr></thead>
  <tbody>${body || `<tr><td colspan="7">—</td></tr>`}</tbody>
</table>
${printCreditBlock()}
<script>window.onload=function(){setTimeout(function(){window.print();},400);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to export PDF");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function printWarehouseTransfer(transfer) {
    const tr = transfer || {};
    const lines = Array.isArray(tr.lines) ? tr.lines : [];
    const safe = (v) => String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const companyName = "ARABIAN INTEGRATED CONSTRUCTION SERVICES";
    const companyShort = "AICS";
    const origin = (typeof location !== "undefined" && location.origin)
      ? location.origin
      : "https://aics.iskndr.com";
    const logoUrl = origin + "/aics-logo.png";
    const created = tr.createdAt ? new Date(tr.createdAt) : new Date();
    const dateStr = Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    const formNo = tr.formNo || "—";
    const totalQty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const estPages = Math.max(1, Math.ceil(Math.max(lines.length, 1) / 18));
    const rows = lines.map((l, i) => `<tr>
      <td class="n">${i + 1}</td>
      <td class="photo">${productThumbHtml(l.imageUrl, 40)}</td>
      <td class="code">${safe(l.code)}</td>
      <td class="desc">${safe(l.description || "")}</td>
      <td class="qty">${safe(l.qty)}</td>
    </tr>`).join("");

    const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><title>${safe(formNo)} — Warehouse Transfer</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600;700&family=IBM+Plex+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
  @page {
    size: A4 portrait; margin: 9mm 10mm 16mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-family: "IBM Plex Sans", "Segoe UI", Tahoma, sans-serif;
      font-size: 8pt; color: #64748b;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0;
    font-family: "IBM Plex Sans", "Segoe UI", Tahoma, sans-serif;
    color: #0f172a; background: #e8eef4;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet {
    max-width: 190mm; margin: 12px auto; background: #fff;
    border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;
  }
  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 14px;
    background: linear-gradient(90deg, #0f3d36 0%, #14532d 55%, #166534 100%);
    color: #fff;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .brand img {
    width: 42px; height: 42px; object-fit: contain; background: #fff;
    border-radius: 8px; padding: 3px; flex-shrink: 0;
  }
  .brand .co { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .brand .sub { display: block; margin-top: 3px; font-size: 10px; font-weight: 600; opacity: .85; text-transform: uppercase; }
  .doc-no {
    text-align: right; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.22);
    border-radius: 8px; padding: 7px 10px; min-width: 132px;
  }
  .doc-no .lbl { font-size: 8px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .8; }
  .doc-no .val { font-family: "IBM Plex Mono", monospace; font-size: 13px; font-weight: 700; margin-top: 2px; }
  .body { padding: 12px 14px 14px; }
  .title { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #14532d; }
  .title h1 { margin: 0; font-size: 16px; font-weight: 700; }
  .pill { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 5px 10px; border-radius: 999px; background: #ecfdf5; color: #14532d; border: 1px solid #86efac; }
  .meta { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .meta .cell { border: 1px solid #e2e8f0; border-radius: 7px; padding: 6px 8px; background: #f8fafc; }
  .meta .lbl { font-size: 8px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
  .meta .val { font-size: 12px; font-weight: 700; }
  table.items { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.items th, table.items td { border: 1px solid #cbd5e1; padding: 5px 6px; }
  table.items th { background: #14532d; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; text-align: left; }
  ${PRODUCT_THUMB_CSS}
  td.n { width: 28px; text-align: center; color: #64748b; font-weight: 600; }
  td.code { width: 90px; font-family: "IBM Plex Mono", monospace; font-weight: 700; color: #14532d; }
  td.qty { width: 70px; text-align: center; font-weight: 700; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-top: 14px; }
  .sign .lbl { font-size: 9px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #64748b; margin-bottom: 22px; }
  .sign .line { border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 9px; color: #64748b; font-weight: 600; }
  .foot { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; font-size: 9px; font-weight: 600; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  .foot .row { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .foot .credit { color: #475569; font-weight: 700; }
  .noprint { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; gap: 8px; padding: 10px; background: rgba(15,23,42,.92); }
  .noprint button { font-family: inherit; font-weight: 700; font-size: 13px; padding: 9px 18px; border-radius: 9px; border: 0; cursor: pointer; }
  .noprint .print { background: #16a34a; color: #fff; }
  .noprint .close { background: #334155; color: #fff; }
  @media print {
    body { background: #fff; }
    .sheet { margin: 0; max-width: none; border: 0; border-radius: 0; box-shadow: none; }
    .noprint, .pages-screen { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style></head><body>
<div class="noprint">
  <button type="button" class="print" onclick="window.print()">Print / Save as PDF</button>
  <button type="button" class="close" onclick="window.close()">Close</button>
</div>
<div class="sheet">
  <div class="topbar">
    <div class="brand">
      <img src="${safe(logoUrl)}" alt="${safe(companyShort)}" onerror="this.style.display='none'">
      <div>
        <div class="co">${safe(companyName)}</div>
        <span class="sub">Warehouse transfer invoice</span>
      </div>
    </div>
    <div class="doc-no">
      <div class="lbl">Transfer No.</div>
      <div class="val">${safe(formNo)}</div>
    </div>
  </div>
  <div class="body">
    <div class="title">
      <h1>Warehouse Transfer</h1>
      <span class="pill">${lines.length} item(s) · qty ${totalQty}</span>
    </div>
    <div class="meta">
      <div class="cell"><div class="lbl">From</div><div class="val">${safe(tr.fromWarehouse || "—")}</div></div>
      <div class="cell"><div class="lbl">To</div><div class="val">${safe(tr.toWarehouse || "—")}</div></div>
      <div class="cell"><div class="lbl">Date</div><div class="val">${safe(dateStr || "—")}</div></div>
      <div class="cell"><div class="lbl">Created by</div><div class="val">${safe(tr.byUser || "—")}</div></div>
    </div>
    ${tr.note ? `<div class="meta" style="grid-template-columns:1fr"><div class="cell"><div class="lbl">Note</div><div class="val">${safe(tr.note)}</div></div></div>` : ""}
    <table class="items">
      <thead><tr><th class="n">#</th><th class="photo">Photo</th><th>Code</th><th>Description</th><th class="qty">Qty</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:16px">No lines</td></tr>`}</tbody>
    </table>
    <div class="sign">
      <div class="box"><div class="lbl">Prepared by</div><div class="line">Name / Signature / Date</div></div>
      <div class="box"><div class="lbl">Received by</div><div class="line">Name / Signature / Date</div></div>
      <div class="box"><div class="lbl">Approved by</div><div class="line">Name / Signature / Date</div></div>
    </div>
    <div class="foot">
      <div class="row">
        <span>${safe(companyShort)} · ${safe(formNo)} · ${lines.length} item(s)</span>
        <span class="pages-screen">Page 1 of ${estPages}</span>
      </div>
      <div class="row"><span class="credit">${PRINT_CREDIT}</span></div>
    </div>
  </div>
</div>
<script>window.onload=function(){setTimeout(function(){try{window.print();}catch(e){}},450);};</script>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) throw new Error("Popup blocked — allow popups to print");
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return {
    stamp,
    PRINT_CREDIT,
    excelFromSheets,
    pdfTable,
    exportOutstandingExcel,
    exportOutstandingPdf,
    exportPersonExcel,
    exportPersonPdf,
    exportProjectOnSiteExcel,
    exportProjectOnSitePdf,
    exportCatalogExcel,
    exportCatalogPdf,
    parseCatalogImportFile,
    parseCatalogImportSheet,
    parseCatalogImportWorkbook,
    downloadCatalogImportTemplate,
    printProjectHandover,
    printInventoryCountSheet,
    printWarehouseTransfer,
    exportStoreRequestExcel,
    exportStoreRequestPdf,
    exportScrapExcel,
    exportScrapPdf,
    IMPORT_COLUMN_ORDER,
    CATALOG_SHEET_HEADERS
  };
})();
if (typeof window !== "undefined") window.TCExport = TCExport;
