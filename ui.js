/** ToolCustody — top bar + page chrome */
const TCUI = (() => {
  const PAGES = [
    { id: "terminal", href: "index.html", icon: "bi-terminal", label: "Terminal" },
    { id: "dashboard", href: "dashboard.html", icon: "bi-speedometer2", label: "Dashboard" },
    { id: "overview", href: "results.html", icon: "bi-table", label: "Overview" },
    { id: "damage", href: "damage.html", icon: "bi-exclamation-octagon", label: "Damage" }
  ];

  let pwaRegistered = false;

  function registerPWA() {
    if (pwaRegistered || !("serviceWorker" in navigator)) return;
    pwaRegistered = true;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function bootPage(callback, options = {}) {
    const login = options.login !== false;
    if (login && typeof requireAuth === "function" && !requireAuth()) return;
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
    const nav = showNav
      ? `<nav class="tc-topbar-nav" aria-label="Main">${PAGES.map(p => {
          const cls = p.id === activeId ? "active" : "";
          return `<a href="${p.href}" class="tc-topbar-link ${cls}"><i class="bi ${p.icon}"></i><span>${p.label}</span></a>`;
        }).join("")}</nav>`
      : "";

    const actions = `
      <div class="tc-topbar-actions">
        <button type="button" class="tc-topbar-icon-btn theme-switch" onclick="toggleTheme();syncThemeControls()" data-theme-toggle title="Theme">
          <i class="bi bi-palette"></i>
        </button>
        ${showLogout ? `<button type="button" class="tc-topbar-icon-btn danger" onclick="TCUI.logout()" title="Logout"><i class="bi bi-box-arrow-right"></i></button>` : ""}
      </div>`;

    return `
      <div class="tc-topbar-inner">
        <a href="${showNav ? "index.html" : "#"}" class="tc-topbar-brand" ${showNav ? "" : 'aria-hidden="true" tabindex="-1"'}>
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

  /** Sticky top bar + in-shell page title */
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
      subtitle: "Tool custody portal",
      icon: "bi-shield-lock",
      showNav: false,
      showLogout: false
    });
  }

  return {
    bootPage, registerPWA, logout, mountLayout, mountHeader, mountLoginPage, PAGES
  };
})();
