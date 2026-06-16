/** منطق المخزون المشترك — results / worker / tool / dashboard */
const CustodyParser = (() => {

  function runInventory(rows) {
    const inv = {};
    let lastPerson = "General Store";
    let lastPersonCode = null;
    let lastDir = null;

    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const desc = row.toolDescription || "—";
      const rowDate = row.rowDate || "";
      const isToday = String(row.isTargetDay) === "true";
      if (!code) continue;

      if (code.startsWith("P")) {
        lastPerson = desc || code;
        lastPersonCode = code;
        lastDir = null;
        if (!inv[code]) inv[code] = { description: desc, isPerson: true, scannedToday: false, actionsToday: [], code };
        if (isToday) inv[code].scannedToday = true;
        continue;
      }
      if (code === "IN" || code === "OUT") {
        lastDir = code;
        continue;
      }
      if (!isTool(code)) continue;

      if (isConsumable(code)) {
        if (!inv[code]) {
          inv[code] = {
            description: desc, isPerson: false, isConsumable: true, scannedToday: false,
            actionsToday: [], holdersList: [], hasWarning: false, code, issuedToday: 0
          };
        }
        if (isToday) inv[code].scannedToday = true;
        if (!lastDir) {
          if (isToday) {
            inv[code].actionsToday.push(`⚠️ No direction set · ${lastPerson}`);
            inv[code].hasWarning = true;
          }
          continue;
        }
        if (lastDir === "OUT") {
          if (isToday) {
            inv[code].issuedToday = (inv[code].issuedToday || 0) + 1;
            inv[code].actionsToday.push(`📦 Issued to · ${lastPerson}`);
            if (lastPersonCode && inv[lastPersonCode]) {
              inv[lastPersonCode].actionsToday.push(`📦 Took consumable ${code} · ${desc}`);
            }
          }
        } else if (isToday) {
          inv[code].actionsToday.push(`📦 Return noted · ${lastPerson} (consumable — no custody)`);
        }
        continue;
      }

      if (!inv[code]) {
        inv[code] = {
          description: desc, isPerson: false, scannedToday: false,
          actionsToday: [], holdersList: [], hasWarning: false, code
        };
      }
      if (isToday) inv[code].scannedToday = true;

      if (!lastDir) {
        if (isToday) {
          inv[code].actionsToday.push(`⚠️ No direction set · ${lastPerson}`);
          inv[code].hasWarning = true;
        }
        continue;
      }

      if (lastDir === "IN") {
        const idx = inv[code].holdersList.lastIndexOf(lastPerson);
        if (idx !== -1) {
          inv[code].holdersList.splice(idx, 1);
          if (isToday) {
            inv[code].actionsToday.push(`📥 Returned by · ${lastPerson}`);
            if (lastPersonCode && inv[lastPersonCode]) {
              inv[lastPersonCode].actionsToday.push(`📥 Returned ${code} · ${desc}`);
            }
          }
        } else if (inv[code].holdersList.length > 0) {
          const orig = inv[code].holdersList.shift();
          if (isToday) {
            inv[code].actionsToday.push(`⚠️ Found & Returned by · ${lastPerson} (Lost by: ${orig})`);
            inv[code].hasWarning = true;
            if (lastPersonCode && inv[lastPersonCode]) {
              inv[lastPersonCode].actionsToday.push(`⚠️ Recovered ${code} (was with ${orig})`);
            }
          }
        } else if (isToday) {
          inv[code].actionsToday.push(`📥 Returned · ${lastPerson} (unregistered)`);
        }
      } else {
        inv[code].holdersList.push(lastPerson);
        if (isToday) {
          inv[code].actionsToday.push(`📤 Checked out to · ${lastPerson}`);
          if (lastPersonCode && inv[lastPersonCode]) {
            inv[lastPersonCode].actionsToday.push(`📤 Took ${code} · ${desc}`);
          }
        }
      }
    }
    return inv;
  }

  function buildPersonToolsMap(inv) {
    const map = {};
    for (const [code, item] of Object.entries(inv)) {
      if (item.isPerson || item.isConsumable) continue;
      item.holdersList.forEach(p => {
        if (!map[p]) map[p] = {};
        if (!map[p][code]) map[p][code] = { code, desc: item.description, qty: 0 };
        map[p][code].qty++;
      });
    }
    return map;
  }

  function computeToolTakenDates(rows, workerCode) {
    const taken = {};
    let person = "General Store", personCode = null, dir = null;
    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const rowDate = row.rowDate || "";
      if (!code) continue;
      if (code.startsWith("P")) {
        person = row.toolDescription || code;
        personCode = code;
        dir = null;
        continue;
      }
      if (code === "IN" || code === "OUT") { dir = code; continue; }
      if (!isTool(code) || isConsumable(code)) continue;
      if (dir === "OUT" && personCode === workerCode && !taken[code]) {
        taken[code] = rowDate;
      }
    }
    return taken;
  }

  function computeAllToolTakenDates(rows) {
    const taken = {};
    let person = "General Store", dir = null;
    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const rowDate = row.rowDate || "";
      if (!code) continue;
      if (code.startsWith("P")) {
        person = row.toolDescription || code;
        dir = null;
        continue;
      }
      if (code === "IN" || code === "OUT") { dir = code; continue; }
      if (!isTool(code) || isConsumable(code)) continue;
      if (dir === "OUT") {
        if (!taken[code]) taken[code] = {};
        taken[code][person] = rowDate;
      }
    }
    return taken;
  }

  function parseOverview(rows) {
    if (!rows || !rows.length) return { tools: [], workers: [], totalOut: 0, totalWorkers: 0, warnings: 0 };
    const inv = runInventory(rows);
    const personToolsMap = buildPersonToolsMap(inv);
    const tools = [], workers = [];
    let totalOut = 0, totalWorkers = 0, warnings = 0;

    for (const [code, item] of Object.entries(inv)) {
      if (item.isPerson) {
        if (item.scannedToday) {
          totalWorkers++;
          workers.push({
            name: item.description, code,
            toolsHeld: Object.values(personToolsMap[item.description] || {}),
            actionsToday: item.actionsToday || []
          });
        }
      } else if (item.isConsumable) {
        if (item.hasWarning) warnings++;
        if (item.scannedToday) {
          tools.push({
            code, description: item.description,
            holdersHtml: `<span class="badge-holder"><i class="bi bi-box-seam"></i> Consumable · logged only</span>`,
            qty: item.issuedToday || 0,
            isConsumable: true,
            actionsToday: item.actionsToday || [],
            hasWarning: item.hasWarning || false,
            holderNames: []
          });
        }
      } else {
        const qty = item.holdersList.length;
        totalOut += qty;
        if (item.hasWarning) warnings++;
        if (item.scannedToday || qty > 0) {
          const hMap = new Map();
          item.holdersList.forEach(p => hMap.set(p, (hMap.get(p) || 0) + 1));
          const holdersHtml = hMap.size === 0
            ? `<span class="text-success small fw-semibold"><i class="bi bi-house-fill me-1"></i>In store</span>`
            : Array.from(hMap.entries()).map(([p, q]) =>
              `<span class="badge-holder"><i class="bi bi-person-circle"></i>${escHtml(p)} <strong>×${q}</strong></span>`
            ).join("");
          tools.push({
            code, description: item.description, holdersHtml, qty,
            actionsToday: item.actionsToday || [],
            hasWarning: item.hasWarning || false,
            holderNames: Array.from(hMap.keys())
          });
        }
      }
    }
    tools.sort((a, b) => a.code.localeCompare(b.code));
    workers.sort((a, b) => a.name.localeCompare(b.name));
    return { tools, workers, totalOut, totalWorkers, warnings };
  }

  function parseForWorker(rows, workerCode, selectedDate) {
    const inv = runInventory(rows);
    const workerDailyLog = {};
    let workerName = workerCode;
    let lastPerson = "General Store", lastPersonCode = null, lastDir = null;

    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const desc = row.toolDescription || "—";
      const rowDate = row.rowDate || "";
      if (!code) continue;

      if (code.startsWith("P")) {
        lastPerson = desc || code;
        lastPersonCode = code;
        lastDir = null;
        if (code === workerCode) workerName = desc;
        if (!inv[code]) inv[code] = { description: desc, isPerson: true };
        continue;
      }
      if (code === "IN" || code === "OUT") { lastDir = code; continue; }
      if (!isTool(code)) continue;

      if (isConsumable(code)) {
        if (active && lastDir === "OUT") {
          if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
          workerDailyLog[rowDate].push({ type: "info", text: `📦 Took consumable ${code} · ${desc}` });
        }
        continue;
      }

      if (!inv[code]) inv[code] = { description: desc, isPerson: false, holdersList: [], hasWarning: false };
      const active = lastPersonCode === workerCode;

      if (!lastDir) {
        if (active) {
          if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
          workerDailyLog[rowDate].push({ type: "warn", text: `⚠️ Scanned ${code} (${desc}) — no direction set` });
          inv[code].hasWarning = true;
        }
        continue;
      }

      if (lastDir === "IN") {
        const idx = inv[code].holdersList.lastIndexOf(lastPerson);
        if (idx !== -1) {
          inv[code].holdersList.splice(idx, 1);
          if (active) {
            if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
            workerDailyLog[rowDate].push({ type: "in", text: `📥 Returned ${code} · ${desc}` });
          }
        } else if (inv[code].holdersList.length > 0) {
          const orig = inv[code].holdersList.shift();
          if (active) {
            if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
            workerDailyLog[rowDate].push({ type: "warn", text: `⚠️ Recovered ${code} · ${desc} (was with ${orig})` });
          }
          if (orig === workerName) {
            if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
            workerDailyLog[rowDate].push({ type: "warn", text: `⚠️ ${code} · ${desc} was recovered by ${lastPerson} (you lost it)` });
          }
          inv[code].hasWarning = true;
        } else if (active) {
          if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
          workerDailyLog[rowDate].push({ type: "in", text: `📥 Returned ${code} · ${desc} (unregistered state)` });
        }
      } else {
        inv[code].holdersList.push(lastPerson);
        if (active) {
          if (!workerDailyLog[rowDate]) workerDailyLog[rowDate] = [];
          workerDailyLog[rowDate].push({ type: "out", text: `📤 Took ${code} · ${desc}` });
        }
      }
    }

    const toolFirstTaken = computeToolTakenDates(rows, workerCode);
    const toolsHeld = [];
    for (const [code, item] of Object.entries(inv)) {
      if (item.isPerson || item.isConsumable) continue;
      const myCount = item.holdersList.filter(p => p === workerName).length;
      if (myCount > 0) {
        const takenDate = toolFirstTaken[code] || "unknown";
        toolsHeld.push({
          code, desc: item.description, qty: myCount, takenDate,
          isToday: takenDate === selectedDate
        });
      }
    }
    return { workerName, toolsHeld, workerDailyLog };
  }

  function parseForTool(rows, toolCode) {
    if (isConsumable(toolCode)) return parseForConsumable(rows, toolCode);

    let toolDesc = toolCode;
    const holdersList = [];
    const toolDailyLog = {};
    let hasWarning = false;
    let lastPerson = "General Store", lastPersonCode = null, lastDir = null;
    const personCodeMap = {};

    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const desc = row.toolDescription || "—";
      const rowDate = row.rowDate || "";
      if (!code) continue;

      if (code.startsWith("P")) {
        lastPerson = desc || code;
        lastPersonCode = code;
        lastDir = null;
        personCodeMap[lastPerson] = code;
        continue;
      }
      if (code === "IN" || code === "OUT") { lastDir = code; continue; }
      if (!isTool(code) || code !== toolCode) continue;

      toolDesc = desc;
      if (!lastDir) {
        if (!toolDailyLog[rowDate]) toolDailyLog[rowDate] = [];
        toolDailyLog[rowDate].push({ type: "warn", text: `⚠️ Scanned without direction · ${lastPerson}`, personCode: lastPersonCode });
        hasWarning = true;
        continue;
      }
      if (!toolDailyLog[rowDate]) toolDailyLog[rowDate] = [];
      if (lastDir === "IN") {
        const idx = holdersList.lastIndexOf(lastPerson);
        if (idx !== -1) {
          holdersList.splice(idx, 1);
          toolDailyLog[rowDate].push({ type: "in", text: `📥 Returned by · ${lastPerson}`, personCode: lastPersonCode });
        } else if (holdersList.length > 0) {
          const orig = holdersList.shift();
          toolDailyLog[rowDate].push({ type: "warn", text: `⚠️ Recovered by · ${lastPerson} (was with ${orig})`, personCode: lastPersonCode });
          hasWarning = true;
        } else {
          toolDailyLog[rowDate].push({ type: "in", text: `📥 Returned by · ${lastPerson} (unregistered)`, personCode: lastPersonCode });
        }
      } else {
        holdersList.push(lastPerson);
        toolDailyLog[rowDate].push({ type: "out", text: `📤 Checked out to · ${lastPerson}`, personCode: lastPersonCode });
      }
    }

    const hMap = new Map();
    holdersList.forEach(p => hMap.set(p, (hMap.get(p) || 0) + 1));
    const currentHolders = Array.from(hMap.entries()).map(([name, qty]) => ({
      name, qty, personCode: personCodeMap[name] || null
    }));
    return { toolDesc, currentHolders, toolDailyLog, hasWarning, qtyOut: holdersList.length };
  }

  function parseForConsumable(rows, toolCode) {
    let toolDesc = toolCode;
    const toolDailyLog = {};
    let issuedTotal = 0;
    let hasWarning = false;
    let lastPerson = "General Store", lastPersonCode = null, lastDir = null;

    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const desc = row.toolDescription || "—";
      const rowDate = row.rowDate || "";
      if (!code) continue;

      if (code.startsWith("P")) {
        lastPerson = desc || code;
        lastPersonCode = code;
        lastDir = null;
        continue;
      }
      if (code === "IN" || code === "OUT") { lastDir = code; continue; }
      if (code !== toolCode) continue;

      toolDesc = desc;
      if (!lastDir) {
        if (!toolDailyLog[rowDate]) toolDailyLog[rowDate] = [];
        toolDailyLog[rowDate].push({ type: "warn", text: `⚠️ Scanned without direction · ${lastPerson}`, personCode: lastPersonCode });
        hasWarning = true;
        continue;
      }
      if (!toolDailyLog[rowDate]) toolDailyLog[rowDate] = [];
      if (lastDir === "OUT") {
        issuedTotal++;
        toolDailyLog[rowDate].push({ type: "out", text: `📦 Issued to · ${lastPerson}`, personCode: lastPersonCode });
      } else {
        toolDailyLog[rowDate].push({ type: "info", text: `📦 Return noted · ${lastPerson} (no custody)`, personCode: lastPersonCode });
      }
    }

    return {
      toolDesc, currentHolders: [], toolDailyLog, hasWarning,
      qtyOut: 0, isConsumable: true, issuedTotal
    };
  }

  function parseDashboard(rows, selectedDate) {
    const overview = parseOverview(rows);
    const inv = runInventory(rows);
    const allTaken = computeAllToolTakenDates(rows);
    const alerts = [];
    const overdue = [];
    const holderRank = {};

    for (const t of overview.tools) {
      if (t.isConsumable) continue;
      if (t.hasWarning) {
        t.actionsToday.forEach(a => {
          if (a.includes("⚠️")) alerts.push({ type: "warn", text: `${t.code} · ${t.description}: ${a}` });
        });
      }
      if (t.description.includes("NOT FOUND") || t.description.includes("ERROR")) {
        alerts.push({ type: "error", text: `${t.code} — ${t.description}` });
      }
      if (t.qty > 0) {
        const hMap = new Map();
        inv[t.code].holdersList.forEach(p => hMap.set(p, (hMap.get(p) || 0) + 1));
        hMap.forEach((qty, person) => {
          holderRank[person] = (holderRank[person] || 0) + qty;
          const takenOn = (allTaken[t.code] && allTaken[t.code][person]) || selectedDate;
          if (takenOn !== selectedDate) {
            overdue.push({
              code: t.code, desc: t.description, person, takenOn, qty
            });
            alerts.push({
              type: "overdue",
              text: `${t.code} · ${t.description} with ${person} since ${takenOn}`
            });
          }
        });
      }
    }

    const topHolders = Object.entries(holderRank)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);

    const allClear = overview.totalOut === 0 && alerts.filter(a => a.type !== "info").length === 0;

    return {
      ...overview,
      alerts: alerts.slice(0, 20),
      overdue,
      overdueCount: overdue.length,
      topHolders,
      allClear,
      uniqueOut: overview.tools.filter(t => t.qty > 0).length
    };
  }

  function lookupTool(rows, query) {
    const q = (query || "").toUpperCase().trim();
    if (!q) return null;
    const overview = parseOverview(rows);
    const tool = overview.tools.find(t => t.code === q);
    if (tool) return { type: "tool", ...tool };
    const worker = overview.workers.find(w => w.code === q || w.name.toUpperCase().includes(q));
    if (worker) return { type: "worker", ...worker };
    return null;
  }

  function dotClass(type) {
    return { out: "dot-out", in: "dot-in", warn: "dot-warn", info: "dot-info", overdue: "dot-warn", error: "dot-warn" }[type] || "dot-info";
  }

  function dotIcon(type) {
    return {
      out: "bi-arrow-up-right", in: "bi-arrow-down-left",
      warn: "bi-exclamation-triangle-fill", error: "bi-exclamation-triangle-fill",
      overdue: "bi-clock-history", info: "bi-info-circle"
    }[type] || "bi-info-circle";
  }

  function extractTimeFromTimestamp(ts) {
    if (!ts) return "";
    const s = String(ts);
    const brace = s.indexOf("}");
    if (brace >= 0 && brace < s.length - 1) return s.slice(brace + 1).trim();
    return s;
  }

  function parseConsumableIssues(rows, selectedDates) {
    const dateSet = selectedDates instanceof Set ? selectedDates : new Set(selectedDates || []);
    const issues = [];
    let lastPerson = "General Store", lastPersonCode = null, lastDir = null;

    for (const row of rows || []) {
      const code = (row.toolCode || "").toString().toUpperCase().trim();
      const desc = row.toolDescription || "—";
      const rowDate = row.rowDate || "";
      const timestamp = row.timestamp || "";
      if (!code) continue;

      if (code.startsWith("P")) {
        lastPerson = desc || code;
        lastPersonCode = code;
        lastDir = null;
        continue;
      }
      if (code === "IN" || code === "OUT") { lastDir = code; continue; }
      if (!isConsumable(code)) continue;
      if (dateSet.size && !dateSet.has(rowDate)) continue;
      if (lastDir !== "OUT") continue;

      issues.push({
        date: rowDate,
        time: extractTimeFromTimestamp(timestamp),
        person: lastPerson,
        personCode: lastPersonCode || "",
        code,
        description: desc
      });
    }
    return issues;
  }

  function downloadBlob(filename, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportConsumablesCsv(issues, label) {
    const lines = ["Date,Time,Person,PersonCode,Code,Description"];
    (issues || []).forEach(r => {
      lines.push([
        `"${(r.date || "").replace(/"/g, '""')}"`,
        `"${(r.time || "").replace(/"/g, '""')}"`,
        `"${(r.person || "").replace(/"/g, '""')}"`,
        `"${(r.personCode || "").replace(/"/g, '""')}"`,
        r.code,
        `"${(r.description || "").replace(/"/g, '""')}"`
      ].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(`consumables-${label || "export"}.csv`, blob);
  }

  function exportConsumablesXlsx(issues, label) {
    if (typeof XLSX === "undefined") {
      exportConsumablesCsv(issues, label);
      return;
    }
    const rows = [
      ["Date", "Time", "Person", "Person Code", "Code", "Description"],
      ...(issues || []).map(r => [r.date, r.time, r.person, r.personCode, r.code, r.description])
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consumables");
    XLSX.writeFile(wb, `consumables-${label || "export"}.xlsx`);
  }

  function exportCsv(tools, date) {
    const lines = ["Code,Description,Qty,Status,Holder"];
    tools.forEach(t => {
      const holders = t.qty > 0 ? t.holderNames.join("; ") : "In store";
      lines.push([t.code, `"${t.description}"`, t.qty, t.qty > 0 ? "OUT" : "IN", `"${holders}"`].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `custody-${date.replace(/[{}]/g, "")}.csv`;
    a.click();
  }

  return {
    parseOverview, parseForWorker, parseForTool, parseForConsumable, parseDashboard,
    parseConsumableIssues, lookupTool, dotClass, dotIcon, exportCsv,
    exportConsumablesCsv, exportConsumablesXlsx
  };
})();
