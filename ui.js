/** واجهة موحدة — شريط تنقل + هيدر + boot */
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

  /** Gate protected pages + register PWA, then run callback */
  function bootPage(callback, options = {}) {
    const login = options.login !== false;
    if (login && typeof requireAuth === "function" && !requireAuth()) return;
    registerPWA();
    if (typeof callback === "function") callback();
  }

  function renderNav(activeId) {
    return `<nav class="tc-nav" aria-label="Main navigation">${
      PAGES.map(p => {
        const cls = p.id === activeId ? "active" : "";
        return `<a href="${p.href}" class="${cls}"><i class="bi ${p.icon}"></i> ${p.label}</a>`;
      }).join("")
    }<button type="button" class="tc-nav-link theme-switch" onclick="toggleTheme();syncThemeControls()" data-theme-toggle>Theme</button></nav>`;
  }

  function renderHeader({ active, title, subtitle, icon, toolbar = "" }) {
    return `
      <header class="tc-header">
        <div class="tc-brand">
          <div class="tc-brand-icon"><i class="bi ${icon || "bi-tools"}"></i></div>
          <div>
            <h1>ToolCustody <span style="font-weight:500;color:var(--tc-muted)">· ${title}</span></h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
        </div>
        ${toolbar ? `<div class="tc-toolbar">${toolbar}</div>` : ""}
      </header>
      ${renderNav(active)}
    `;
  }

  function mountHeader(containerId, opts) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = renderHeader(opts);
    if (typeof syncThemeControls === "function") syncThemeControls();
  }

  function pageShellStart(active, narrow = false) {
    return `<div class="tc-wrap${narrow ? " narrow" : ""}"><div class="tc-shell">`;
  }

  function pageShellEnd(footer = "") {
    return `${footer ? `<div class="tc-footer">${footer}</div>` : ""}</div></div>`;
  }

  return { bootPage, registerPWA, renderNav, renderHeader, mountHeader, pageShellStart, pageShellEnd, PAGES };
})();
