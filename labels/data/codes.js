/** Parse / format code queues for printing. */
export function parseCodeLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      return { code: parts[0] || "", name: parts.slice(1).join(" | ") || "" };
    })
    .filter((x) => x.code);
}

/**
 * Parse CSV / TSV text into { code, name } items.
 * Accepts header row with code/sku/id and name/desc columns (optional).
 */
export function parseCsvCodes(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const splitRow = (line) => {
    if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
    // simple CSV (handles quoted fields lightly)
    const cells = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  };

  let start = 0;
  let codeIdx = 0;
  let nameIdx = 1;
  const header = splitRow(lines[0]).map((h) => h.toLowerCase());
  const looksHeader = header.some((h) =>
    /^(code|sku|id|barcode|item|name|desc|description|title)$/.test(h)
  );
  if (looksHeader) {
    start = 1;
    const ci = header.findIndex((h) => /^(code|sku|id|barcode|item)$/.test(h));
    const ni = header.findIndex((h) => /^(name|desc|description|title)$/.test(h));
    if (ci >= 0) codeIdx = ci;
    if (ni >= 0) nameIdx = ni;
  }

  const items = [];
  for (let i = start; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    const code = String(cells[codeIdx] || "").trim();
    if (!code) continue;
    const name = String(cells[nameIdx] || "").trim();
    items.push({ code, name });
  }
  return items;
}

export function itemsToText(items) {
  return (items || [])
    .map((it) => (it.name ? `${it.code} | ${it.name}` : it.code))
    .join("\n");
}

export function downloadJson(doc, filename = "label-template.json") {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json"
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
