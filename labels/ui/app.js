/**
 * ui/app.js — QR Labels wizard bootstrap (redesign v10)
 * Isolated to labels page. Preserves API contracts & document model.
 */
import { LabelStudio } from "../editor/studio.js";
import { LabelPreview } from "./preview.js";
import { printLabels } from "../print/labels.js";
import { createDocument, setPageMode, bindItem } from "../core/document.js";
import { renderLabel } from "../render/engine.js";
import * as LabelApi from "../data/api.js";
import {
  getLastTemplateId,
  setLastTemplateId,
  loadCalibration
} from "../data/storage.js";
import { mountCalibrationWizard } from "../print/calibration.js";
import { parseCodeLines, itemsToText, downloadJson } from "../data/codes.js";
import { parseServerTemplate, serializeDocument } from "../data/serialize.js";
import { ensureQrLibrary } from "../render/engine.js";
import { TEMPLATE_LIBRARY, buildLibraryTemplate } from "../data/presets.js";
import { exportSheetPng, exportSheetPdf } from "../export/sheet.js";

const AUTOSAVE_KEY = "tc_label_draft_v10";
const DEFAULT_TPL_KEY = "tc_default_label_tpl_id";

function t(key, fallback) {
  if (typeof TCI18N !== "undefined" && TCI18N.t) return TCI18N.t(key) || fallback || key;
  return fallback || key;
}

function toast(msg, kind = "ok") {
  if (typeof TCUI !== "undefined" && TCUI.toast) TCUI.toast(msg, kind);
  else console.log(`[${kind}]`, msg);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export async function bootLabelApp() {
  await ensureQrLibrary().catch((e) => console.warn("[QR Labels] QR lib", e));

  let templates = [];
  let activeId = null;
  let documentModel = createDocument();
  let lastItems = [];
  let catalogIndex = new Map(); // code -> description
  let pickerTab = "tools";
  let pickerItems = [];
  let pickerTicks = new Set();
  let step = 1;
  let tplFilter = "";
  let liveTimer = 0;

  const editorHost = document.getElementById("editorHost");
  const studio = new LabelStudio(editorHost, {
    onChange: (doc) => {
      documentModel = createDocument(doc);
      syncSizeFields();
      scheduleLivePreview();
      markDirtyAutosave();
    }
  });

  // Dual preview hosts: inline (step 4) + modal
  const preview = new LabelPreview({
    host: document.getElementById("labels"),
    metaEl: document.getElementById("previewMeta"),
    flipToggle: document.getElementById("previewFlip")
  });
  const previewInline = new LabelPreview({
    host: document.getElementById("labelsInline"),
    metaEl: document.getElementById("previewMetaInline"),
    flipToggle: document.getElementById("previewFlip")
  });

  document.getElementById("previewFlip")?.addEventListener("change", () => {
    preview.redraw();
    previewInline.redraw();
  });
  document.getElementById("thermalSim")?.addEventListener("change", (e) => {
    document.getElementById("labelsInline")?.classList.toggle("thermal-sim", !!e.target.checked);
  });

  /* ---------------------------- wizard steps ---------------------------- */
  function goStep(n) {
    step = Math.max(1, Math.min(4, Number(n) || 1));
    document.querySelectorAll(".ql-panel-step").forEach((p) => {
      p.hidden = Number(p.dataset.panel) !== step;
    });
    document.querySelectorAll(".ql-step").forEach((b) => {
      const s = Number(b.dataset.step);
      b.classList.toggle("is-active", s === step);
      b.classList.toggle("is-done", s < step);
      b.setAttribute("aria-current", s === step ? "step" : "false");
    });
    if (step === 4 && lastItems.length) {
      previewInline.show(documentModel, lastItems, {
        flip: document.getElementById("previewFlip")?.checked
      }).catch(() => {});
    }
  }
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      readSizeFieldsIntoDocument();
      goStep(btn.dataset.goto);
    });
  });
  document.querySelectorAll(".ql-step").forEach((btn) => {
    btn.addEventListener("click", () => goStep(btn.dataset.step));
  });

  /* ---------------------------- size / mode ----------------------------- */
  function syncSizeFields() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set("cW", documentModel.labelW);
    set("cH", documentModel.labelH);
    set("cCols", documentModel.cols);
    set("cRows", documentModel.rows);
    set("cGap", documentModel.gapX);
    set("cMargin", documentModel.marginX);
    set("cOrient", documentModel.orientation);
    const meta = document.getElementById("activeMeta");
    if (meta) meta.textContent = `${documentModel.labelW}×${documentModel.labelH} mm · ${documentModel.page}`;
    const chipTxt = document.getElementById("activeModeChipTxt");
    if (chipTxt) {
      chipTxt.textContent =
        documentModel.page === "a4" ? "A4" : documentModel.page === "a3" ? "A3" : "Thermal";
    }
    document.querySelectorAll("#printMode .ql-mode-card").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === documentModel.page);
    });
    const thermal = documentModel.page === "thermal";
    ["orientField", "colsField", "rowsField"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = thermal ? "none" : "";
    });
    document.querySelectorAll("[data-mode-count]").forEach((el) => {
      const mode = el.dataset.modeCount;
      if (mode === documentModel.page) {
        el.textContent = String(documentModel.cols * documentModel.rows);
      } else if (mode === "a4") el.textContent = "24";
      else if (mode === "a3") el.textContent = "40";
    });
    scheduleLivePreview();
  }

  function readSizeFieldsIntoDocument() {
    documentModel = createDocument({
      ...documentModel,
      labelW: Number(document.getElementById("cW")?.value) || 50,
      labelH: Number(document.getElementById("cH")?.value) || 30,
      cols: Number(document.getElementById("cCols")?.value) || 4,
      rows: Number(document.getElementById("cRows")?.value) || 6,
      gapX: Number(document.getElementById("cGap")?.value) || 0,
      gapY: Number(document.getElementById("cGap")?.value) || 0,
      marginX: Number(document.getElementById("cMargin")?.value) || 0,
      marginY: Number(document.getElementById("cMargin")?.value) || 0,
      orientation: document.getElementById("cOrient")?.value || "portrait",
      layers: documentModel.layers,
      style: documentModel.style
    });
    syncSizeFields();
    markDirtyAutosave();
  }

  ["cW", "cH", "cCols", "cRows", "cGap", "cMargin", "cOrient"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", readSizeFieldsIntoDocument);
  });

  document.querySelectorAll("#printMode .ql-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      documentModel = setPageMode(documentModel, btn.dataset.mode);
      syncSizeFields();
      markDirtyAutosave();
    });
  });

  /* ---------------------------- templates ------------------------------- */
  function defaultTplId() {
    try {
      return Number(localStorage.getItem(DEFAULT_TPL_KEY)) || null;
    } catch {
      return null;
    }
  }

  async function renderTemplateList() {
    const host = document.getElementById("tplList");
    if (!host) return;
    const q = tplFilter.trim().toLowerCase();
    const list = templates.filter((tpl) => !q || String(tpl.name).toLowerCase().includes(q));
    if (!list.length) {
      host.innerHTML = `<div class="ql-empty-tpl">${t("noTemplatesYet", "No templates yet")}</div>`;
      return;
    }
    const defId = defaultTplId();
    host.innerHTML = list
      .map((tpl) => {
        const parsed = parseServerTemplate(tpl);
        const cfg = parsed.document;
        const isDef = defId === tpl.id;
        return `<button type="button" class="ql-tpl ${tpl.id === activeId ? "active" : ""}" data-id="${tpl.id}" role="option" aria-selected="${tpl.id === activeId}">
          <div class="thumb" data-thumb="${tpl.id}"></div>
          <div>
            <div class="name">${escapeHtml(tpl.name)}${isDef ? '<span class="badge-default">DEFAULT</span>' : ""}</div>
            <div class="meta">${cfg.labelW || "?"}×${cfg.labelH || "?"} · ${cfg.page || "thermal"}</div>
          </div>
          <span class="del" data-del="${tpl.id}" title="Delete" aria-label="Delete">✕</span>
        </button>`;
      })
      .join("");

    // Async thumbnails (first few)
    for (const tpl of list.slice(0, 12)) {
      paintThumb(tpl).catch(() => {});
    }
  }

  async function paintThumb(tpl) {
    const host = document.querySelector(`[data-thumb="${tpl.id}"]`);
    if (!host) return;
    const doc = parseServerTemplate(tpl).document;
    const sample = { code: "DEMO", name: "Sample" };
    const node = await renderLabel(
      { ...doc, layers: bindItem(doc, sample) },
      sample,
      { mode: "preview", applyCalibration: false }
    );
    host.innerHTML = "";
    node.style.transform = "scale(0.35)";
    node.style.transformOrigin = "center center";
    host.appendChild(node);
  }

  async function loadTemplates() {
    const host = document.getElementById("tplList");
    if (host) host.innerHTML = `<div class="ql-empty-tpl">${t("loading", "Loading…")}</div>`;
    try {
      templates = await LabelApi.listTemplates();
      await renderTemplateList();
      const last = getLastTemplateId();
      const def = defaultTplId();
      const pick =
        templates.find((x) => x.id === last) ||
        templates.find((x) => x.id === def) ||
        templates[0];
      if (pick) applyServerTemplate(pick);
      else restoreDraftOrBlank();
    } catch (e) {
      if (host) host.innerHTML = `<div class="ql-empty-tpl">${escapeHtml(e.message || e)}</div>`;
      restoreDraftOrBlank();
    }
  }

  function applyServerTemplate(item) {
    activeId = item.id;
    setLastTemplateId(item.id);
    const parsed = parseServerTemplate(item);
    documentModel = parsed.document;
    const nameEl = document.getElementById("activeNameLabel");
    if (nameEl) nameEl.textContent = item.name;
    syncSizeFields();
    renderTemplateList();
    clearAutosave();
  }

  document.getElementById("tplSearch")?.addEventListener("input", (e) => {
    tplFilter = e.target.value || "";
    renderTemplateList();
  });

  document.getElementById("tplList")?.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = Number(del.dataset.del);
      const tpl = templates.find((x) => x.id === id);
      if (!tpl) return;
      if (!confirm(`Delete “${tpl.name}”?`)) return;
      try {
        await LabelApi.deleteTemplate(id);
        templates = templates.filter((x) => x.id !== id);
        if (activeId === id) {
          activeId = null;
          setLastTemplateId(null);
        }
        await renderTemplateList();
        toast(t("templateDeleted", "Deleted"), "ok");
      } catch (err) {
        toast(err.message || err, "err");
      }
      return;
    }
    const btn = e.target.closest(".ql-tpl");
    if (!btn) return;
    if (e.detail === 2) {
      try {
        localStorage.setItem(DEFAULT_TPL_KEY, btn.dataset.id);
        toast("Marked as default template", "ok");
        renderTemplateList();
      } catch (_) {}
      return;
    }
    const item = templates.find((x) => String(x.id) === btn.dataset.id);
    if (item) applyServerTemplate(item);
  });

  document.getElementById("btnNewTpl")?.addEventListener("click", () => {
    activeId = null;
    documentModel = createDocument();
    const nameEl = document.getElementById("activeNameLabel");
    if (nameEl) nameEl.textContent = t("unsavedTemplate", "New unsaved template");
    syncSizeFields();
    renderTemplateList();
    studio.open(documentModel);
  });

  /* ---------------------------- starter library ------------------------- */
  function renderLibrary() {
    const host = document.getElementById("libGrid");
    if (!host) return;
    host.innerHTML = TEMPLATE_LIBRARY.map(
      (lib) => `<button type="button" class="ql-lib-card" data-lib="${lib.id}">
        <strong>${escapeHtml(lib.name)}</strong>
        <span>${escapeHtml(lib.blurb)}</span>
      </button>`
    ).join("");
    host.querySelectorAll("[data-lib]").forEach((btn) => {
      btn.onclick = () => {
        activeId = null;
        documentModel = buildLibraryTemplate(btn.dataset.lib);
        const nameEl = document.getElementById("activeNameLabel");
        if (nameEl) nameEl.textContent = TEMPLATE_LIBRARY.find((x) => x.id === btn.dataset.lib)?.name || "Library";
        syncSizeFields();
        renderTemplateList();
        markDirtyAutosave();
        toast("Starter template loaded — Save to keep it", "ok");
        goStep(2);
      };
    });
  }

  /* ---------------------------- studio / save --------------------------- */
  document.getElementById("btnOpenStudio")?.addEventListener("click", (e) => {
    e?.preventDefault?.();
    readSizeFieldsIntoDocument();
    studio.open(documentModel);
  });

  async function saveTpl(forceNew) {
    readSizeFieldsIntoDocument();
    let name = "";
    const existing = templates.find((x) => x.id === activeId);
    if (!forceNew && existing) name = existing.name;
    else {
      name = prompt(t("templateNamePrompt", "Template name"), existing ? existing.name + " copy" : "");
      if (name == null) return;
      name = String(name).trim();
    }
    if (!name) {
      toast(t("templateNameRequired", "Enter a template name"), "err");
      return;
    }
    try {
      const item = await LabelApi.saveTemplate(
        name,
        documentModel,
        !forceNew && activeId ? activeId : null
      );
      const idx = templates.findIndex((x) => x.id === item.id);
      if (idx >= 0) templates[idx] = item;
      else templates.unshift(item);
      applyServerTemplate(item);
      toast(t("templateSaved", `Saved “${name}”`).replace("{name}", name), "ok");
    } catch (e) {
      toast(e.message || e, "err");
    }
  }
  document.getElementById("btnSaveTpl")?.addEventListener("click", () => saveTpl(false));
  document.getElementById("btnSaveAsTpl")?.addEventListener("click", () => saveTpl(true));

  /* ---------------------------- codes / validate ------------------------ */
  async function warmCatalogIndex() {
    try {
      const [people, catalog] = await Promise.all([
        LabelApi.listPeople().catch(() => []),
        LabelApi.listCatalog().catch(() => [])
      ]);
      catalogIndex = new Map();
      people.forEach((p) => catalogIndex.set(String(p.code).toUpperCase(), p.name || p.fullName || ""));
      catalog.forEach((it) =>
        catalogIndex.set(String(it.code).toUpperCase(), it.description || it.name || "")
      );
    } catch (_) {}
  }

  function validateCodes() {
    const items = parseCodeLines(document.getElementById("codes")?.value);
    const seen = new Map();
    const dups = [];
    const missing = [];
    items.forEach((it) => {
      const c = String(it.code || "").toUpperCase();
      if (!c) return;
      if (seen.has(c)) dups.push(c);
      else seen.set(c, true);
      if (
        catalogIndex.size &&
        !catalogIndex.has(c) &&
        c !== "IN" &&
        c !== "OUT"
      ) {
        missing.push(c);
      }
    });
    const host = document.getElementById("codeAlerts");
    const ready = document.getElementById("readyCount");
    if (ready) ready.textContent = `${items.length} ready`;
    if (host) {
      const parts = [];
      if (items.length) parts.push(`<span class="ok">${items.length} label(s) queued</span>`);
      if (dups.length) parts.push(`<span class="warn">Duplicates: ${escapeHtml(dups.join(", "))}</span>`);
      if (missing.length) {
        parts.push(
          `<span class="err">Not in catalog: ${escapeHtml(missing.slice(0, 8).join(", "))}${missing.length > 8 ? "…" : ""}</span>`
        );
      }
      host.innerHTML = parts.join(" · ");
    }
    const bar = document.getElementById("selectedBar");
    const count = document.getElementById("selectedCount");
    if (count) count.textContent = String(items.length);
    if (bar) bar.style.display = items.length ? "" : "none";
    scheduleLivePreview();
    return items;
  }

  document.getElementById("codes")?.addEventListener("input", () => validateCodes());

  document.getElementById("btnDir")?.addEventListener("click", () => {
    const ta = document.getElementById("codes");
    if (!ta) return;
    const extra = "IN | Direction IN\nOUT | Direction OUT";
    ta.value = ta.value.trim() ? ta.value.trim() + "\n" + extra : extra;
    validateCodes();
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    const codes = document.getElementById("codes");
    if (codes) codes.value = "";
    lastItems = [];
    ["labels", "labelsInline"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = `<span class="labels-empty-msg">${t("labelsPreviewEmpty", "Generate labels to preview")}</span>`;
        el.classList.add("empty");
      }
    });
    validateCodes();
  });

  document.getElementById("csvImport")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        // CSV: code,name or code|name
        if (l.includes("|")) return l;
        const parts = l.split(",").map((x) => x.replace(/^"|"$/g, "").trim());
        return parts.length > 1 ? `${parts[0]} | ${parts.slice(1).join(" ")}` : parts[0];
      });
    const ta = document.getElementById("codes");
    if (ta) ta.value = ta.value.trim() ? ta.value.trim() + "\n" + lines.join("\n") : lines.join("\n");
    validateCodes();
    toast(`Imported ${lines.length} line(s)`, "ok");
    e.target.value = "";
  });

  /* ---------------------------- generate / print ------------------------ */
  async function generateAll() {
    readSizeFieldsIntoDocument();
    lastItems = parseCodeLines(document.getElementById("codes")?.value);
    if (!lastItems.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    if (lastItems.length > 500) {
      if (!confirm(`Render ${lastItems.length} labels? Large batches may take a while.`)) return;
    }
    goStep(4);
    const flip = document.getElementById("previewFlip")?.checked;
    try {
      await Promise.all([
        previewInline.show(documentModel, lastItems, { flip }),
        preview.show(documentModel, lastItems, { flip })
      ]);
      toast(t("labelsGenerated", "Labels generated"), "ok");
      // Client-side print audit (local only — no API change)
      try {
        const key = "tc_label_print_stats_v1";
        const stats = JSON.parse(localStorage.getItem(key) || "{}");
        const month = new Date().toISOString().slice(0, 7);
        stats[month] = (stats[month] || 0) + lastItems.length;
        localStorage.setItem(key, JSON.stringify(stats));
      } catch (_) {}
    } catch (e) {
      console.error("[QR Labels] generate failed", e);
      toast(e.message || String(e), "err");
    }
  }

  document.getElementById("btnGen")?.addEventListener("click", () => generateAll());

  async function doPrint(items) {
    if (!items?.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    try {
      await printLabels(documentModel, items, {
        flip: !!document.getElementById("previewFlip")?.checked
      });
    } catch (e) {
      toast(e.message || e, "err");
    }
  }

  document.getElementById("btnPrint")?.addEventListener("click", () => doPrint(lastItems));
  document.getElementById("btnPrintModal")?.addEventListener("click", () => doPrint(lastItems));
  document.getElementById("btnTestPrint")?.addEventListener("click", () => {
    const one = lastItems[0] || parseCodeLines(document.getElementById("codes")?.value)[0];
    if (!one) {
      toast("Queue at least one code for a test print", "err");
      return;
    }
    doPrint([one]);
  });

  document.getElementById("btnExportPng")?.addEventListener("click", async () => {
    if (!lastItems.length) return toast("Generate first", "err");
    try {
      await exportSheetPng(documentModel, lastItems, {
        flip: !!document.getElementById("previewFlip")?.checked
      });
      toast("PNG exported", "ok");
    } catch (e) {
      toast(e.message || e, "err");
    }
  });
  document.getElementById("btnExportPdf")?.addEventListener("click", async () => {
    if (!lastItems.length) return toast("Generate first", "err");
    try {
      await exportSheetPdf(documentModel, lastItems, {
        flip: !!document.getElementById("previewFlip")?.checked
      });
      toast("PDF exported", "ok");
    } catch (e) {
      toast(e.message || e, "err");
    }
  });

  function openPreview() {
    document.getElementById("previewModal")?.classList.add("open");
  }
  function closePreview() {
    document.getElementById("previewModal")?.classList.remove("open");
  }
  document.getElementById("btnOpenPreview")?.addEventListener("click", openPreview);
  document.getElementById("btnClosePreview")?.addEventListener("click", closePreview);
  document.getElementById("btnClosePreview2")?.addEventListener("click", closePreview);

  /* ---------------------------- picker ---------------------------------- */
  const pickerModal = document.getElementById("pickerModal");
  document.getElementById("btnPick")?.addEventListener("click", () => openPicker());
  document.getElementById("btnClosePicker")?.addEventListener("click", () =>
    pickerModal?.classList.remove("open")
  );

  async function openPicker() {
    pickerModal?.classList.add("open");
    pickerTicks = new Set();
    await loadPickerTab(pickerTab);
  }

  document.getElementById("pickerTabs")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    pickerTab = btn.dataset.tab;
    document.querySelectorAll("#pickerTabs button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    await loadPickerTab(pickerTab);
  });

  async function loadPickerTab(tab) {
    const list = document.getElementById("pickerList");
    if (!list) return;
    list.innerHTML = `<div class="ql-hint">${t("loading", "Loading…")}</div>`;
    try {
      if (tab === "people") {
        const people = await LabelApi.listPeople();
        pickerItems = people.map((p) => ({
          code: p.code,
          name: p.name || p.fullName || "",
          kind: "person"
        }));
      } else {
        const catalog = await LabelApi.listCatalog();
        pickerItems = catalog
          .filter((it) => {
            const k = String(it.kind || it.category || "").toLowerCase();
            const code = String(it.code || "");
            if (tab === "consumables") {
              return k.includes("consum") || code.startsWith("C") || code.startsWith("B");
            }
            return !code.startsWith("P") && !(k.includes("consum") || code.startsWith("C"));
          })
          .map((it) => ({
            code: it.code,
            name: it.description || it.name || "",
            kind: "tool"
          }));
      }
      renderPickerList();
    } catch (e) {
      list.innerHTML = `<div class="ql-hint">${escapeHtml(e.message || e)}</div>`;
    }
  }

  function filteredPickerItems() {
    const q = String(document.getElementById("pickerSearch")?.value || "")
      .trim()
      .toUpperCase();
    if (!q) return pickerItems;
    return pickerItems.filter(
      (it) =>
        String(it.code).toUpperCase().includes(q) ||
        String(it.name).toUpperCase().includes(q)
    );
  }

  function renderPickerList() {
    const list = document.getElementById("pickerList");
    if (!list) return;
    const items = filteredPickerItems();
    list.innerHTML =
      items
        .map(
          (it) => `<label class="ql-picker-row">
        <input type="checkbox" data-code="${escapeHtml(it.code)}" ${pickerTicks.has(it.code) ? "checked" : ""}>
        <span><strong>${escapeHtml(it.code)}</strong> · ${escapeHtml(it.name || "")}</span>
      </label>`
        )
        .join("") || `<div class="ql-hint">${t("noResults", "No results")}</div>`;
    list.querySelectorAll("input[type=checkbox]").forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) pickerTicks.add(cb.dataset.code);
        else pickerTicks.delete(cb.dataset.code);
        const tick = document.getElementById("pickerTickCount");
        if (tick) tick.textContent = String(pickerTicks.size);
      };
    });
    const tick = document.getElementById("pickerTickCount");
    if (tick) tick.textContent = String(pickerTicks.size);
  }

  document.getElementById("pickerSearch")?.addEventListener("input", () => renderPickerList());
  document.getElementById("btnSelectFiltered")?.addEventListener("click", () => {
    filteredPickerItems().forEach((it) => pickerTicks.add(it.code));
    renderPickerList();
  });
  document.getElementById("btnClearSelection")?.addEventListener("click", () => {
    pickerTicks.clear();
    renderPickerList();
  });

  function applyPicker(mode) {
    const chosen = pickerItems.filter((it) => pickerTicks.has(it.code));
    const ta = document.getElementById("codes");
    if (!ta) return;
    const text = itemsToText(chosen);
    if (mode === "replace") ta.value = text;
    else ta.value = ta.value.trim() ? ta.value.trim() + "\n" + text : text;
    validateCodes();
    pickerModal?.classList.remove("open");
  }
  document.getElementById("btnApplyReplace")?.addEventListener("click", () => applyPicker("replace"));
  document.getElementById("btnApplyAdd")?.addEventListener("click", () => applyPicker("add"));

  /* ---------------------------- calibrate / json ------------------------ */
  document.getElementById("btnCalibrate")?.addEventListener("click", () => {
    const modal = document.getElementById("calibModal");
    modal?.classList.add("open");
    mountCalibrationWizard(document.getElementById("calibHost"), {
      labelW: documentModel.labelW,
      labelH: documentModel.labelH,
      onSaved: (cal) => {
        toast(t("calibSaved", "Printer profile saved"), "ok");
        updateCalibChip(cal);
      }
    });
  });
  document.getElementById("btnCloseCalib")?.addEventListener("click", () =>
    document.getElementById("calibModal")?.classList.remove("open")
  );

  document.getElementById("btnExportJson")?.addEventListener("click", () => {
    downloadJson(documentModel, `label-${documentModel.labelW}x${documentModel.labelH}.json`);
  });

  function updateCalibChip(cal) {
    const chip = document.getElementById("calibChip");
    if (!chip) return;
    const c = cal || loadCalibration();
    chip.textContent = `${c.printerName} · ${c.dpi}dpi · ×${c.scale}`;
  }

  /* ---------------------------- live preview ---------------------------- */
  function scheduleLivePreview() {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => paintLivePreview().catch(() => {}), 280);
  }

  async function paintLivePreview() {
    const host = document.getElementById("livePreview");
    if (!host) return;
    const items = parseCodeLines(document.getElementById("codes")?.value);
    const sample = items[0] || { code: "DEMO", name: "Sample label" };
    const node = await renderLabel(
      { ...documentModel, layers: bindItem(documentModel, sample) },
      sample,
      { mode: "preview", applyCalibration: false }
    );
    host.innerHTML = "";
    host.appendChild(node);
  }

  /* ---------------------------- autosave -------------------------------- */
  let autosaveTimer = 0;
  function markDirtyAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          AUTOSAVE_KEY,
          JSON.stringify({
            at: Date.now(),
            activeId,
            document: JSON.parse(serializeDocument(documentModel)),
            codes: document.getElementById("codes")?.value || ""
          })
        );
        const el = document.getElementById("autosaveStatus");
        if (el) el.textContent = `Draft saved · ${new Date().toLocaleTimeString()}`;
      } catch (_) {}
    }, 800);
  }

  function clearAutosave() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch (_) {}
    const el = document.getElementById("autosaveStatus");
    if (el) el.textContent = "";
  }

  function restoreDraftOrBlank() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.document && confirm("Restore unsaved draft from last session?")) {
          documentModel = createDocument(draft.document);
          activeId = draft.activeId || null;
          const ta = document.getElementById("codes");
          if (ta && draft.codes) ta.value = draft.codes;
          const nameEl = document.getElementById("activeNameLabel");
          if (nameEl) nameEl.textContent = activeId ? "Restored template" : "Restored draft";
          syncSizeFields();
          validateCodes();
          return;
        }
      }
    } catch (_) {}
    documentModel = createDocument();
    activeId = null;
    syncSizeFields();
  }

  /* ---------------------------- boot ------------------------------------ */
  updateCalibChip();
  renderLibrary();
  syncSizeFields();
  goStep(1);
  await warmCatalogIndex();
  await loadTemplates();
  validateCodes();
  scheduleLivePreview();
}

export default { bootLabelApp };
