/** ToolCustody — sidebar + page chrome (role-separated) */
const TCUI = (() => {
  const PAGE_META = [
    { id: "terminal", href: "index.html", icon: "bi-terminal-fill", i18n: "terminal", group: "ops" },
    { id: "outstanding", href: "outstanding.html", icon: "bi-person-exclamation", i18n: "outstanding", group: "ops" },
    { id: "receiving", href: "receiving.html", icon: "bi-box-arrow-in-down", i18n: "receiving", group: "ops" },
    { id: "damage", href: "damage.html", icon: "bi-exclamation-octagon-fill", i18n: "damage", group: "ops" },
    { id: "logs", href: "logs.html", icon: "bi-journal-text", i18n: "logs", group: "ops" },
    { id: "timesheetScan", href: "timesheet-scan.html", icon: "bi-person-badge", i18n: "timesheetScan", group: "ops" },
    { id: "audit", href: "audit.html", icon: "bi-journal-text", i18n: "audit", group: "admin" },
    { id: "timesheetAdmin", href: "timesheet-admin.html", icon: "bi-clock-history", i18n: "timesheetAdmin", group: "admin" },
    { id: "timesheetPortal", href: "timesheet-portal.html", icon: "bi-person-bounding-box", i18n: "timesheetPortal", group: "account" },
    { id: "products", href: "products.html", icon: "bi-box-seam-fill", i18n: "products", group: "catalog" },
    { id: "people", href: "people.html", icon: "bi-people-fill", i18n: "people", group: "catalog" },
    { id: "suppliers", href: "suppliers.html", icon: "bi-truck", i18n: "suppliers", group: "catalog" },
    { id: "consumables", href: "consumables.html", icon: "bi-droplet-half", i18n: "consumables", group: "catalog" },
    { id: "labels", href: "qr-labels.html", icon: "bi-qr-code", i18n: "labels", group: "catalog" },
    { id: "forms", href: "forms.html", icon: "bi-file-earmark-text", i18n: "forms", group: "store" },
    { id: "warehouses", href: "warehouses.html", icon: "bi-building", i18n: "warehousesPage", group: "warehouse" },
    { id: "qc", href: "qc.html", icon: "bi-clipboard2-pulse", i18n: "qcPage", group: "reports" },
    { id: "dashboard", href: "dashboard.html", icon: "bi-speedometer2", i18n: "dashboard", group: "reports" },
    { id: "settings", href: "settings.html", icon: "bi-gear-fill", i18n: "settings", group: "account" }
  ];

  const GROUPS = [
    { id: "ops", i18n: "groupOps" },
    { id: "catalog", i18n: "groupCatalog" },
    { id: "store", i18n: "groupStore" },
    { id: "warehouse", i18n: "groupWarehouse" },
    { id: "reports", i18n: "groupReports" },
    { id: "admin", i18n: "groupAdmin" },
    { id: "account", i18n: "groupAccount" }
  ];

  const PAGES = PAGE_META.map((p) => ({
    id: p.id,
    href: p.href,
    icon: p.icon,
    label: p.i18n
  }));

  let pwaRegistered = false;
  let lastHeader = null;

  function tt(key) {
    return typeof TCI18N !== "undefined" ? TCI18N.t(key) : key;
  }

  function pageAllowed(page) {
    if (!page || !page.id) return false;
    // Admin: Audit covers scan history + system events — hide legacy Scan log from sidebar.
    if (page.id === "logs" && typeof getRole === "function" && getRole() === "admin") return false;
    if (typeof canAccessPage === "function") return canAccessPage(page.id);
    return false;
  }

  function visiblePages() {
    return PAGE_META.filter(pageAllowed);
  }

  function registerPWA() {
    if (pwaRegistered || !("serviceWorker" in navigator)) return;
    pwaRegistered = true;
    // LIVE mode: no offline cache. Register kill-switch SW once so old caches die,
    // then unregister everything and wipe Cache Storage.
    navigator.serviceWorker.register("./sw.js").catch(() => {});
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
    if (window.caches && caches.keys) {
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }

  async function refreshPermissions() {
    if (typeof apiGet !== "function" || typeof getToken !== "function" || !getToken()) return;
    try {
      const data = await apiGet({ action: "getMyPermissions" });
      if (data && Array.isArray(data.permissions) && typeof setPermissions === "function") {
        setPermissions(data.permissions);
      }
      if (data && data.role && typeof localStorage !== "undefined") {
        try { localStorage.setItem(AppConfig.ROLE_KEY, normalizeRole(data.role)); } catch (_) {}
      }
    } catch (_) {}
  }

  function bootPage(callback, options = {}) {
    const login = options.login !== false;
    if (login && typeof requireAuth === "function" && !requireAuth()) return;

    const finish = () => {
      const pageId = options.pageId || options.active || "";
      const here = (location.pathname.split("/").pop() || "").split("?")[0];

      if (pageId && typeof canAccessPage === "function" && !canAccessPage(pageId)) {
        // Never redirect-loop: land on profile when role has no page access
        if (here !== "profile.html") {
          window.location.href = "profile.html";
        }
        return;
      }
      if (options.permission && typeof can === "function" && !can(options.permission)) {
        if (here !== "profile.html") {
          window.location.href = "profile.html";
        }
        return;
      }
      if (options.minRole && typeof hasMinRole === "function" && !hasMinRole(options.minRole)) {
        if (here !== "profile.html") {
          window.location.href = "profile.html";
        }
        return;
      }
      registerPWA();
      if (typeof callback === "function") callback();
      // Refresh sidebar/topbar once if header was already mounted (perms just loaded)
      if (lastHeader && lastHeader.containerId) {
        try {
          const side = document.getElementById("tc-sidebar");
          const top = document.getElementById("tc-topbar");
          const opts = lastHeader.opts || {};
          const activeId = opts.active || "";
          if (side && !side.hidden) side.innerHTML = renderSidebar(activeId);
          if (top) {
            top.innerHTML = renderTopbar(activeId, {
              showNav: opts.showNav !== false,
              showLogout: opts.showLogout !== false && opts.showNav !== false,
              pageTitle: pageTitleFromOpts(opts)
            });
            bindTopbarInteractions(top);
          }
        } catch (_) {}
      }
    };

    // Always refresh role matrix from server before showing menu / page
    refreshPermissions().finally(finish);
  }

  async function logout() {
    try {
      if (typeof logAudit === "function" && typeof getApiToken === "function" && getApiToken()) {
        await logAudit("LOGOUT", "user logout");
      }
    } catch (_) { /* ignore */ }
    if (typeof clearToken === "function") clearToken();
    window.location.href = "login.html";
  }

  function toggleLanguage() {
    /* English-only site — language switch disabled */
  }

  function toggleThemeUi() {
    if (typeof toggleTheme === "function") toggleTheme();
  }

  function sessionIdentity() {
    const user = typeof getSessionUser === "function" ? getSessionUser() : "";
    const roleRaw = typeof getRole === "function" ? getRole() : "";
    const role = typeof TCI18N !== "undefined"
      ? TCI18N.roleLabelI18n(roleRaw)
      : (typeof roleLabel === "function" ? roleLabel() : roleRaw);
    const displayName = (typeof getSessionFullName === "function" && getSessionFullName()) || user || "";
    const avatarUrl = typeof getSessionAvatar === "function" ? getSessionAvatar() : "";
    const initial = (displayName || user || "?").trim().charAt(0).toUpperCase();
    return { user, role, roleRaw, displayName, avatarUrl, initial };
  }

  function avatarMarkup(extraClass = "") {
    const esc = typeof escHtml === "function" ? escHtml : (s) => String(s || "");
    const { avatarUrl, initial } = sessionIdentity();
    if (avatarUrl) {
      return `<img class="tc-avatar ${extraClass}" src="${esc(avatarUrl)}" alt="">`;
    }
    return `<span class="tc-avatar tc-avatar-fallback ${extraClass}">${esc(initial)}</span>`;
  }

  function ensureShell() {
    let top = document.getElementById("tc-topbar");
    let side = document.getElementById("tc-sidebar");
    if (!top || !side) {
      // Remove any orphaned chrome from a previous broken mount
      document.querySelectorAll("#tc-topbar, #tc-sidebar, #tc-sidebar-backdrop, #tc-app-layout").forEach((el) => el.remove());

      top = document.createElement("header");
      top.id = "tc-topbar";
      top.className = "tc-topbar";

      side = document.createElement("aside");
      side.id = "tc-sidebar";
      side.className = "tc-sidebar";
      side.setAttribute("aria-label", "Menu");

      const backdrop = document.createElement("div");
      backdrop.id = "tc-sidebar-backdrop";
      backdrop.className = "tc-sidebar-backdrop";
      backdrop.addEventListener("click", () => setSidebarOpen(false));

      document.body.prepend(backdrop);
      document.body.prepend(side);
      document.body.prepend(top);
      document.body.classList.add("tc-has-sidebar");

      if (!document.body.dataset.navEscBound) {
        document.body.dataset.navEscBound = "1";
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            setSidebarOpen(false);
            closeUserMenu();
          }
        });
        document.addEventListener("click", (e) => {
          const wrap = e.target.closest(".tc-user-menu");
          if (!wrap) closeUserMenu();
        });
      }
    }
    return { top, side };
  }

  function setSidebarOpen(open) {
    const on = !!open;
    document.body.classList.toggle("tc-sidebar-open", on);
    document.body.style.overflow = on ? "hidden" : "";
    const btn = document.querySelector(".tc-menu-btn");
    if (btn) btn.setAttribute("aria-expanded", on ? "true" : "false");
    const side = document.getElementById("tc-sidebar");
    if (side) side.setAttribute("aria-hidden", on ? "false" : "true");
  }

  function closeUserMenu() {
    document.querySelectorAll(".tc-user-menu.open").forEach((el) => {
      el.classList.remove("open");
      const btn = el.querySelector(".tc-user-menu-btn");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  }

  function toggleUserMenu(btn) {
    const wrap = btn && btn.closest(".tc-user-menu");
    if (!wrap) return;
    const willOpen = !wrap.classList.contains("open");
    closeUserMenu();
    if (willOpen) {
      wrap.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
    }
  }

  function bindNavClose(side) {
    if (!side || side.dataset.navBound === "1") return;
    side.dataset.navBound = "1";
    side.addEventListener("click", (e) => {
      const a = e.target.closest("a.tc-side-link");
      if (a) setSidebarOpen(false);
    });
  }

  function bindTopbarInteractions(top) {
    if (!top || top.dataset.uiBound === "1") return;
    top.dataset.uiBound = "1";
    top.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-user-menu-toggle]");
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        toggleUserMenu(btn);
      }
    });
  }

  function pageTitleFromOpts(opts = {}) {
    if (opts.titleKey) return tt(opts.titleKey);
    if (opts.title) return opts.title;
    const active = opts.active || "";
    const meta = PAGE_META.find((p) => p.id === active);
    if (meta) return tt(meta.i18n);
    return tt("brand");
  }

  function renderSidebar(activeId) {
    // Projects lives under Warehouses — keep Warehouses highlighted on project pages
    if (activeId === "projects") activeId = "warehouses";
    const pages = visiblePages();
    const esc = typeof escHtml === "function" ? escHtml : (s) => String(s || "");
    const { user, role, displayName } = sessionIdentity();
    const name = displayName || user || "—";

    const byGroup = GROUPS.map((g) => {
      const items = pages.filter((p) => p.group === g.id);
      if (!items.length) return "";
      return `
        <div class="tc-side-group">
          <div class="tc-side-group-title">${tt(g.i18n)}</div>
          ${items.map((p) => {
            const cls = p.id === activeId ? "active" : "";
            return `<a href="${p.href}" class="tc-side-link ${cls}"><i class="bi ${p.icon}"></i><span>${tt(p.i18n)}</span></a>`;
          }).join("")}
        </div>`;
    }).join("");

    return `
      <div class="tc-sidebar-inner">
        <div class="tc-sidebar-welcome">
          <div class="tc-sidebar-welcome-top">
            <a href="profile.html" class="tc-sidebar-avatar-link" title="${esc(tt("profile"))}">
              <span class="tc-avatar-wrap">
                ${avatarMarkup("tc-avatar-lg")}
                <span class="tc-online-dot" title="Online" aria-hidden="true"></span>
              </span>
            </a>
            <button type="button" class="tc-topbar-icon-btn tc-sidebar-close" onclick="TCUI.setSidebarOpen(false)" aria-label="${tt("close")}">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="tc-sidebar-welcome-text">
            <span class="tc-welcome-label">${tt("welcomeBack")}</span>
            <strong class="tc-welcome-name">${esc(name)}</strong>
            ${role ? `<span class="tc-welcome-role">${esc(role)}</span>` : ""}
          </div>
        </div>
        <nav class="tc-sidebar-nav">${byGroup || `<p class="tc-side-empty">—</p>`}</nav>
      </div>`;
  }

  function renderTopbar(activeId, { showNav = true, showLogout = true, pageTitle = "" } = {}) {
    const esc = typeof escHtml === "function" ? escHtml : (s => String(s || ""));
    const hasToken = typeof getToken === "function" ? !!getToken() : false;
    const { user, role, displayName } = sessionIdentity();
    const name = displayName || user || "";
    const title = pageTitle || tt("brand");
    const home = typeof homePageForRole === "function" ? homePageForRole() : "index.html";

    const userMenu = hasToken && showNav ? `
      <div class="tc-user-menu">
        <button type="button" class="tc-user-menu-btn" data-user-menu-toggle aria-expanded="false" aria-haspopup="true">
          ${avatarMarkup("tc-avatar-sm")}
          <span class="tc-user-menu-meta">
            <strong>${esc(name || "User")}</strong>
            <small>${esc(role || "")}</small>
          </span>
          <i class="bi bi-chevron-down tc-user-menu-caret"></i>
        </button>
        <div class="tc-user-menu-dd" role="menu">
          <a href="profile.html" role="menuitem"><i class="bi bi-person"></i> ${tt("profile")}</a>
          <a href="settings.html" role="menuitem"><i class="bi bi-gear"></i> ${tt("settings")}</a>
          ${showLogout ? `<button type="button" role="menuitem" class="danger" onclick="TCUI.logout()"><i class="bi bi-box-arrow-right"></i> ${tt("logout")}</button>` : ""}
        </div>
      </div>` : "";

    return `
      <div class="tc-topbar-inner">
        <div class="tc-topbar-left">
          ${showNav ? `<button type="button" class="tc-topbar-icon-btn tc-menu-btn" onclick="TCUI.setSidebarOpen(!document.body.classList.contains('tc-sidebar-open'))" title="${tt("menu")}" aria-label="${tt("menu")}" aria-expanded="false"><i class="bi bi-list"></i></button>` : ""}
          ${showNav ? `
          <div class="tc-topbar-title-block">
            <span class="tc-topbar-kicker" data-i18n="brand">${tt("brand")}</span>
            <h1 class="tc-topbar-page-title">${esc(title)}</h1>
          </div>` : `
          <a href="${home}" class="tc-topbar-brand" aria-hidden="true" tabindex="-1">
            <span class="tc-topbar-logo"><i class="bi bi-shield-check"></i></span>
            <span class="tc-topbar-brand-text">
              <strong data-i18n="brand">${tt("brand")}</strong>
              <small data-i18n="brandSub">${tt("brandSub")}</small>
            </span>
          </a>`}
        </div>
        <div class="tc-topbar-actions">
          ${userMenu}
        </div>
      </div>`;
  }

  function mountChrome(activeId, { showNav = true, showLogout = true, pageTitle = "" } = {}) {
    if (typeof TCI18N !== "undefined") TCI18N.applyDocumentLang();
    const { top, side } = ensureShell();
    top.dataset.active = activeId || "";
    side.dataset.active = activeId || "";
    top.innerHTML = renderTopbar(activeId, { showNav, showLogout, pageTitle });
    bindTopbarInteractions(top);
    if (showNav) {
      side.hidden = false;
      side.innerHTML = renderSidebar(activeId);
      bindNavClose(side);
      document.body.classList.add("tc-has-sidebar");
      document.body.classList.remove("tc-login-chrome");
      setSidebarOpen(false);
    } else {
      side.hidden = true;
      side.innerHTML = "";
      document.body.classList.remove("tc-has-sidebar", "tc-sidebar-open");
      document.body.classList.add("tc-login-chrome");
      document.body.style.overflow = "";
    }
    if (typeof syncThemeControls === "function") syncThemeControls();
  }

  function renderPageHead({ title, subtitle, titleKey, subtitleKey, icon, toolbar = "" }) {
    const tSub = subtitleKey ? tt(subtitleKey) : (subtitle || "");
    // Title lives in topbar; keep compact subtitle + toolbar strip when useful
    if (!tSub && !toolbar) return "";
    return `
      <div class="tc-page-head tc-page-head-compact">
        <div class="tc-page-head-main">
          ${icon ? `<div class="tc-page-head-icon"><i class="bi ${icon}"></i></div>` : ""}
          <div>
            ${tSub ? `<p class="tc-page-subtitle"${subtitleKey ? ` data-i18n="${subtitleKey}"` : ""}>${tSub}</p>` : ""}
          </div>
        </div>
        ${toolbar ? `<div class="tc-page-toolbar">${toolbar}</div>` : ""}
      </div>`;
  }

  function mountLayout(containerId, opts = {}) {
    lastHeader = { containerId, opts: { ...opts } };
    const showNav = opts.showNav !== false;
    const showLogout = opts.showLogout !== false && showNav;
    const pageTitle = pageTitleFromOpts(opts);
    mountChrome(opts.active, { showNav, showLogout, pageTitle });
    const host = document.getElementById(containerId);
    if (host) host.innerHTML = renderPageHead(opts);
    if (typeof TCI18N !== "undefined") TCI18N.applyDocumentLang();
  }

  function mountHeader(containerId, opts) {
    mountLayout(containerId, opts);
  }

  function mountLoginPage(containerId) {
    mountChrome("", { showNav: false, showLogout: false });
    const host = document.getElementById(containerId);
    if (host) host.innerHTML = "";
    if (typeof TCI18N !== "undefined") TCI18N.applyDocumentLang();
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
    bootPage,
    registerPWA,
    logout,
    mountLayout,
    mountHeader,
    mountLoginPage,
    toast,
    PAGES,
    visiblePages,
    toggleLanguage,
    toggleTheme: toggleThemeUi,
    setSidebarOpen,
    mountChrome,
    closeUserMenu
  };
})();
