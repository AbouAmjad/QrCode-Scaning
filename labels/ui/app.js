/**
 * ui/app.js — page bootstrap for qr-labels.html
 * Wires templates, studio, preview, print, picker, calibration.
 * Presentation only — document is the single source of truth.
 */
import { LabelStudio } from "../editor/studio.js";
import { LabelPreview } from "./preview.js";
import { printLabels } from "../print/labels.js";
import { createDocument, setPageMode } from "../core/document.js";
import * as LabelApi from "../data/api.js";
import {
  getLastTemplateId,
  setLastTemplateId,
  loadCalibration
} from "../data/storage.js";
import { mountCalibrationWizard } from "../print/calibration.js";
import { parseCodeLines, itemsToText, downloadJson } from "../data/codes.js";
import { parseServerTemplate } from "../data/serialize.js";
import { ensureQrLibrary } from "../render/engine.js";

function t(key, fallback) {
  if (typeof TCI18N !== "undefined" && TCI18N.t) return TCI18N.t(key) || fallback || key;
  return fallback || key;
}

function toast(msg, kind = "ok") {
  if (typeof TCUI !== "undefined" && TCUI.toast) TCUI.toast(msg, kind);
  else console.log(`[${kind}]`, msg);
}

export async function bootLabelApp() {
  await ensureQrLibrary().catch((e) => console.warn("[QR Labels] QR lib", e));

  let templates = [];
  let activeId = null;
  let documentModel = createDocument();
  let lastItems = [];
  let pickerTab = "tools";
  let pickerItems = [];
  let pickerTicks = new Set();

  const editorHost = document.getElementById("editorHost");
  const studio = new LabelStudio(editorHost, {
    onChange: (doc) => {
      documentModel = createDocument(doc);
      syncSizeFields();
    },
    onSave: async () => {
      await saveTpl(false);
    },
    onSaveAs: async () => {
      await saveTpl(true);
    }
  });

  const preview = new LabelPreview({
    host: document.getElementById("labels"),
    metaEl: document.getElementById("previewMeta"),
    flipToggle: document.getElementById("previewFlip")
  });
  document.getElementById("previewFlip")?.addEventListener("change", () => preview.redraw());

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
    const orient = document.getElementById("orientField");
    const cols = document.getElementById("colsField");
    const rows = document.getElementById("rowsField");
    if (orient) orient.style.display = thermal ? "none" : "";
    if (cols) cols.style.display = thermal ? "none" : "";
    if (rows) rows.style.display = thermal ? "none" : "";
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
  }

  ["cW", "cH", "cCols", "cRows", "cGap", "cMargin", "cOrient"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", readSizeFieldsIntoDocument);
  });

  document.querySelectorAll("#printMode .ql-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      documentModel = setPageMode(documentModel, btn.dataset.mode);
      syncSizeFields();
    });
  });

  function renderTemplateList() {
    const host = document.getElementById("tplList");
    if (!host) return;
    if (!templates.length) {
      host.innerHTML = `<div class="ql-empty-tpl">${t("noTemplatesYet", "No templates yet")}</div>`;
      return;
    }
    host.innerHTML = templates
      .map((tpl) => {
        const parsed = parseServerTemplate(tpl);
        const cfg = parsed.document;
        return `<button type="button" class="ql-tpl ${tpl.id === activeId ? "active" : ""}" data-id="${tpl.id}">
          <div>
            <div class="name">${escapeHtml(tpl.name)}</div>
            <div class="meta">${cfg.labelW || "?"}×${cfg.labelH || "?"} · ${cfg.page || "thermal"}</div>
          </div>
          <span class="del" data-del="${tpl.id}" title="Delete">✕</span>
        </button>`;
      })
      .join("");
  }

  async function loadTemplates() {
    const host = document.getElementById("tplList");
    if (host) host.innerHTML = `<div class="ql-empty-tpl">${t("loading", "Loading…")}</div>`;
    try {
      templates = await LabelApi.listTemplates();
      renderTemplateList();
      const last = getLastTemplateId();
      const pick = templates.find((x) => x.id === last) || templates[0];
      if (pick) applyServerTemplate(pick);
      else {
        documentModel = createDocument();
        activeId = null;
        const nameEl = document.getElementById("activeNameLabel");
        if (nameEl) nameEl.textContent = t("unsavedTemplate", "New unsaved template");
        syncSizeFields();
      }
    } catch (e) {
      if (host) host.innerHTML = `<div class="ql-empty-tpl">${escapeHtml(e.message || e)}</div>`;
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
  }

  document.getElementById("tplList")?.addEventListener("click", async (e) => {
    const del = e.target.closest("[data-del]");
    if (del) {
      e.stopPropagation();
      const id = Number(del.dataset.del);
      const tpl = templates.find((x) => x.id === id);
      if (!tpl) return;
      if (!confirm(t("deleteTemplateConfirm", `Delete “${tpl.name}”?`).replace("{name}", tpl.name))) return;
      try {
        await LabelApi.deleteTemplate(id);
        templates = templates.filter((x) => x.id !== id);
        if (activeId === id) {
          activeId = null;
          setLastTemplateId(null);
        }
        renderTemplateList();
        toast(t("templateDeleted", "Deleted"), "ok");
      } catch (err) {
        toast(err.message || err, "err");
      }
      return;
    }
    const btn = e.target.closest(".ql-tpl");
    if (!btn) return;
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

  const openStudio = (e) => {
    e?.preventDefault?.();
    readSizeFieldsIntoDocument();
    studio.open(documentModel);
  };
  document.getElementById("btnOpenStudio")?.addEventListener("click", openStudio);

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

  function setPreviewBtn(on) {
    const btn = document.getElementById("btnOpenPreview");
    if (btn) btn.disabled = !on;
  }

  document.getElementById("btnGen")?.addEventListener("click", async () => {
    readSizeFieldsIntoDocument();
    lastItems = parseCodeLines(document.getElementById("codes")?.value);
    if (!lastItems.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    const labels = document.getElementById("labels");
    if (labels) {
      labels.classList.remove("empty");
      labels.innerHTML = `<div class="ql-hint">${t("loading", "Rendering…")}</div>`;
    }
    openPreview();
    setPreviewBtn(true);
    try {
      await preview.show(documentModel, lastItems, {
        flip: document.getElementById("previewFlip")?.checked
      });
      toast(t("labelsGenerated", "Labels generated"), "ok");
    } catch (e) {
      console.error("[QR Labels] generate failed", e);
      if (labels) {
        labels.innerHTML = `<div class="ql-hint">Generate failed: ${escapeHtml(e.message || e)}</div>`;
      }
      toast(e.message || String(e), "err");
    }
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    const codes = document.getElementById("codes");
    if (codes) codes.value = "";
    lastItems = [];
    const labels = document.getElementById("labels");
    if (labels) {
      labels.innerHTML = `<span class="labels-empty-msg">${t("labelsPreviewEmpty", "Generate labels to preview")}</span>`;
      labels.classList.add("empty");
    }
    setPreviewBtn(false);
    updateSelectedBar();
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

  document.getElementById("btnPrint")?.addEventListener("click", async () => {
    if (!lastItems.length) {
      toast(t("enterOneCode", "Enter at least one code"), "err");
      return;
    }
    try {
      await printLabels(documentModel, lastItems, {
        flip: !!document.getElementById("previewFlip")?.checked
      });
    } catch (e) {
      toast(e.message || e, "err");
    }
  });

  document.getElementById("btnDir")?.addEventListener("click", () => {
    const ta = document.getElementById("codes");
    if (!ta) return;
    const extra = "IN | Direction IN\nOUT | Direction OUT";
    ta.value = ta.value.trim() ? ta.value.trim() + "\n" + extra : extra;
    updateSelectedBar();
  });

  function updateSelectedBar() {
    const items = parseCodeLines(document.getElementById("codes")?.value);
    const bar = document.getElementById("selectedBar");
    const count = document.getElementById("selectedCount");
    if (count) count.textContent = String(items.length);
    if (bar) bar.style.display = items.length ? "" : "none";
  }
  document.getElementById("codes")?.addEventListener("input", updateSelectedBar);

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
    updateSelectedBar();
    pickerModal?.classList.remove("open");
  }
  document.getElementById("btnApplyReplace")?.addEventListener("click", () => applyPicker("replace"));
  document.getElementById("btnApplyAdd")?.addEventListener("click", () => applyPicker("add"));

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
    chip.textContent = `${c.printerName} · ${c.dpi}dpi · scale ${c.scale}`;
  }

  updateCalibChip();
  syncSizeFields();
  await loadTemplates();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

export default { bootLabelApp };
