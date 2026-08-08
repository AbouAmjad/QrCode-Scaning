/**
 * ui/app.js — page bootstrap for qr-labels.html
 * Wires templates, studio, preview, print, picker, calibration.
 * Presentation only — document is the single source of truth.
 */
import { LabelStudio } from "../editor/studio.js?v=23";
import { LabelPreview } from "./preview.js?v=23";
import { printLabels } from "../print/labels.js?v=23";
import { createDocument, setPageMode } from "../core/document.js?v=23";
import * as LabelApi from "../data/api.js?v=23";
import {
  getLastTemplateId,
  setLastTemplateId,
  loadCalibration
} from "../data/storage.js?v=23";
import { mountCalibrationWizard } from "../print/calibration.js?v=23";
import { parseCodeLines, parseCsvCodes, itemsToText } from "../data/codes.js?v=23";
import { parseServerTemplate } from "../data/serialize.js?v=23";
import { ensureQrLibrary, ensureBarcodeLibrary } from "../render/engine.js?v=23";

function t(key, fallback) {
  if (typeof TCI18N !== "undefined" && TCI18N.t) return TCI18N.t(key) || fallback || key;
  return fallback || key;
}

function toast(msg, kind = "ok") {
  if (typeof TCUI !== "undefined" && TCUI.toast) TCUI.toast(msg, kind);
  else console.log(`[${kind}]`, msg);
}

export async function bootLabelApp() {
  await Promise.all([
    ensureQrLibrary().catch((e) => console.warn("[QR Labels] QR lib", e)),
    ensureBarcodeLibrary().catch((e) => console.warn("[QR Labels] barcode lib", e))
  ]);

  let templates = [];
  let activeId = null;
  let documentModel = createDocument();
  let lastItems = [];
  let pickerTab = "tools";
  let pickerMode = "all"; // all | people | catalog
  let pickerItems = [];
  let pickerTicks = new Set();
  let categoryTree = { categories: [], subcategories: [], items: [] };

  const editorHost = document.getElementById("editorHost");
  const studio = new LabelStudio(editorHost, {
    onChange: (doc) => {
      documentModel = createDocument(doc);
      syncSizeFields();
    },
    onSave: async (doc) => {
      await saveTpl(false, doc);
    },
    onSaveAs: async (doc) => {
      await saveTpl(true, doc);
    },
    onCalibrate: () => openCalibration(),
    onPickItems: () => openPicker({ mode: "all", tab: "tools" })
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
    setLastTemplateId(null);
    documentModel = createDocument();
    const nameEl = document.getElementById("activeNameLabel");
    if (nameEl) nameEl.textContent = t("unsavedTemplate", "New unsaved template");
    syncSizeFields();
    renderTemplateList();
  });

  const openStudio = (e) => {
    e?.preventDefault?.();
    readSizeFieldsIntoDocument();
    studio.open(documentModel);
  };
  document.getElementById("btnOpenStudio")?.addEventListener("click", openStudio);

  function askTemplateName(suggested) {
    const overlay = studio?.el?.studio;
    const bodyOpen = document.body.classList.contains("le-studio-open");
    if (overlay && studio.isOpen) {
      overlay.hidden = true;
      document.body.classList.remove("le-studio-open");
    }
    const name = prompt(t("templateNamePrompt", "Template name"), suggested || "");
    if (overlay && studio.isOpen) {
      overlay.hidden = false;
      if (bodyOpen) document.body.classList.add("le-studio-open");
    }
    return name;
  }

  async function saveTpl(forceNew, studioDoc = null) {
    if (studioDoc) {
      documentModel = createDocument(studioDoc);
      syncSizeFields();
    } else if (!studio.isOpen) {
      readSizeFieldsIntoDocument();
    }

    let name = "";
    const existing = templates.find((x) => x.id === activeId);
    if (!forceNew && existing) {
      name = existing.name;
    } else if (!forceNew && !existing) {
      // First save from studio/page — don't block on a prompt behind the overlay
      name = `Design ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    } else {
      const suggested = existing ? `${existing.name} copy` : "Label design";
      const entered = askTemplateName(suggested);
      if (entered == null) return false;
      name = String(entered).trim();
    }
    if (!name) {
      toast(t("templateNameRequired", "Enter a template name"), "err");
      return false;
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
      return true;
    } catch (e) {
      console.error("[QR Labels] save failed", e);
      toast(e.message || String(e), "err");
      return false;
    }
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
    updateSelectedBar();
  });

  function openPreview() {
    document.getElementById("previewModal")?.classList.add("open");
  }
  function closePreview() {
    document.getElementById("previewModal")?.classList.remove("open");
  }
  document.getElementById("btnClosePreview")?.addEventListener("click", closePreview);

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

  function updateSelectedBar() {
    const items = parseCodeLines(document.getElementById("codes")?.value);
    const bar = document.getElementById("selectedBar");
    const count = document.getElementById("selectedCount");
    if (count) count.textContent = String(items.length);
    if (bar) bar.hidden = !items.length;
  }
  document.getElementById("codes")?.addEventListener("input", updateSelectedBar);

  document.getElementById("btnImportCsv")?.addEventListener("click", () => {
    document.getElementById("csvFile")?.click();
  });
  document.getElementById("csvFile")?.addEventListener("change", async (e) => {
    const file = e.target?.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const items = parseCsvCodes(text);
      if (!items.length) {
        toast(t("csvEmpty", "No codes found in CSV"), "err");
        return;
      }
      const ta = document.getElementById("codes");
      if (ta) ta.value = itemsToText(items);
      updateSelectedBar();
      toast(
        t("csvImported", `Imported ${items.length} row(s)`).replace(
          "{n}",
          String(items.length)
        ),
        "ok"
      );
    } catch (err) {
      toast(err.message || String(err), "err");
    }
  });

  const pickerModal = document.getElementById("pickerModal");
  document.getElementById("btnPickPeople")?.addEventListener("click", () =>
    openPicker({ mode: "people", tab: "people" })
  );
  document.getElementById("btnPickByCategory")?.addEventListener("click", () =>
    openPicker({ mode: "catalog", tab: "tools" })
  );
  document.getElementById("btnClosePicker")?.addEventListener("click", () =>
    pickerModal?.classList.remove("open")
  );

  function setPickerChrome(mode) {
    const tabs = document.getElementById("pickerTabs");
    const peopleF = document.getElementById("peopleFilters");
    const catalogF = document.getElementById("catalogFilters");
    const title = document.getElementById("pickerTitle");
    const hint = document.getElementById("pickerHint");
    const search = document.getElementById("pickerSearch");

    if (tabs) tabs.hidden = mode !== "all";
    if (peopleF) peopleF.hidden = mode !== "people";
    if (catalogF) catalogF.hidden = mode !== "catalog";

    if (mode === "people") {
      if (title) title.textContent = t("printPeopleTitle", "Print people");
      if (hint)
        hint.textContent = t(
          "printPeopleHint",
          "Filter by supplier or status, search, then add to the print queue."
        );
      if (search)
        search.placeholder = t("searchPeople", "Search code, name, residence, phone…");
    } else if (mode === "catalog") {
      if (title) title.textContent = t("printByCategoryTitle", "Print by category");
      if (hint)
        hint.textContent = t(
          "printByCategoryHint",
          "Choose category → sub-category → item, search, then add to the print queue."
        );
      if (search)
        search.placeholder = t("searchCatalog", "Search code, name, category…");
    } else {
      if (title) title.textContent = t("pickItemsTitle", "Choose what to print");
      if (hint)
        hint.textContent = t(
          "pickItemsHint",
          "Search, tick what you need, or select all filtered."
        );
      if (search) search.placeholder = t("search", "Search…");
    }
  }

  function fillSelect(sel, options, allLabel) {
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML =
      `<option value="">${escapeHtml(allLabel)}</option>` +
      options
        .map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const label = typeof o === "string" ? o : o.label;
          return `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
        })
        .join("");
    if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  }

  function populatePeopleFilters() {
    const suppliers = [
      ...new Set(
        pickerItems
          .map((p) => String(p.supplierName || "").trim())
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b));
    fillSelect(
      document.getElementById("peopleSupplierFilter"),
      suppliers,
      t("allSuppliers", "All suppliers")
    );
  }

  function syncCatalogFilterOptions() {
    const catSel = document.getElementById("catFilter");
    const subSel = document.getElementById("subFilter");
    const itemSel = document.getElementById("itemFilter");
    const catName = String(catSel?.value || "");
    const subName = String(subSel?.value || "");

    const catNames = new Set();
    for (const c of categoryTree.categories || []) if (c.name) catNames.add(c.name);
    for (const it of pickerItems) if (it.category) catNames.add(it.category);
    fillSelect(catSel, [...catNames].sort((a, b) => a.localeCompare(b)), t("allCategories", "All categories"));
    if (catName) catSel.value = catName;

    const catRow = (categoryTree.categories || []).find((c) => c.name === catName);
    const subNames = new Set();
    if (catName) {
      if (catRow) {
        for (const s of categoryTree.subcategories || []) {
          if (s.categoryId === catRow.id && s.name) subNames.add(s.name);
        }
      }
      for (const it of pickerItems) {
        if (it.category === catName && it.subcategory) subNames.add(it.subcategory);
      }
    } else {
      for (const s of categoryTree.subcategories || []) if (s.name) subNames.add(s.name);
      for (const it of pickerItems) if (it.subcategory) subNames.add(it.subcategory);
    }
    fillSelect(
      subSel,
      [...subNames].sort((a, b) => a.localeCompare(b)),
      t("allSubcategories", "All sub-categories")
    );
    if (subName && [...subSel.options].some((o) => o.value === subName)) subSel.value = subName;
    else if (subSel) subSel.value = "";

    const subRow = (categoryTree.subcategories || []).find(
      (s) => s.name === String(subSel?.value || "") && (!catRow || s.categoryId === catRow.id)
    );
    const itemNames = new Set();
    const activeSub = String(subSel?.value || "");
    const activeCat = String(catSel?.value || "");
    if (activeSub || activeCat) {
      for (const it of pickerItems) {
        if (activeCat && it.category !== activeCat) continue;
        if (activeSub && it.subcategory !== activeSub) continue;
        if (it.item) itemNames.add(it.item);
      }
      if (subRow) {
        for (const i of categoryTree.items || []) {
          if (i.subcategoryId === subRow.id && i.name) itemNames.add(i.name);
        }
      }
    } else {
      for (const it of pickerItems) if (it.item) itemNames.add(it.item);
      for (const i of categoryTree.items || []) if (i.name) itemNames.add(i.name);
    }
    const prevItem = String(itemSel?.value || "");
    fillSelect(
      itemSel,
      [...itemNames].sort((a, b) => a.localeCompare(b)),
      t("allItems", "All items")
    );
    if (prevItem && [...itemSel.options].some((o) => o.value === prevItem)) itemSel.value = prevItem;
    else if (itemSel) itemSel.value = "";
  }

  async function openPicker(opts = {}) {
    pickerMode = opts.mode || "all";
    pickerTab = opts.tab || (pickerMode === "people" ? "people" : "tools");
    pickerTicks = new Set();
    const search = document.getElementById("pickerSearch");
    if (search) search.value = "";
    const peopleSupplier = document.getElementById("peopleSupplierFilter");
    const peopleStatus = document.getElementById("peopleStatusFilter");
    if (peopleSupplier) peopleSupplier.value = "";
    if (peopleStatus) peopleStatus.value = "all";
    const catFilter = document.getElementById("catFilter");
    const subFilter = document.getElementById("subFilter");
    const itemFilter = document.getElementById("itemFilter");
    const kindFilter = document.getElementById("kindFilter");
    if (catFilter) catFilter.value = "";
    if (subFilter) subFilter.value = "";
    if (itemFilter) itemFilter.value = "";
    if (kindFilter) kindFilter.value = "all";

    setPickerChrome(pickerMode);
    document.querySelectorAll("#pickerTabs button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === pickerTab)
    );
    pickerModal?.classList.add("open");
    // Allow picker above Design Studio when opened from studio.
    if (pickerModal) pickerModal.style.zIndex = "21000";
    await loadPickerTab(pickerTab);
  }

  document.getElementById("pickerTabs")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn || pickerMode !== "all") return;
    pickerTab = btn.dataset.tab;
    document.querySelectorAll("#pickerTabs button").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    await loadPickerTab(pickerTab);
  });

  function isConsumableRow(it) {
    const k = String(it.kind || "").toLowerCase();
    const code = String(it.code || "");
    return k.includes("consum") || code.startsWith("C") || code.startsWith("B");
  }

  async function loadPickerTab(tab) {
    const list = document.getElementById("pickerList");
    if (!list) return;
    list.innerHTML = `<div class="ql-hint">${t("loading", "Loading…")}</div>`;
    try {
      if (pickerMode === "people" || tab === "people") {
        const people = await LabelApi.listPeople();
        pickerItems = people.map((p) => ({
          code: p.code,
          name: p.name || p.fullName || "",
          kind: "person",
          supplierName: p.supplierName || "",
          residenceNo: p.residenceNo || "",
          phone: p.phone || "",
          supervisorName: p.supervisorName || "",
          toolsHeldCount: Number(p.toolsHeldCount) || 0,
          neverTookTools: !!p.neverTookTools
        }));
        populatePeopleFilters();
      } else {
        const [catalog, tree] = await Promise.all([
          LabelApi.listCatalog(),
          LabelApi.listCategories().catch(() => ({
            categories: [],
            subcategories: [],
            items: []
          }))
        ]);
        categoryTree = tree || { categories: [], subcategories: [], items: [] };
        pickerItems = catalog
          .filter((it) => {
            const code = String(it.code || "");
            if (code.startsWith("P") || String(it.kind || "").toLowerCase() === "person") {
              return false;
            }
            // In "all" mode, respect Tools / Consumables tabs.
            if (pickerMode === "all") {
              if (tab === "consumables") return isConsumableRow(it);
              return !isConsumableRow(it);
            }
            return true;
          })
          .map((it) => ({
            code: it.code,
            name: it.description || it.name || "",
            kind: isConsumableRow(it) ? "consumable" : "tool",
            category: it.category || "",
            subcategory: it.subcategory || "",
            item: it.item || ""
          }));
        if (pickerMode === "catalog") syncCatalogFilterOptions();
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

    return pickerItems.filter((it) => {
      if (pickerMode === "people" || it.kind === "person") {
        const supplier = String(document.getElementById("peopleSupplierFilter")?.value || "");
        const status = String(document.getElementById("peopleStatusFilter")?.value || "all");
        if (supplier && String(it.supplierName || "") !== supplier) return false;
        if (status === "holding" && !(Number(it.toolsHeldCount) > 0)) return false;
        if (status === "never" && !it.neverTookTools) return false;
        if (q) {
          const hay = [
            it.code,
            it.name,
            it.supplierName,
            it.residenceNo,
            it.phone,
            it.supervisorName
          ]
            .join(" ")
            .toUpperCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }

      if (pickerMode === "catalog") {
        const cat = String(document.getElementById("catFilter")?.value || "");
        const sub = String(document.getElementById("subFilter")?.value || "");
        const item = String(document.getElementById("itemFilter")?.value || "");
        const kind = String(document.getElementById("kindFilter")?.value || "all");
        if (cat && String(it.category || "") !== cat) return false;
        if (sub && String(it.subcategory || "") !== sub) return false;
        if (item && String(it.item || "") !== item) return false;
        if (kind === "tools" && it.kind === "consumable") return false;
        if (kind === "consumables" && it.kind !== "consumable") return false;
      }

      if (q) {
        const hay = [it.code, it.name, it.category, it.subcategory, it.item]
          .join(" ")
          .toUpperCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderPickerList() {
    const list = document.getElementById("pickerList");
    const meta = document.getElementById("pickerMeta");
    if (!list) return;
    const items = filteredPickerItems();
    if (meta) {
      meta.textContent = t("pickerShowing", "Showing {n} of {total}")
        .replace("{n}", String(items.length))
        .replace("{total}", String(pickerItems.length));
    }
    list.innerHTML =
      items
        .map((it) => {
          let detail = it.name || "";
          if (it.kind === "person") {
            const bits = [it.supplierName, it.residenceNo, it.phone].filter(Boolean);
            if (bits.length) detail += ` · ${bits.join(" · ")}`;
          } else {
            const path = [it.category, it.subcategory, it.item].filter(Boolean).join(" / ");
            if (path) detail = `${path} · ${detail}`;
          }
          return `<label class="ql-picker-row">
        <input type="checkbox" data-code="${escapeHtml(it.code)}" ${pickerTicks.has(it.code) ? "checked" : ""}>
        <span><strong>${escapeHtml(it.code)}</strong> · ${escapeHtml(detail)}</span>
      </label>`;
        })
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
  ["peopleSupplierFilter", "peopleStatusFilter", "kindFilter", "itemFilter"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => renderPickerList());
  });
  document.getElementById("catFilter")?.addEventListener("change", () => {
    const sub = document.getElementById("subFilter");
    const item = document.getElementById("itemFilter");
    if (sub) sub.value = "";
    if (item) item.value = "";
    syncCatalogFilterOptions();
    renderPickerList();
  });
  document.getElementById("subFilter")?.addEventListener("change", () => {
    const item = document.getElementById("itemFilter");
    if (item) item.value = "";
    syncCatalogFilterOptions();
    renderPickerList();
  });
  document.getElementById("btnSelectFiltered")?.addEventListener("click", () => {
    filteredPickerItems().forEach((it) => pickerTicks.add(it.code));
    renderPickerList();
  });
  document.getElementById("btnClearSelection")?.addEventListener("click", () => {
    pickerTicks.clear();
    renderPickerList();
  });

  function applyPicker(mode) {
    const chosen = filteredPickerItems().filter((it) => pickerTicks.has(it.code));
    // Also include ticks that may be outside current filter if still in pickerItems
    const byCode = new Map(pickerItems.map((it) => [it.code, it]));
    const picked = [...pickerTicks]
      .map((code) => byCode.get(code))
      .filter(Boolean);
    const finalList = picked.length ? picked : chosen;
    const ta = document.getElementById("codes");
    if (!ta) return;
    if (!finalList.length) {
      toast(t("pickAtLeastOne", "Select at least one item"), "err");
      return;
    }
    const text = itemsToText(finalList);
    if (mode === "replace") ta.value = text;
    else ta.value = ta.value.trim() ? ta.value.trim() + "\n" + text : text;
    updateSelectedBar();
    pickerModal?.classList.remove("open");
    toast(
      t("queuedNItems", "Queued {n} item(s)").replace("{n}", String(finalList.length)),
      "ok"
    );
  }
  document.getElementById("btnApplyReplace")?.addEventListener("click", () => applyPicker("replace"));
  document.getElementById("btnApplyAdd")?.addEventListener("click", () => applyPicker("add"));

  function openCalibration() {
    const modal = document.getElementById("calibModal");
    modal?.classList.add("open");
    // Calibration sits above studio when both are open.
    if (modal) modal.style.zIndex = "21000";
    mountCalibrationWizard(document.getElementById("calibHost"), {
      labelW: documentModel.labelW,
      labelH: documentModel.labelH,
      onSaved: (cal) => {
        toast(t("calibSaved", "Printer profile saved"), "ok");
        updateCalibChip(cal);
      }
    });
  }
  document.getElementById("btnCloseCalib")?.addEventListener("click", () =>
    document.getElementById("calibModal")?.classList.remove("open")
  );

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
