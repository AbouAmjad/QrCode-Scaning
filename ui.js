/** ToolCustody — top bar + page chrome (role-separated) */
const TCUI = (() => {
  const PAGES = [
    { id: "terminal", href: "index.html", icon: "bi-terminal", label: "Terminal" },
    { id: "outstanding", href: "outstanding.html", icon: "bi-person-exclamation", label: "Not returned" },
    { id: "receiving", href: "receiving.html", icon: "bi-box-arrow-in-down", label: "Receiving" },
    { id: "damage", href: "damage.html", icon: "bi-exclamation-octagon", label: "Damage" },
    { id: "inventory", href: "inventory.html", icon: "bi-boxes", label: "Inventory" },
    { id: "requests", href: "requests.html", icon: "bi-cart-plus", label: "Store request" },
    { id: "dashboard", href: "dashboard.html", icon: "bi-speedometer2", label: "Dashboard" },
    { id: "overview", href: "results.html", icon: "bi-table", label: "Overview" },
    { id: "search", href: "search.html", icon: "bi-search", label: "Search" },
    { id: "repair", href: "repair.html", icon: "bi-wrench", label: "Repair" },
    { id: "labels", href: "qr-labels.html", icon: "bi-qr-code", label: "Labels" },
    { id: "reports", href: "reports.html", icon: "bi-file-earmark-bar-graph", label: "Reports" },
    { id: "notifications", href: "notifications.html", icon: "bi-bell", label: "Alerts" },
    { id: "audit", href: "audit.html", icon: "bi-journal-text", label: "Audit" },
    { id: "consumables", href: "consumables.html", icon: "bi-box-seam", label: "Consumables" }
  ];

  let pwaRegistered = false;

  function pageAllowed(page) {
    if (typeof canAccessPage === "function") return canAccessPage(page.id);
    return true;
  }

  function visiblePages() {
    return PAGES.filter(pageAllowed);
  }

  function registerPWA() {
    if (pwaRegistered || !("serviceWorker" in navigator)) return;
    pwaRegistered = true;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function bootPage(callback, options = {}) {
    const login = options.login !== false;
    if (login && typeof requireAuth === "function" && !requireAuth()) return;
    const pageId = options.pageId || options.active || "";
    if (pageId && typeof canAccessPage === "function" && !canAccessPage(pageId)) {
      window.location.href = typeof homePageForRole === "function" ? homePageForRole() : "login.html";
      return;
    }
    if (options.minRole && typeof hasMinRole === "function" && !hasMinRole(options.minRole)) {
      window.location.href = typeof homePageForRole === "function" ? homePageForRole() : "dashboard.html";
      return;
    }
    registerPWA();
    if (typeof callback === "function") callback();
  }

  function logout() {
    if (typeof clearToken === "function") clearToken();
    window.location.href = "login.html";
  }

  function ensureTopbar() {
    let el = document.getElementById("tc-topbar");
    if (!el) {
      el = document.createElement("header");
      el.id = "tc-topbar";
      el.className = "tc-topbar";
      document.body.prepend(el);
    }
    return el;
  }

  function renderTopbar(activeId, { showNav = true, showLogout = true } = {}) {
    const pages = visiblePages();
    const nav = showNav
      ? `<nav class="tc-topbar-nav" aria-label="Main">${pages.map(p => {
          const cls = p.id === activeId ? "active" : "";
          return `<a href="${p.href}" class="tc-topbar-link ${cls}"><i class="bi ${p.icon}"></i><span>${p.label}</span></a>`;
        }).join("")}</nav>`
      : "";

    const role = typeof roleLabel === "function" ? roleLabel() : (typeof getRole === "function" ? getRole() : "");
    const user = typeof getSessionUser === "function" ? getSessionUser() : "";
    const esc = typeof escHtml === "function" ? escHtml : (s => String(s || ""));
    const meta = (user || role)
      ? `<span class="tc-topbar-user" title="${esc(user)}">${esc(role || "user")}</span>`
      : "";

    const actions = `
      <div class="tc-topbar-actions">
        ${meta}
        <button type="button" class="tc-topbar-icon-btn theme-switch" onclick="toggleTheme();syncThemeControls()" data-theme-toggle title="Theme">
          <i class="bi bi-palette"></i>
        </button>
        ${showLogout ? `<button type="button" class="tc-topbar-icon-btn danger" onclick="TCUI.logout()" title="Logout"><i class="bi bi-box-arrow-right"></i></button>` : ""}
      </div>`;

    const home = typeof homePageForRole === "function" ? homePageForRole() : "index.html";

    return `
      <div class="tc-topbar-inner">
        <a href="${showNav ? home : "#"}" class="tc-topbar-brand" ${showNav ? "" : 'aria-hidden="true" tabindex="-1"'}>
          <span class="tc-topbar-logo"><i class="bi bi-shield-check"></i></span>
          <span class="tc-topbar-brand-text">
            <strong>ToolCustody</strong>
            <small>Abu Amjad</small>
          </span>
        </a>
        ${nav}
        ${actions}
      </div>`;
  }

  function renderPageHead({ title, subtitle, icon, toolbar = "" }) {
    return `
      <div class="tc-page-head">
        <div class="tc-page-head-main">
          <div class="tc-page-head-icon"><i class="bi ${icon || "bi-tools"}"></i></div>
          <div>
            <h2 class="tc-page-title">${title || "ToolCustody"}</h2>
            ${subtitle ? `<p class="tc-page-subtitle">${subtitle}</p>` : ""}
          </div>
        </div>
        ${toolbar ? `<div class="tc-page-toolbar">${toolbar}</div>` : ""}
      </div>`;
  }

  function mountLayout(containerId, opts = {}) {
    const showNav = opts.showNav !== false;
    const showLogout = opts.showLogout !== false && showNav;
    ensureTopbar().innerHTML = renderTopbar(opts.active, { showNav, showLogout });
    const host = document.getElementById(containerId);
    if (host) host.innerHTML = renderPageHead(opts);
    if (typeof syncThemeControls === "function") syncThemeControls();
  }

  function mountHeader(containerId, opts) {
    mountLayout(containerId, opts);
  }

  function mountLoginPage(containerId) {
    mountLayout(containerId, {
      active: "",
      title: "Secure Login",
      subtitle: "موظف · مهندس · أدمن",
      icon: "bi-shield-lock",
      showNav: false,
      showLogout: false
    });
  }

  function toast(msg, kind = "info") {
    let host = document.getElementById("tc-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "tc-toast-host";
      host.className = "tc-toast-host";
      document.body.appendChild(host);
    }
    const el = document.createElement("div");
    el.className = "tc-toast tc-toast-" + kind;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  return {
    bootPage, registerPWA, logout, mountLayout, mountHeader, mountLoginPage, toast, PAGES, visiblePages
  };
})();
