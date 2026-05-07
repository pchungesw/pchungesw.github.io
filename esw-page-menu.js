/**
 * esw-page-menu.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-contained Page Settings slide-panel for Salesforce Embedded Messaging
 * demo pages.
 *
 * HOW TO USE ON ANY PAGE
 * ──────────────────────
 * 1. Add this script tag BEFORE your closing </body>:
 *
 *      <script src="esw-page-menu.js"></script>
 *
 * 2. Call ESWMenu.init(config) once the DOM is ready (or at the bottom of
 *    your page script).  The config object tells the menu which sections to
 *    show and what labels / default values to pre-populate.
 *
 * ESWMenu.init({
 *   pageTitle:          "Enhanced Chat v1",      // displayed in the panel header
 *   configDetails: {                              // "Configuration Details" section
 *     rows: [
 *       { label: "Org Name", value: "Acme" },
 *       { label: "Org ID",   value: "00Dxx…", link: null },
 *       // A row can be a plain value or an anchor: { label, href, text }
 *     ]
 *   },
 *   deploymentSettings: {                        // "Deployment Settings" section
 *     enabled: true,
 *     defaults: {
 *       orgId:          "00Dxx…",
 *       deploymentName: "My_Deployment",
 *       siteEndpoint:   "https://…",
 *       scrt2URL:       "https://…"
 *     }
 *   },
 *   prechat: { enabled: true },                  // Pre-Chat Population section
 *   chatButtonVisibility: { enabled: true },     // Chat Button Visibility section
 *   hiddenPrechat: { enabled: true },            // Hidden Pre-chat section
 *   eventLog: { enabled: true }                  // Event Log + Settings section
 * });
 *
 * 3. The menu automatically injects its HTML into the page, wires all event
 *    listeners, and exposes a small public API on ESWMenu:
 *
 *      ESWMenu.togglePanel()          – open / close the panel
 *      ESWMenu.logEvent(name, detail) – append an entry to the event log
 *      ESWMenu.showToast(msg, type)   – show a toast ("success"|"error"|"info")
 *
 * 4. To change the panel and have it reflected everywhere, only edit THIS file.
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function (global) {
  "use strict";

  /* ─── Internal state ─────────────────────────────────────────────────── */
  const MAX_LOG_ENTRIES = 50;
  let _cfg = {};

  /* ─── Utility: inject CSS once ─────────────────────────────────────────── */
  function injectStyles() {
    if (document.getElementById("esw-menu-styles")) return;
    const style = document.createElement("style");
    style.id = "esw-menu-styles";
    style.textContent = `
      /* ── Slide panel ────────────────────────────────────────────────── */
      #eswSlidePanel {
        position: fixed;
        left: -700px;
        top: 0;
        width: 700px;
        height: 100vh;
        background: #fff;
        box-shadow: 2px 0 8px rgba(0,0,0,0.12);
        transition: left 0.3s ease-in-out;
        z-index: 1000;
        padding: 2rem;
        overflow-y: auto;
        box-sizing: border-box;
      }
      #eswSlidePanel.open { left: 0; }

      /* ── Toggle button ──────────────────────────────────────────────── */
      #eswToggleBtn {
        position: fixed;
        left: 20px;
        top: 20px;
        z-index: 1001;
      }
      #eswToggleBtn.panel-open { left: 720px; }

      /* ── Collapsible sections ───────────────────────────────────────── */
      .esw-collapsible-section {
        margin-top: 1.5rem;
        border-top: 1px solid #ddd;
        padding-top: 1rem;
      }
      .esw-collapsible-section:first-of-type { margin-top: 1rem; }
      .esw-collapsible-header {
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        user-select: none;
      }
      .esw-collapsible-header:hover { background-color: #f3f3f3; }
      .esw-collapsible-content { display: none; padding-top: 1rem; }
      .esw-collapsible-content.open { display: block; }

      /* ── Info table ─────────────────────────────────────────────────── */
      .esw-info-table { width: 100%; border-collapse: collapse; }
      .esw-info-table td { padding: 0.5rem 0; border: none; }
      .esw-info-table td:first-child { font-weight: bold; width: 40%; }

      /* ── Form fields ────────────────────────────────────────────────── */
      .esw-form-field { margin-bottom: 1rem; }
      .esw-form-field label {
        display: block;
        font-weight: bold;
        margin-bottom: 0.25rem;
        font-size: 0.875rem;
      }
      .esw-form-field input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
        font-size: 0.875rem;
      }

      /* ── Event log (inside panel) ───────────────────────────────────── */
      #eswEventLog {
        border: 1px solid #d8dde6;
        border-radius: 4px;
        background-color: #f3f3f3;
        padding: 1rem;
        height: 380px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        margin-top: 0.75rem;
      }

      /* ── Toast ──────────────────────────────────────────────────────── */
      #eswToastContainer {
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        z-index: 10000;
      }

      /* ── Slide-in / out keyframes for toasts ────────────────────────── */
      @keyframes eswSlideIn {
        from { transform: translateX(320px); opacity: 0; }
        to   { transform: translateX(0);     opacity: 1; }
      }
      @keyframes eswSlideOut {
        from { transform: translateX(0);     opacity: 1; }
        to   { transform: translateX(320px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ─── Derive the Salesforce Setup base URL from a SCRT2 endpoint ─────────── */
  // SCRT2:  https://{myDomain}.my.salesforce-scrt.com
  // Setup:  https://{myDomain}.my.salesforce-setup.com
  function _getSetupBase(scrt2URL) {
    try {
      var parsed = new URL(scrt2URL);
      return parsed.origin.replace(".salesforce-scrt.com", ".salesforce-setup.com");
    } catch (e) {
      return null;
    }
  }

  /* ─── Build config rows for an active deployment override ─────────────────── */
  // When the user has overridden the deployment we can only construct list-page
  // links (record IDs for individual ESD / channel / flow records are not known).
  function buildOverrideConfigRows(deploy) {
    var setup = _getSetupBase(deploy.scrt2URL);
    var deployLabel = deploy.deploymentName.replace(/_/g, " "); // API_Name -> API Name

    var rows = [];

    // Org Name — link to Company Information page (name not knowable without API call)
    rows.push({
      label: "Org Name",
      link:  setup ? setup + "/lightning/setup/CompanyProfileInfo/home" : null,
      value: setup ? "View in Setup" : "(setup URL unavailable)"
    });

    // Org ID — just the value
    rows.push({ label: "Org ID", value: deploy.orgId });

    // Embedded Service Deployment — link to the ESD list (record ID unknown)
    rows.push({
      label: "Embedded Service Name",
      link:  setup ? setup + "/lightning/setup/EmbeddedServiceDeployments/home" : null,
      value: setup ? deployLabel + " (view list)" : deployLabel
    });

    // Messaging Channel — link to Messaging Settings list (record ID unknown)
    if (setup) {
      rows.push({
        label:  "Messaging Channel",
        prefix: deployLabel,
        links: [
          { href: setup + "/lightning/setup/LiveMessageSetup/home", text: "view list" }
        ]
      });
    } else {
      rows.push({ label: "Messaging Channel", value: deployLabel });
    }

    // Routing Type — link to Flows list (record ID unknown)
    rows.push({
      label: "Routing Type",
      link:  setup ? setup + "/lightning/setup/Flows/home" : null,
      value: setup ? "View flows in Setup" : "(setup URL unavailable)"
    });

    return buildConfigRows(rows);
  }

  /* ─── Build HTML for Configuration Details rows ─────────────────────────── */
  function buildConfigRows(rows) {
    if (!rows || !rows.length) return "";
    return rows.map(function (row) {
      var valueCell;
      if (row.links && row.links.length) {
        // Multiple links (e.g. view | edit)
        valueCell = row.links.map(function (l) {
          return "<a href=\"" + l.href + "\" target=\"_blank\" class=\"slds-text-link\">" + l.text + "</a>";
        }).join(" | ");
        if (row.prefix) valueCell = row.prefix + " (" + valueCell + ")";
      } else if (row.link) {
        valueCell = "<a href=\"" + row.link + "\" target=\"_blank\" class=\"slds-text-link\">" + row.value + "</a>";
      } else {
        valueCell = row.value || "";
      }
      return "<tr>"
        + "<td class=\"slds-text-body_small slds-text-color_weak\">" + row.label + ":</td>"
        + "<td class=\"slds-text-body_regular\">" + valueCell + "</td>"
        + "</tr>";
    }).join("");
  }

  /* ─── Build the full panel HTML ─────────────────────────────────────────── */
  function buildPanelHTML(cfg) {
    const sections = [];

    /* 1 · Configuration Details */
    if (cfg.configDetails) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswConfigContent','eswConfigIcon')">
            <h3 class="slds-text-heading_small">Configuration Details</h3>
            <span id="eswConfigIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswConfigContent">
            <table class="esw-info-table">
              ${buildConfigRows(cfg.configDetails.rows)}
            </table>
          </div>
        </div>`);
    }

    /* 2 · Deployment Settings */
    if (cfg.deploymentSettings && cfg.deploymentSettings.enabled) {
      const d = cfg.deploymentSettings.defaults || {};
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswDeployContent','eswDeployIcon')">
            <h3 class="slds-text-heading_small">Deployment Settings</h3>
            <span id="eswDeployIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswDeployContent">
            <p class="slds-text-body_small slds-text-color_weak" style="margin-bottom:1rem;">
              Override the default deployment configuration. Click <strong>Update</strong> to
              reload the page with the new settings applied.
            </p>
            <div class="esw-form-field">
              <label for="eswDeployOrgId">Org ID</label>
              <input type="text" id="eswDeployOrgId" maxlength="15"
                     placeholder="15-character Org ID"
                     value="${d.orgId || ""}"
                     class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswDeployApiName">Deployment API Name</label>
              <input type="text" id="eswDeployApiName" maxlength="18"
                     placeholder="Embedded Service Deployment API name"
                     value="${d.deploymentName || ""}"
                     class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswDeploySiteEndpoint">Site Endpoint</label>
              <input type="url" id="eswDeploySiteEndpoint"
                     placeholder="https://example.my.site.com/ESWDeploymentName…"
                     value="${d.siteEndpoint || ""}"
                     class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswDeployScrt2">SCRT2 Endpoint</label>
              <input type="url" id="eswDeployScrt2"
                     placeholder="https://example.my.salesforce-scrt.com"
                     value="${d.scrt2URL || ""}"
                     class="slds-input">
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;">
              <button class="slds-button slds-button_brand" onclick="ESWMenu._applyDeploymentSettings()">Update</button>
              <button class="slds-button slds-button_neutral" id="eswClearOverrideBtn"
                      onclick="ESWMenu._clearDeploymentOverride()" style="display:none;">Clear Override</button>
            </div>
          </div>
        </div>`);
    }

    /* 3 · Pre-Chat Population */
    if (cfg.prechat && cfg.prechat.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswPrechatContent','eswPrechatIcon')">
            <h3 class="slds-text-heading_small">Pre-Chat Population</h3>
            <span id="eswPrechatIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswPrechatContent">
            <div class="esw-form-field">
              <label for="eswPcFirstName">First Name:</label>
              <input type="text" id="eswPcFirstName" value="Peter" class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswPcLastName">Last Name:</label>
              <input type="text" id="eswPcLastName" value="Chung" class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswPcEmail">Email:</label>
              <input type="email" id="eswPcEmail" value="pchung@salesforce.com" class="slds-input">
            </div>
            <div class="esw-form-field">
              <label for="eswPcSubject">Subject:</label>
              <input type="text" id="eswPcSubject" value="product question" class="slds-input">
            </div>
            <button class="slds-button slds-button_brand" onclick="ESWMenu._savePrechatFields()">Save</button>
          </div>
        </div>`);
    }

    /* 4 · Chat Button Visibility */
    if (cfg.chatButtonVisibility && cfg.chatButtonVisibility.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswChatBtnContent','eswChatBtnIcon')">
            <h3 class="slds-text-heading_small">Chat Button Visibility</h3>
            <span id="eswChatBtnIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswChatBtnContent">
            <div class="slds-form-element">
              <label class="slds-checkbox_toggle slds-grid">
                <span class="slds-form-element__label slds-m-bottom_none">Show Chat Button</span>
                <input type="checkbox" id="eswChatButtonToggle" onchange="ESWMenu._toggleChatButton()" checked />
                <span id="eswChatButtonToggle-label" class="slds-checkbox_faux_container" aria-live="assertive">
                  <span class="slds-checkbox_faux"></span>
                  <span class="slds-checkbox_on">Visible</span>
                  <span class="slds-checkbox_off">Hidden</span>
                </span>
              </label>
            </div>
          </div>
        </div>`);
    }

    /* 5 · Hidden Pre-chat */
    if (cfg.hiddenPrechat && cfg.hiddenPrechat.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswHiddenPcContent','eswHiddenPcIcon')">
            <h3 class="slds-text-heading_small">Hidden Pre-chat</h3>
            <span id="eswHiddenPcIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswHiddenPcContent">
            <div class="slds-form-element">
              <label class="slds-checkbox_toggle slds-grid">
                <span class="slds-form-element__label slds-m-bottom_none">Routing Direction</span>
                <input type="checkbox" id="eswRoutingDirectionToggle" onchange="ESWMenu._toggleRoutingDirection()" />
                <span id="eswRoutingDirectionToggle-label" class="slds-checkbox_faux_container" aria-live="assertive">
                  <span class="slds-checkbox_faux"></span>
                  <span class="slds-checkbox_on">Agent</span>
                  <span class="slds-checkbox_off">Queue</span>
                </span>
              </label>
            </div>
          </div>
        </div>`);
    }

    /* 6 · Event Log (inside panel) */
    if (cfg.eventLog && cfg.eventLog.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswEventLogPanelContent','eswEventLogPanelIcon')">
            <h3 class="slds-text-heading_small">Event Log</h3>
            <span id="eswEventLogPanelIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswEventLogPanelContent">
            <div class="esw-form-field" style="margin-bottom:0.5rem;">
              <label class="slds-checkbox" style="font-weight:normal;">
                <input type="checkbox" id="eswHideReceiptsCheckbox" />
                <span class="slds-checkbox_faux"></span>
                <span class="slds-form-element__label">Hide Send and Delivery Receipts</span>
              </label>
            </div>
            <div id="eswEventLog">
              <div style="color:#706e6b;">Waiting for events...</div>
            </div>
          </div>
        </div>`);
    }

    return `
      <div id="eswSlidePanel">
        <h2 class="slds-text-heading_medium">${cfg.pageTitle || "Page Settings"}</h2>
        ${sections.join("")}
      </div>
      <button id="eswToggleBtn" class="toggle-btn slds-button slds-button_brand"
              onclick="ESWMenu.togglePanel()">&#9776; Menu</button>
      <div id="eswToastContainer"></div>`;
  }

  /* ─── Public API ─────────────────────────────────────────────────────────── */
  const ESWMenu = {

    /* Called once per page to bootstrap the menu */
    init: function (cfg) {
      _cfg = cfg || {};

      injectStyles();

      // Inject markup — wrap in a single container so insertion order is preserved
      const wrapper = document.createElement("div");
      wrapper.innerHTML = buildPanelHTML(_cfg);
      // Insert the wrapper's children in order: panel first, then button, then toast
      const fragment = document.createDocumentFragment();
      while (wrapper.firstChild) {
        fragment.appendChild(wrapper.firstChild);
      }
      document.body.insertBefore(fragment, document.body.firstChild);

      // Restore saved deployment settings into the form fields
      ESWMenu._restoreDeploymentSettings();

      // If a deployment override is active, rebuild the Configuration Details
      // table with dynamically derived links for the overridden org.
      ESWMenu._refreshConfigDetails();

      // Wire pre-chat defaults if the page exposes prechatValues
      if (_cfg.prechat && _cfg.prechat.enabled) {
        ESWMenu._syncPrechatFromPage();
      }
    },

    /* Toggle the slide panel open / closed */
    togglePanel: function () {
      const panel = document.getElementById("eswSlidePanel");
      const btn   = document.getElementById("eswToggleBtn");
      if (!panel) return;
      panel.classList.toggle("open");
      if (btn) btn.classList.toggle("panel-open", panel.classList.contains("open"));
    },

    /* Show a toast notification */
    showToast: function (message, type) {
      type = type || "success";
      const container = document.getElementById("eswToastContainer");
      if (!container) return;

      const colors = {
        success: { bg: "#4bca81", border: "#2e844a" },
        error:   { bg: "#ea001e", border: "#c9302c" },
        info:    { bg: "#0176d3", border: "#014486" }
      };
      const c = colors[type] || colors.info;

      const toast = document.createElement("div");
      toast.style.cssText = [
        "background-color:" + c.bg,
        "color:white",
        "padding:0.75rem 1rem",
        "border-radius:4px",
        "margin-bottom:0.5rem",
        "box-shadow:0 2px 4px rgba(0,0,0,0.2)",
        "font-size:0.875rem",
        "font-weight:500",
        "border-left:4px solid " + c.border,
        "animation:eswSlideIn 0.3s ease-out",
        "max-width:300px"
      ].join(";");
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(function () {
        toast.style.animation = "eswSlideOut 0.3s ease-in";
        setTimeout(function () {
          if (toast.parentNode) container.removeChild(toast);
        }, 300);
      }, 1500);
    },

    /* Append an entry to the in-panel event log */
    logEvent: function (eventName, eventDetail) {
      const hideReceipts = document.getElementById("eswHideReceiptsCheckbox");
      if (hideReceipts && hideReceipts.checked &&
          (eventName === "onEmbeddedMessageRead" || eventName === "onEmbeddedMessageDelivered")) {
        return;
      }

      const log = document.getElementById("eswEventLog");
      if (!log) return;

      const timestamp = new Date().toLocaleTimeString();

      // Clear the placeholder text on first real event
      if (log.children.length === 1 && log.children[0].textContent === "Waiting for events...") {
        log.innerHTML = "";
      }

      const detailStr = (eventDetail && Object.keys(eventDetail).length > 0)
        ? JSON.stringify(eventDetail, null, 2)
        : "{}";

      const entryId = "eswEntry_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);

      const entry = document.createElement("div");
      entry.style.cssText = "margin-bottom:0.5rem;padding-bottom:0.5rem;border-bottom:1px solid #d8dde6;";

      // Build header row with DOM methods to avoid encoding issues with triangle chars
      const header = document.createElement("div");
      header.style.cssText = "cursor:pointer;user-select:none;";

      const toggleIcon = document.createElement("span");
      toggleIcon.className = "esw-toggle-icon";
      toggleIcon.style.cssText = "color:#706e6b;margin-right:0.5rem;";
      toggleIcon.textContent = "\u25B6"; // right-pointing triangle (collapsed)

      const tsSpan = document.createElement("span");
      tsSpan.style.cssText = "color:#0176d3;font-weight:bold;";
      tsSpan.textContent = "[" + timestamp + "]";

      const nameSpan = document.createElement("span");
      nameSpan.style.color = "#080707";
      nameSpan.textContent = " " + eventName;

      header.appendChild(toggleIcon);
      header.appendChild(tsSpan);
      header.appendChild(nameSpan);

      const body = document.createElement("div");
      body.id = entryId;
      body.style.cssText = "display:none;color:#706e6b;margin-left:1.5rem;margin-top:0.25rem;white-space:pre-wrap;";
      body.textContent = detailStr;

      header.addEventListener("click", function () {
        var isHidden = body.style.display === "none";
        body.style.display = isHidden ? "block" : "none";
        toggleIcon.textContent = isHidden ? "\u25BC" : "\u25B6"; // down = expanded, right = collapsed
      });

      entry.appendChild(header);
      entry.appendChild(body);

      log.appendChild(entry);

      if (log.children.length > MAX_LOG_ENTRIES) {
        log.removeChild(log.firstChild);
      }

      log.scrollTop = log.scrollHeight;
    },

    /* ── Internal helpers (prefixed _ to signal "private") ─────────────── */

    _toggleSection: function (contentId, iconId) {
      const content = document.getElementById(contentId);
      const icon    = document.getElementById(iconId);
      if (!content || !icon) return;
      content.classList.toggle("open");
      // \u25B2 = up-triangle  \u25BC = down-triangle  -- JS Unicode escapes, encoding-safe
      icon.textContent = content.classList.contains("open") ? "\u25B2" : "\u25BC";
    },

    /* ── Deployment Settings ────────────────────────────────────────────── */

    _restoreDeploymentSettings: function () {
      try {
        const saved = sessionStorage.getItem("eswDeployOverride");
        if (saved) {
          const s = JSON.parse(saved);
          if (s.orgId)          document.getElementById("eswDeployOrgId").value        = s.orgId;
          if (s.deploymentName) document.getElementById("eswDeployApiName").value      = s.deploymentName;
          if (s.siteEndpoint)   document.getElementById("eswDeploySiteEndpoint").value = s.siteEndpoint;
          if (s.scrt2URL)       document.getElementById("eswDeployScrt2").value        = s.scrt2URL;
          // Show the Clear Override button whenever an override is stored
          var clearBtn = document.getElementById("eswClearOverrideBtn");
          if (clearBtn) clearBtn.style.display = "inline-flex";
        }
      } catch (e) { /* sessionStorage not available */ }
    },

    _clearDeploymentOverride: function () {
      try { sessionStorage.removeItem("eswDeployOverride"); } catch (e) { /* ignore */ }
      ESWMenu.showToast("Override cleared. Reloading with default settings...", "info");
      setTimeout(function () { location.reload(); }, 800);
    },

    /* Rebuild the Configuration Details table.
     *
     * - If a deployment override is active in sessionStorage, the static rows
     *   supplied by the page are replaced with dynamically constructed links
     *   that point into the overridden org's Setup pages.
     * - If no override exists, the original page-supplied rows are (re)rendered,
     *   keeping the precise deep-links the page author provided.
     * - A banner is added at the top of the table whenever an override is active
     *   so the user always knows they are not looking at the default config.
     */
    _refreshConfigDetails: function () {
      const table = document.querySelector("#eswConfigContent .esw-info-table");
      if (!table) return; // configDetails section not rendered for this page

      var overrideActive = false;
      var deploy = null;
      try {
        const saved = sessionStorage.getItem("eswDeployOverride");
        if (saved) {
          const s = JSON.parse(saved);
          if (s.orgId && s.deploymentName && s.siteEndpoint && s.scrt2URL) {
            overrideActive = true;
            deploy = s;
          }
        }
      } catch (e) { /* ignore */ }

      if (overrideActive) {
        // Replace table rows with override-derived links
        table.innerHTML = buildOverrideConfigRows(deploy);

        // Show the override banner (create it once, update each call)
        var banner = document.getElementById("eswConfigOverrideBanner");
        if (!banner) {
          banner = document.createElement("p");
          banner.id = "eswConfigOverrideBanner";
          banner.style.cssText = [
            "font-size:0.8rem",
            "color:#b05e00",
            "background:#fff3cd",
            "border:1px solid #f0c040",
            "border-radius:4px",
            "padding:0.4rem 0.6rem",
            "margin-bottom:0.75rem"
          ].join(";");
          banner.textContent = "Using override deployment. Links below go to Setup list pages "
                             + "(direct record links are unavailable for custom orgs). "
                             + "Clear the override in Deployment Settings to restore the original links.";
          table.parentNode.insertBefore(banner, table);
        }
      } else {
        // Override cleared — restore original page-supplied rows
        if (_cfg.configDetails && _cfg.configDetails.rows) {
          table.innerHTML = buildConfigRows(_cfg.configDetails.rows);
        }
        // Remove banner if present
        var existing = document.getElementById("eswConfigOverrideBanner");
        if (existing) existing.parentNode.removeChild(existing);
      }
    },

    _applyDeploymentSettings: function () {
      const orgId          = (document.getElementById("eswDeployOrgId").value        || "").trim();
      const deploymentName = (document.getElementById("eswDeployApiName").value      || "").trim();
      const siteEndpoint   = (document.getElementById("eswDeploySiteEndpoint").value || "").trim();
      const scrt2URL       = (document.getElementById("eswDeployScrt2").value        || "").trim();

      if (!orgId || !deploymentName || !siteEndpoint || !scrt2URL) {
        ESWMenu.showToast("Please fill in all Deployment Settings fields", "error");
        return;
      }

      // Basic URL validation
      try {
        new URL(siteEndpoint);
        new URL(scrt2URL);
      } catch (e) {
        ESWMenu.showToast("Site Endpoint and SCRT2 Endpoint must be valid URLs", "error");
        return;
      }

      // Persist in sessionStorage so the values survive the reload
      try {
        sessionStorage.setItem("eswDeployOverride", JSON.stringify({
          orgId, deploymentName, siteEndpoint, scrt2URL
        }));
      } catch (e) { /* ignore */ }

      ESWMenu.showToast("Reloading with new deployment settings…", "info");
      setTimeout(function () { location.reload(); }, 800);
    },

    /**
     * Called by each page's initEmbeddedMessaging() to get the active
     * deployment configuration (either the saved override or the page defaults).
     *
     * Usage in your page script:
     *
     *   function initEmbeddedMessaging() {
     *     const deploy = ESWMenu.getDeploymentConfig({
     *       orgId:          "00DWs00000CvEVZ",
     *       deploymentName: "MIAW_Direct_to_Service_Rep",
     *       siteEndpoint:   "https://…",
     *       scrt2URL:       "https://…"
     *     });
     *
     *     embeddedservice_bootstrap.settings.language = 'en_US';
     *     embeddedservice_bootstrap.init(
     *       deploy.orgId,
     *       deploy.deploymentName,
     *       deploy.siteEndpoint,
     *       { scrt2URL: deploy.scrt2URL }
     *     );
     *   }
     */
    getDeploymentConfig: function (pageDefaults) {
      try {
        const saved = sessionStorage.getItem("eswDeployOverride");
        if (saved) {
          const s = JSON.parse(saved);
          if (s.orgId && s.deploymentName && s.siteEndpoint && s.scrt2URL) {
            return s;
          }
        }
      } catch (e) { /* ignore */ }
      return pageDefaults;
    },

    /**
     * Returns the bootstrap.min.js URL for the current (or overridden)
     * deployment. The path convention is:
     *   {siteEndpoint}/assets/js/bootstrap.min.js
     *
     * Usage in your page's <script> tag:
     *   <script>
     *     // Dynamically load bootstrap after ESWMenu is available
     *     (function(){
     *       var s = document.createElement('script');
     *       s.src = ESWMenu.getBootstrapURL("https://default.site.com/ESWDeployment…");
     *       s.onload = initEmbeddedMessaging;
     *       document.head.appendChild(s);
     *     })();
     *   </script>
     */
    getBootstrapURL: function (defaultSiteEndpoint) {
      try {
        const saved = sessionStorage.getItem("eswDeployOverride");
        if (saved) {
          const s = JSON.parse(saved);
          if (s.siteEndpoint) {
            return s.siteEndpoint.replace(/\/$/, "") + "/assets/js/bootstrap.min.js";
          }
        }
      } catch (e) { /* ignore */ }
      return defaultSiteEndpoint.replace(/\/$/, "") + "/assets/js/bootstrap.min.js";
    },

    /* ── Pre-Chat ────────────────────────────────────────────────────────── */

    /** Pull values from the page's global prechatValues (if present) into the
     *  form fields. Called once during init. */
    _syncPrechatFromPage: function () {
      // If the page still uses its own prechatValues object, seed the form
      if (typeof prechatValues !== "undefined") {
        var pv = prechatValues; // global defined on the page
        if (pv._firstName) document.getElementById("eswPcFirstName").value = pv._firstName.value || "";
        if (pv._lastName)  document.getElementById("eswPcLastName").value  = pv._lastName.value  || "";
        if (pv._email)     document.getElementById("eswPcEmail").value     = pv._email.value     || "";
        if (pv._subject)   document.getElementById("eswPcSubject").value   = pv._subject.value   || "";
      }
    },

    _savePrechatFields: function () {
      // Update the page's global prechatValues object if it exists
      if (typeof prechatValues !== "undefined") {
        prechatValues._firstName = { value: document.getElementById("eswPcFirstName").value, isEditableByEndUser: true };
        prechatValues._lastName  = { value: document.getElementById("eswPcLastName").value,  isEditableByEndUser: true };
        prechatValues._email     = { value: document.getElementById("eswPcEmail").value,     isEditableByEndUser: true };
        prechatValues._subject   = { value: document.getElementById("eswPcSubject").value,   isEditableByEndUser: true };
      }

      if (typeof embeddedservice_bootstrap !== "undefined" && embeddedservice_bootstrap.prechatAPI) {
        try {
          const fields = {
            _firstName: { value: document.getElementById("eswPcFirstName").value, isEditableByEndUser: true },
            _lastName:  { value: document.getElementById("eswPcLastName").value,  isEditableByEndUser: true },
            _email:     { value: document.getElementById("eswPcEmail").value,     isEditableByEndUser: true },
            _subject:   { value: document.getElementById("eswPcSubject").value,   isEditableByEndUser: true }
          };
          const result = embeddedservice_bootstrap.prechatAPI.setVisiblePrechatFields(fields);
          if (result && typeof result.then === "function") {
            result.then(function () {
              ESWMenu.showToast("Pre-chat fields updated successfully!", "success");
            }).catch(function () {
              ESWMenu.showToast("Error updating pre-chat fields", "error");
            });
          } else {
            ESWMenu.showToast("Pre-chat fields updated successfully!", "success");
          }
        } catch (e) {
          ESWMenu.showToast("Exception updating pre-chat fields", "error");
        }
      } else {
        ESWMenu.showToast("Pre-chat fields will be applied when chat loads", "info");
      }
    },

    /* ── Chat Button Visibility ─────────────────────────────────────────── */

    _toggleChatButton: function () {
      const isChecked = document.getElementById("eswChatButtonToggle").checked;
      if (typeof embeddedservice_bootstrap !== "undefined" && embeddedservice_bootstrap.utilAPI) {
        const method = isChecked ? "showChatButton" : "hideChatButton";
        try {
          const result = embeddedservice_bootstrap.utilAPI[method]();
          // The API may be synchronous or return a Promise depending on the version
          if (result && typeof result.then === "function") {
            result
              .then(function () {
                ESWMenu.showToast(isChecked ? "Chat button visible" : "Chat button hidden", "success");
              })
              .catch(function () {
                ESWMenu.showToast("Unable to " + (isChecked ? "show" : "hide") + " chat button", "error");
                document.getElementById("eswChatButtonToggle").checked = !isChecked;
              });
          } else {
            // Synchronous — just show the toast directly
            ESWMenu.showToast(isChecked ? "Chat button visible" : "Chat button hidden", "success");
          }
        } catch (e) {
          ESWMenu.showToast("Unable to " + (isChecked ? "show" : "hide") + " chat button", "error");
          document.getElementById("eswChatButtonToggle").checked = !isChecked;
        }
      } else {
        ESWMenu.showToast("Chat is not ready yet", "info");
        document.getElementById("eswChatButtonToggle").checked = !isChecked;
      }
    },

    /* ── Hidden Pre-chat ────────────────────────────────────────────────── */

    _toggleRoutingDirection: function () {
      const isChecked   = document.getElementById("eswRoutingDirectionToggle").checked;
      const routingValue = isChecked ? "Agent" : "Queue";
      if (typeof embeddedservice_bootstrap !== "undefined" && embeddedservice_bootstrap.prechatAPI) {
        try {
          embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields({ routingDirection: routingValue });
          ESWMenu.showToast("Routing Direction: " + routingValue, "success");
        } catch (e) {
          ESWMenu.showToast("Failed to set routing direction", "error");
        }
      } else {
        ESWMenu.showToast("Routing Direction: " + routingValue, "info");
      }
    }

  }; // end ESWMenu

  /* Expose globally */
  global.ESWMenu = ESWMenu;

}(window));
