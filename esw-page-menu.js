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
      /* ── Nav bar ────────────────────────────────────────────────────── */
      #esw-nav {
        position: fixed;
        top: 0; left: 0; right: 0;
        height: 52px;
        background: #111118;
        border-bottom: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 1px 20px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        padding: 0 1.25rem;
        z-index: 900;
        gap: 0.75rem;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        box-sizing: border-box;
      }
      #esw-nav .esw-nav-logo { flex-shrink: 0; display: flex; align-items: center; }
      #esw-nav .esw-nav-logo svg { width: 28px; height: 28px; }
      #esw-nav .esw-nav-title {
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      #esw-nav .esw-nav-spacer { flex: 1; }
      #esw-nav-right-slot { display: flex; align-items: center; gap: 0.4rem; }
      /* Nav search styling */
      #esw-nav-right-slot input {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        padding: 0.35rem 0.75rem;
        color: #e8e8f0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 0.8rem;
        width: 220px;
        outline: none;
        transition: border-color 0.2s, background 0.2s;
        box-sizing: border-box;
      }
      #esw-nav-right-slot input::placeholder { color: #44445a; }
      #esw-nav-right-slot input:focus {
        border-color: rgba(130,70,255,0.6);
        background: rgba(255,255,255,0.10);
      }
      #esw-nav-right-slot button {
        background: rgba(130,70,255,0.2);
        border: 1px solid rgba(130,70,255,0.4);
        border-radius: 6px;
        color: #c8a0ff;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 0.8rem;
        font-weight: 500;
        padding: 0.35rem 0.8rem;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.2s, border-color 0.2s;
      }
      #esw-nav-right-slot button:hover {
        background: rgba(130,70,255,0.35);
        border-color: rgba(160,100,255,0.7);
      }
      #esw-nav-menu-slot { display: flex; align-items: center; margin-left: 0.25rem; }

      /* ── Slide panel (dark theme) ───────────────────────────────────── */
      #eswSlidePanel {
        position: fixed;
        left: -700px;
        top: 0;
        width: 700px;
        height: 100vh;
        background: #0d0d14;
        border-right: 1px solid rgba(255,255,255,0.1);
        box-shadow: 4px 0 32px rgba(0,0,0,0.7);
        transition: left 0.3s ease-in-out;
        z-index: 1100;
        padding: 2rem;
        overflow-y: auto;
        box-sizing: border-box;
        color: #e8e8f0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
      }
      #eswSlidePanel.open { left: 0; }
      #eswSlidePanel h2 {
        color: #fff;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-weight: 700;
        font-size: 1.1rem;
        margin-bottom: 0.5rem;
      }

      /* ── Toggle button ──────────────────────────────────────────────── */
      #eswToggleBtn {
        position: fixed;
        left: 20px;
        top: 12px;
        z-index: 1101;
        font-size: 0.8rem;
        padding: 0.35rem 0.75rem;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        color: #c8c8e0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        transition: background 0.2s, border-color 0.2s;
        box-shadow: none;
        cursor: pointer;
      }
      #eswToggleBtn:hover {
        background: rgba(255,255,255,0.11);
        border-color: rgba(255,255,255,0.22);
      }
      /* When moved into nav: override fixed positioning */
      #esw-nav-menu-slot #eswToggleBtn {
        position: static;
        left: auto;
        top: auto;
      }
      #eswToggleBtn.panel-open { left: 720px; }
      #esw-nav-menu-slot #eswToggleBtn.panel-open {
        left: auto;
        background: rgba(130,70,255,0.2);
        border-color: rgba(130,70,255,0.5);
        color: #d4aaff;
      }

      /* ── Collapsible sections ───────────────────────────────────────── */
      .esw-collapsible-section {
        margin-top: 1.5rem;
        border-top: 1px solid rgba(255,255,255,0.08);
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
        color: #e8e8f0;
      }
      .esw-collapsible-header h3 { color: #e8e8f0; font-size: 0.875rem; margin: 0; }
      .esw-collapsible-header span { color: #6868a0; }
      .esw-collapsible-header:hover { background: rgba(255,255,255,0.04); border-radius: 4px; }
      .esw-collapsible-content { display: none; padding-top: 1rem; color: #c0c0d8; }
      .esw-collapsible-content.open { display: block; }

      /* ── Info table ─────────────────────────────────────────────────── */
      .esw-info-table { width: 100%; border-collapse: collapse; }
      .esw-info-table td { padding: 0.4rem 0; border: none; font-size: 0.8rem; color: #a0a0b8; }
      .esw-info-table td:first-child { font-weight: 600; width: 40%; color: #c8c8e0; }
      .esw-info-table a { color: #a070f0; text-decoration: none; }
      .esw-info-table a:hover { text-decoration: underline; }

      /* ── Form fields ────────────────────────────────────────────────── */
      .esw-form-field { margin-bottom: 1rem; }
      .esw-form-field label {
        display: block;
        font-weight: 600;
        margin-bottom: 0.3rem;
        font-size: 0.8rem;
        color: #c8c8e0;
      }
      .esw-form-field input,
      .esw-form-field textarea {
        width: 100%;
        padding: 0.45rem 0.6rem;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 6px;
        box-sizing: border-box;
        font-size: 0.8rem;
        color: #e8e8f0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        transition: border-color 0.2s;
      }
      .esw-form-field input::placeholder,
      .esw-form-field textarea::placeholder { color: #44445a; }
      .esw-form-field input:focus,
      .esw-form-field textarea:focus { border-color: rgba(130,70,255,0.6); outline: none; }
      .esw-form-field p { color: #6868a0; font-size: 0.75rem; margin: 0.25rem 0 0.5rem; }
      .esw-form-field code {
        background: rgba(255,255,255,0.08);
        padding: 0.1em 0.3em;
        border-radius: 3px;
        font-size: 0.75rem;
        color: #c8a0ff;
      }

      /* ── Buttons inside panel ───────────────────────────────────────── */
      #eswSlidePanel button.btn-brand {
        background: linear-gradient(135deg, #7b2ff7, #5a1bc2);
        border: none;
        border-radius: 6px;
        color: #fff;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
        padding: 0.45rem 1rem;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(123,47,247,0.35);
      }
      #eswSlidePanel button.btn-brand:hover { box-shadow: 0 0 20px rgba(123,47,247,0.55); }
      #eswSlidePanel button.btn-neutral {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 6px;
        color: #c8c8e0;
        font-family: 'Inter', 'Segoe UI', sans-serif;
        font-size: 0.8rem;
        padding: 0.45rem 1rem;
        cursor: pointer;
      }
      #eswSlidePanel button.btn-neutral:hover { background: rgba(255,255,255,0.10); }

      /* ── Toggle switches inside panel ───────────────────────────────── */
      .esw-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1rem;
      }
      .esw-toggle-row label { font-size: 0.8rem; color: #c8c8e0; }
      .esw-toggle {
        position: relative;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
      }
      .esw-toggle input { opacity: 0; width: 0; height: 0; }
      .esw-toggle-track {
        position: absolute;
        inset: 0;
        border-radius: 12px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.18);
        cursor: pointer;
        transition: background 0.2s;
      }
      .esw-toggle-track::after {
        content: '';
        position: absolute;
        top: 3px; left: 3px;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: #888;
        transition: transform 0.2s, background 0.2s;
      }
      .esw-toggle input:checked + .esw-toggle-track {
        background: rgba(123,47,247,0.5);
        border-color: rgba(123,47,247,0.7);
      }
      .esw-toggle input:checked + .esw-toggle-track::after {
        transform: translateX(20px);
        background: #b070ff;
      }
      .esw-toggle-label { font-size: 0.72rem; color: #6868a0; margin-left: 0.5rem; }

      /* ── Override banner ────────────────────────────────────────────── */
      #eswConfigOverrideBanner {
        background: rgba(176,94,0,0.15);
        border: 1px solid rgba(240,192,64,0.3);
        border-radius: 4px;
        color: #f0c040;
        font-size: 0.8rem;
        padding: 0.4rem 0.6rem;
        margin-bottom: 0.75rem;
      }

      /* ── Snippet status ─────────────────────────────────────────────── */
      #eswSnippetStatus { font-size: 0.75rem; margin-top: 0.25rem; min-height: 1.2em; }

      /* ── Event log (inside panel) ───────────────────────────────────── */
      #eswEventLog {
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 6px;
        background: rgba(0,0,0,0.35);
        padding: 1rem;
        height: 380px;
        overflow-y: auto;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        margin-top: 0.75rem;
        color: #a0a0b8;
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
    // Append to body (after SLDS) so our rules win on same-specificity ties
    (document.body || document.head).appendChild(style);
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
            <h3>Configuration Details</h3>
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
            <h3>Deployment Settings</h3>
            <span id="eswDeployIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswDeployContent">

            <!-- Configuration Mode Toggle -->
            <div class="esw-toggle-row" style="margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.08);">
              <label style="font-weight:600;">Configuration Mode</label>
              <div style="display:flex;align-items:center;gap:0.5rem;">
                <span class="esw-toggle-label" id="eswConfigModeLabel" style="margin:0;">Manual</span>
                <label class="esw-toggle">
                  <input type="checkbox" id="eswConfigModeToggle" onchange="ESWMenu._toggleConfigMode()">
                  <span class="esw-toggle-track"></span>
                </label>
                <span class="esw-toggle-label" style="margin:0;">Saved</span>
              </div>
            </div>

            <!-- Saved Configuration Mode -->
            <div id="eswSavedConfigMode" style="display:none;">
              <div class="esw-form-field">
                <label for="eswSavedConfigSelect">Select Configuration</label>
                <select id="eswSavedConfigSelect"
                        style="width:100%;padding:0.45rem 0.6rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;box-sizing:border-box;font-size:0.8rem;color:#e8e8f0;font-family:'Inter','Segoe UI',sans-serif;"
                        onchange="ESWMenu._onSavedConfigSelect()">
                  <option value="">-- Select a configuration --</option>
                </select>
              </div>
              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem;">
                <button class="btn-brand" id="eswLoadConfigBtn" onclick="ESWMenu._loadSelectedConfig()" disabled
                        style="opacity:0.5;cursor:not-allowed;">Load Configuration</button>
                <button class="btn-neutral" onclick="ESWMenu._refreshSavedConfigs()">Refresh List</button>
              </div>
            </div>

            <!-- Manual Configuration Mode -->
            <div id="eswManualConfigMode">
              <div class="esw-form-field">
                <label for="eswDeploySnippet">Paste Code Snippet</label>
                <p>
                  In Salesforce Setup, open your Embedded Service deployment and copy the code snippet
                  from the <strong>Code Snippets</strong> section. Paste the entire snippet (or just the
                  <code>embeddedservice_bootstrap.init(...)</code> block) below — the fields will
                  be populated automatically.
                </p>
                <textarea id="eswDeploySnippet" rows="5"
                          placeholder="Paste the embeddedservice_bootstrap.init(...) block or the full &lt;script&gt; snippet here..."
                          style="font-family:monospace;font-size:0.8rem;resize:vertical;width:100%;box-sizing:border-box;"
                          oninput="ESWMenu._parseSnippet()"></textarea>
                <p id="eswSnippetStatus" style="font-size:0.8rem;margin-top:0.25rem;min-height:1.2em;"></p>
              </div>

              <div id="eswDeployFields">
                <div class="esw-form-field">
                  <label for="eswDeployOrgId">Org ID</label>
                  <input type="text" id="eswDeployOrgId" maxlength="15"
                         placeholder="15-character Org ID"
                         value="${d.orgId || ""}">
                </div>
                <div class="esw-form-field">
                  <label for="eswDeployApiName">Deployment API Name</label>
                  <input type="text" id="eswDeployApiName" maxlength="18"
                         placeholder="Embedded Service Deployment API name"
                         value="${d.deploymentName || ""}">
                </div>
                <div class="esw-form-field">
                  <label for="eswDeploySiteEndpoint">Site Endpoint</label>
                  <input type="url" id="eswDeploySiteEndpoint"
                         placeholder="https://example.my.site.com/ESWDeploymentName"
                         value="${d.siteEndpoint || ""}">
                </div>
                <div class="esw-form-field">
                  <label for="eswDeployScrt2">SCRT2 Endpoint</label>
                  <input type="url" id="eswDeployScrt2"
                         placeholder="https://example.my.salesforce-scrt.com"
                         value="${d.scrt2URL || ""}">
                </div>
              </div>

              <!-- Save Configuration Checkbox -->
              <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.08);">
                <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.8rem;color:#c8c8e0;">
                  <input type="checkbox" id="eswSaveConfigCheckbox" onchange="ESWMenu._toggleSaveConfigFields()"
                         style="cursor:pointer;">
                  <span>Save this configuration for future use</span>
                </label>
              </div>

              <!-- Additional Fields for Saving -->
              <div id="eswSaveConfigFields" style="display:none;margin-top:1rem;">
                <div class="esw-form-field">
                  <label for="eswConfigName">Configuration Name*</label>
                  <input type="text" id="eswConfigName" placeholder="e.g., Production Org">
                </div>
                <div class="esw-form-field">
                  <label for="eswConfigInstance">Instance*</label>
                  <input type="text" id="eswConfigInstance" placeholder="e.g., USA794">
                </div>
                <div class="esw-form-field">
                  <label for="eswConfigInstanceType">Instance Type*</label>
                  <select id="eswConfigInstanceType"
                          style="width:100%;padding:0.45rem 0.6rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;box-sizing:border-box;font-size:0.8rem;color:#e8e8f0;font-family:'Inter','Segoe UI',sans-serif;">
                    <option value="">-- Select --</option>
                    <option value="Prod">Prod</option>
                    <option value="Test">Test</option>
                    <option value="Dev">Dev</option>
                  </select>
                </div>
                <div class="esw-form-field">
                  <label for="eswConfigClientType">Client Type*</label>
                  <select id="eswConfigClientType"
                          style="width:100%;padding:0.45rem 0.6rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;box-sizing:border-box;font-size:0.8rem;color:#e8e8f0;font-family:'Inter','Segoe UI',sans-serif;">
                    <option value="">-- Select --</option>
                    <option value="v1">v1</option>
                    <option value="v2">v2</option>
                  </select>
                </div>
              </div>

              <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem;">
                <button class="btn-brand" onclick="ESWMenu._applyDeploymentSettings()">Update</button>
                <button class="btn-neutral" id="eswClearOverrideBtn"
                        onclick="ESWMenu._clearDeploymentOverride()" style="display:none;">Clear Override</button>
              </div>
            </div>
          </div>
        </div>`);
    }

    /* 3 · Pre-Chat Population */
    if (cfg.prechat && cfg.prechat.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswPrechatContent','eswPrechatIcon')">
            <h3>Pre-Chat Population</h3>
            <span id="eswPrechatIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswPrechatContent">
            <div class="esw-form-field">
              <label for="eswPcFirstName">First Name</label>
              <input type="text" id="eswPcFirstName" value="Peter">
            </div>
            <div class="esw-form-field">
              <label for="eswPcLastName">Last Name</label>
              <input type="text" id="eswPcLastName" value="Chung">
            </div>
            <div class="esw-form-field">
              <label for="eswPcEmail">Email</label>
              <input type="email" id="eswPcEmail" value="pchung@salesforce.com">
            </div>
            <div class="esw-form-field">
              <label for="eswPcSubject">Subject</label>
              <input type="text" id="eswPcSubject" value="product question">
            </div>
            <button class="btn-brand" onclick="ESWMenu._savePrechatFields()">Save</button>
          </div>
        </div>`);
    }

    /* 4 · Chat Button Visibility */
    if (cfg.chatButtonVisibility && cfg.chatButtonVisibility.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswChatBtnContent','eswChatBtnIcon')">
            <h3>Chat Button Visibility</h3>
            <span id="eswChatBtnIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswChatBtnContent">
            <div class="esw-toggle-row">
              <label>Show Chat Button</label>
              <label class="esw-toggle">
                <input type="checkbox" id="eswChatButtonToggle" onchange="ESWMenu._toggleChatButton()" checked>
                <span class="esw-toggle-track"></span>
              </label>
              <span class="esw-toggle-label" id="eswChatBtnLabel">Visible</span>
            </div>
          </div>
        </div>`);
    }

    /* 5 · Hidden Pre-chat */
    if (cfg.hiddenPrechat && cfg.hiddenPrechat.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswHiddenPcContent','eswHiddenPcIcon')">
            <h3>Hidden Pre-chat</h3>
            <span id="eswHiddenPcIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswHiddenPcContent">
            <div class="esw-toggle-row">
              <label>Routing Direction</label>
              <label class="esw-toggle">
                <input type="checkbox" id="eswRoutingDirectionToggle" onchange="ESWMenu._toggleRoutingDirection()">
                <span class="esw-toggle-track"></span>
              </label>
              <span class="esw-toggle-label" id="eswRoutingLabel">Queue</span>
            </div>
          </div>
        </div>`);
    }

    /* 6 · Inline Mode */
    if (cfg.inlineMode && cfg.inlineMode.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswInlineModeContent','eswInlineModeIcon')">
            <h3>Inline Mode</h3>
            <span id="eswInlineModeIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswInlineModeContent">
            <div class="esw-toggle-row">
              <label>Display Mode</label>
              <label class="esw-toggle">
                <input type="checkbox" id="eswDisplayModeToggle" onchange="ESWMenu._updateDisplayModeLabel()">
                <span class="esw-toggle-track"></span>
              </label>
              <span class="esw-toggle-label" id="eswDisplayModeLabel">Inline</span>
            </div>
            <div class="esw-toggle-row" style="margin-bottom:1.25rem;">
              <label>Chat Header</label>
              <label class="esw-toggle">
                <input type="checkbox" id="eswHeaderEnabledToggle" checked onchange="ESWMenu._updateHeaderLabel()">
                <span class="esw-toggle-track"></span>
              </label>
              <span class="esw-toggle-label" id="eswHeaderLabel">Enabled</span>
            </div>
            <button class="btn-brand" onclick="ESWMenu._applyInlineModeSettings()">Update</button>
          </div>
        </div>`);
    }

    /* 7 · Event Log (inside panel) */
    if (cfg.eventLog && cfg.eventLog.enabled) {
      sections.push(`
        <div class="esw-collapsible-section">
          <div class="esw-collapsible-header" onclick="ESWMenu._toggleSection('eswEventLogPanelContent','eswEventLogPanelIcon')">
            <h3>Event Log</h3>
            <span id="eswEventLogPanelIcon">&#9660;</span>
          </div>
          <div class="esw-collapsible-content" id="eswEventLogPanelContent">
            <div class="esw-toggle-row" style="margin-bottom:0.75rem;">
              <label style="font-weight:normal;">Hide Send and Delivery Receipts</label>
              <label class="esw-toggle">
                <input type="checkbox" id="eswHideReceiptsCheckbox">
                <span class="esw-toggle-track"></span>
              </label>
            </div>
            <div id="eswEventLog">
              <div style="color:#5a5a7a;">Waiting for events...</div>
            </div>
          </div>
        </div>`);
    }

    // Build navbar HTML only when explicitly requested via cfg.navbar
    var navHTML = "";
    if (cfg.navbar && cfg.navbar !== false) {
      var navTitle = cfg.navbar.title || cfg.pageTitle || "Demo";
      var navRightSlot = (cfg.navbar && cfg.navbar.rightSlotHTML) || "";
      navHTML = `
      <nav id="esw-nav">
        <div class="esw-nav-logo">
          <svg viewBox="0 0 52 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Salesforce">
            <path d="M21.6 4.2a10.4 10.4 0 0 1 7.4 3.1 14.3 14.3 0 0 1 6.9-1.8c7.9 0 14.3 6.4 14.3 14.4S43.8 34.3 35.9 34.3c-1 0-2-.1-2.9-.3a8.6 8.6 0 0 1-7.7 4.7 8.5 8.5 0 0 1-6.3-2.8 11.6 11.6 0 0 1-4.5.9C7.8 36.8 2 31 2 23.7c0-4.5 2.2-8.5 5.6-10.9a10.4 10.4 0 0 1 14-8.6z" fill="#00A1E0"/>
          </svg>
        </div>
        <span class="esw-nav-title">${navTitle}</span>
        <div class="esw-nav-spacer"></div>
        <div id="esw-nav-right-slot">${navRightSlot}</div>
        <div id="esw-nav-menu-slot"></div>
      </nav>`;
    }

    return `
      ${navHTML}
      <div id="eswSlidePanel">
        <h2>${cfg.pageTitle || "Page Settings"}</h2>
        ${sections.join("")}
      </div>
      <button id="eswToggleBtn" onclick="ESWMenu.togglePanel()">&#9776; Menu</button>
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

      // Restore saved hidden pre-chat settings (routing direction) into the panel toggles
      if (_cfg.hiddenPrechat && _cfg.hiddenPrechat.enabled) {
        ESWMenu._restoreHiddenPrechatSettings();
      }

      // Restore saved inline mode settings into the panel toggles
      if (_cfg.inlineMode && _cfg.inlineMode.enabled) {
        ESWMenu._restoreInlineModeSettings();
      }

      // If navbar was rendered, move the toggle button into its menu slot
      var menuSlot = document.getElementById("esw-nav-menu-slot");
      var toggleBtn = document.getElementById("eswToggleBtn");
      if (menuSlot && toggleBtn) {
        menuSlot.appendChild(toggleBtn);
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
      entry.style.cssText = "margin-bottom:0.5rem;padding-bottom:0.5rem;border-bottom:1px solid rgba(255,255,255,0.08);";

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
      nameSpan.style.color = "#c8c8e0";
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

    /* Configuration storage file URL */
    CONFIGS_URL: "https://raw.githubusercontent.com/pchungesw/pchungesw.github.io/main/deployment-configs.json",

    /* In-memory cache of saved configurations */
    _savedConfigs: [],

    /* Toggle between Manual and Saved Configuration modes */
    _toggleConfigMode: function () {
      const toggle = document.getElementById("eswConfigModeToggle");
      const manualMode = document.getElementById("eswManualConfigMode");
      const savedMode = document.getElementById("eswSavedConfigMode");

      if (toggle && manualMode && savedMode) {
        if (toggle.checked) {
          // Saved mode
          manualMode.style.display = "none";
          savedMode.style.display = "block";
          ESWMenu._loadSavedConfigs();
        } else {
          // Manual mode
          manualMode.style.display = "block";
          savedMode.style.display = "none";
        }
      }
    },

    /* Toggle visibility of save configuration fields */
    _toggleSaveConfigFields: function () {
      const checkbox = document.getElementById("eswSaveConfigCheckbox");
      const fields = document.getElementById("eswSaveConfigFields");
      if (checkbox && fields) {
        fields.style.display = checkbox.checked ? "block" : "none";
      }
    },

    /* Load saved configurations from GitHub */
    _loadSavedConfigs: function () {
      fetch(ESWMenu.CONFIGS_URL + "?t=" + Date.now()) // cache bust
        .then(function (response) {
          if (!response.ok) {
            throw new Error("HTTP " + response.status + ": " + response.statusText);
          }
          return response.json();
        })
        .then(function (data) {
          console.log("Loaded configurations:", data);
          if (!data || !data.configurations) {
            throw new Error("Invalid configuration file format - missing 'configurations' array");
          }
          ESWMenu._savedConfigs = data.configurations;
          console.log("Found " + ESWMenu._savedConfigs.length + " configuration(s)");
          ESWMenu._populateSavedConfigsDropdown();
          if (ESWMenu._savedConfigs.length > 0) {
            ESWMenu.showToast("Loaded " + ESWMenu._savedConfigs.length + " configuration(s)", "success");
          }
        })
        .catch(function (err) {
          console.error("Error loading saved configs:", err);
          console.error("Error details:", err.message);
          // Try to load from localStorage as fallback
          try {
            const local = localStorage.getItem("eswLocalConfigs");
            if (local) {
              ESWMenu._savedConfigs = JSON.parse(local);
              ESWMenu._populateSavedConfigsDropdown();
              ESWMenu.showToast("Loaded configurations from local storage (GitHub unavailable)", "info");
            } else {
              ESWMenu.showToast("Unable to load configurations: " + err.message, "error");
            }
          } catch (e) {
            console.error("localStorage fallback failed:", e);
            ESWMenu.showToast("Unable to load saved configurations", "error");
          }
        });
    },

    /* Refresh the saved configurations list */
    _refreshSavedConfigs: function () {
      ESWMenu._loadSavedConfigs();
      ESWMenu.showToast("Refreshing configuration list...", "info");
    },

    /* Populate the saved configurations dropdown */
    _populateSavedConfigsDropdown: function () {
      const select = document.getElementById("eswSavedConfigSelect");
      if (!select) {
        console.warn("Saved config dropdown not found in DOM");
        return;
      }

      // Clear existing options except the first (placeholder)
      select.innerHTML = '<option value="">-- Select a configuration --</option>';

      if (!ESWMenu._savedConfigs || ESWMenu._savedConfigs.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No configurations available";
        option.disabled = true;
        select.appendChild(option);
        return;
      }

      // Add options for each saved config
      ESWMenu._savedConfigs.forEach(function (config, index) {
        try {
          // Validate required fields
          if (!config.name || !config.instanceType || !config.instance || !config.clientType) {
            console.error("Invalid config at index " + index + ":", config);
            return; // Skip this config
          }

          const option = document.createElement("option");
          option.value = index;
          // Format: "Name (InstanceType/Instance, ClientType)"
          option.textContent = config.name + " (" + config.instanceType + "/" + config.instance + ", " + config.clientType + ")";
          select.appendChild(option);
          console.log("Added config option:", option.textContent);
        } catch (e) {
          console.error("Error adding config at index " + index + ":", e);
        }
      });
    },

    /* Enable/disable load button when selection changes */
    _onSavedConfigSelect: function () {
      const select = document.getElementById("eswSavedConfigSelect");
      const loadBtn = document.getElementById("eswLoadConfigBtn");

      if (select && loadBtn) {
        const hasSelection = select.value !== "";
        loadBtn.disabled = !hasSelection;
        loadBtn.style.opacity = hasSelection ? "1" : "0.5";
        loadBtn.style.cursor = hasSelection ? "pointer" : "not-allowed";
      }
    },

    /* Load the selected configuration and reload the page */
    _loadSelectedConfig: function () {
      const select = document.getElementById("eswSavedConfigSelect");
      if (!select || select.value === "") return;

      const index = parseInt(select.value, 10);
      const config = ESWMenu._savedConfigs[index];

      if (!config) {
        ESWMenu.showToast("Configuration not found", "error");
        return;
      }

      // Store in sessionStorage and reload
      try {
        sessionStorage.setItem("eswDeployOverride", JSON.stringify({
          orgId: config.orgId,
          deploymentName: config.deploymentName,
          siteEndpoint: config.siteEndpoint,
          scrt2URL: config.scrt2URL
        }));
        ESWMenu.showToast("Loading configuration: " + config.name, "success");
        setTimeout(function () { location.reload(); }, 800);
      } catch (e) {
        ESWMenu.showToast("Failed to load configuration", "error");
      }
    },

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

    /* Parse a pasted code snippet and populate the four individual fields.
     *
     * Accepts either:
     *   - The full <script> block from the ESW Code Snippets page, or
     *   - Just the embeddedservice_bootstrap.init(...) call.
     *
     * The init() call always has this positional signature:
     *   embeddedservice_bootstrap.init(
     *     '<orgId>',
     *     '<deploymentName>',
     *     '<siteEndpoint>',
     *     { scrt2URL: '<scrt2URL>' }
     *   );
     */
    _parseSnippet: function () {
      const raw    = (document.getElementById("eswDeploySnippet").value || "");
      const status = document.getElementById("eswSnippetStatus");

      if (!raw.trim()) {
        status.textContent = "";
        return;
      }

      // Extract the argument list inside embeddedservice_bootstrap.init( ... )
      // Use a regex that captures everything between the opening ( and the matching )
      // We look for the init call, then grab up to the closing )
      const initMatch = raw.match(/embeddedservice_bootstrap\s*\.\s*init\s*\(([\s\S]*?)\)\s*;/);
      if (!initMatch) {
        status.style.color = "#c23934";
        status.textContent = "Could not find embeddedservice_bootstrap.init(...) in the pasted text.";
        return;
      }

      const args = initMatch[1]; // everything between the outer ( and )

      // Pull out all single- or double-quoted string values in order
      const strings = [];
      const strRe = /['"]([^'"]+)['"]/g;
      let m;
      while ((m = strRe.exec(args)) !== null) {
        strings.push(m[1]);
      }

      // Expected order: orgId, deploymentName, siteEndpoint, scrt2URL
      // The scrt2URL is inside the options object { scrt2URL: '...' } but still
      // the 4th quoted string encountered when reading left-to-right.
      if (strings.length < 4) {
        status.style.color = "#c23934";
        status.textContent = "Parsed " + strings.length + " of 4 expected values. Check the snippet and try again.";
        return;
      }

      const orgId          = strings[0];
      const deploymentName = strings[1];
      const siteEndpoint   = strings[2];
      const scrt2URL       = strings[3];

      // Basic sanity checks
      if (!/^[a-zA-Z0-9]{15}$/.test(orgId)) {
        status.style.color = "#c23934";
        status.textContent = "Org ID \"" + orgId + "\" doesn't look like a 15-character Salesforce ID. Check the snippet.";
        return;
      }
      try { new URL(siteEndpoint); } catch (e) {
        status.style.color = "#c23934";
        status.textContent = "Site Endpoint \"" + siteEndpoint + "\" is not a valid URL.";
        return;
      }
      try { new URL(scrt2URL); } catch (e) {
        status.style.color = "#c23934";
        status.textContent = "SCRT2 URL \"" + scrt2URL + "\" is not a valid URL.";
        return;
      }

      // Populate the individual fields
      document.getElementById("eswDeployOrgId").value        = orgId;
      document.getElementById("eswDeployApiName").value      = deploymentName;
      document.getElementById("eswDeploySiteEndpoint").value = siteEndpoint;
      document.getElementById("eswDeployScrt2").value        = scrt2URL;

      status.style.color = "#2e844a";
      status.textContent = "✓ All 4 values parsed successfully. Review below, then click Update.";
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

      // Check if user wants to save this configuration
      const saveCheckbox = document.getElementById("eswSaveConfigCheckbox");
      if (saveCheckbox && saveCheckbox.checked) {
        const name = (document.getElementById("eswConfigName").value || "").trim();
        const instance = (document.getElementById("eswConfigInstance").value || "").trim();
        const instanceType = document.getElementById("eswConfigInstanceType").value;
        const clientType = document.getElementById("eswConfigClientType").value;

        if (!name || !instance || !instanceType || !clientType) {
          ESWMenu.showToast("Please fill in all configuration metadata fields", "error");
          return;
        }

        // Show instructions for saving to GitHub
        ESWMenu._showSaveConfigInstructions({
          orgId: orgId,
          deploymentName: deploymentName,
          siteEndpoint: siteEndpoint,
          scrt2URL: scrt2URL,
          name: name,
          instance: instance,
          instanceType: instanceType,
          clientType: clientType
        });
        return; // Don't reload yet, let user save to GitHub first
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

    /* Show instructions for saving configuration to GitHub */
    _showSaveConfigInstructions: function (config) {
      const configJson = JSON.stringify(config, null, 2);

      // Save to localStorage as backup
      try {
        const localConfigs = localStorage.getItem("eswLocalConfigs");
        let configs = localConfigs ? JSON.parse(localConfigs) : [];

        // Check if config already exists by name
        const existingIndex = configs.findIndex(function (c) { return c.name === config.name; });
        if (existingIndex >= 0) {
          configs[existingIndex] = config;
        } else {
          configs.push(config);
        }

        localStorage.setItem("eswLocalConfigs", JSON.stringify(configs));
        ESWMenu.showToast("Configuration saved locally", "success");
      } catch (e) {
        console.error("Failed to save to localStorage:", e);
      }

      // Create modal for instructions
      const modal = document.createElement("div");
      modal.id = "eswSaveConfigModal";
      modal.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        "right:0",
        "bottom:0",
        "background:rgba(0,0,0,0.8)",
        "z-index:10000",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "padding:2rem"
      ].join(";");

      const modalContent = document.createElement("div");
      modalContent.style.cssText = [
        "background:#0d0d14",
        "border:1px solid rgba(255,255,255,0.2)",
        "border-radius:8px",
        "padding:2rem",
        "max-width:700px",
        "width:100%",
        "max-height:80vh",
        "overflow-y:auto",
        "color:#e8e8f0",
        "font-family:'Inter','Segoe UI',sans-serif"
      ].join(";");

      modalContent.innerHTML = `
        <h2 style="margin-top:0;color:#fff;font-size:1.25rem;">Save Configuration to GitHub</h2>
        <p style="color:#c0c0d8;font-size:0.875rem;line-height:1.6;">
          To make this configuration available to all users, follow these steps:
        </p>
        <ol style="color:#c0c0d8;font-size:0.875rem;line-height:1.8;padding-left:1.5rem;">
          <li>Copy the JSON configuration below</li>
          <li>Open <a href="https://github.com/pchungesw/pchungesw.github.io/blob/main/deployment-configs.json" target="_blank" style="color:#a070f0;">deployment-configs.json</a> in GitHub</li>
          <li>Click "Edit" (pencil icon)</li>
          <li>Add this configuration to the <code style="background:rgba(255,255,255,0.08);padding:0.1em 0.3em;border-radius:3px;color:#c8a0ff;">configurations</code> array</li>
          <li>Commit the changes</li>
          <li>Click "Continue" below to reload with this configuration</li>
        </ol>
        <div style="margin:1rem 0;">
          <label style="display:block;font-weight:600;margin-bottom:0.5rem;font-size:0.875rem;">Configuration JSON:</label>
          <textarea id="eswConfigJsonOutput" readonly
                    style="width:100%;height:200px;padding:0.75rem;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.12);border-radius:6px;font-family:'Courier New',monospace;font-size:0.75rem;color:#e8e8f0;resize:vertical;box-sizing:border-box;">${configJson}</textarea>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:1.5rem;">
          <button onclick="ESWMenu._copyConfigJson()" class="btn-brand" style="background:linear-gradient(135deg,#7b2ff7,#5a1bc2);border:none;border-radius:6px;color:#fff;font-family:'Inter','Segoe UI',sans-serif;font-size:0.875rem;font-weight:600;padding:0.5rem 1.25rem;cursor:pointer;">
            Copy JSON
          </button>
          <button onclick="ESWMenu._continueAfterSave()" class="btn-brand" style="background:linear-gradient(135deg,#7b2ff7,#5a1bc2);border:none;border-radius:6px;color:#fff;font-family:'Inter','Segoe UI',sans-serif;font-size:0.875rem;font-weight:600;padding:0.5rem 1.25rem;cursor:pointer;">
            Continue
          </button>
          <button onclick="ESWMenu._closeSaveConfigModal()" class="btn-neutral" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.14);border-radius:6px;color:#c8c8e0;font-family:'Inter','Segoe UI',sans-serif;font-size:0.875rem;padding:0.5rem 1.25rem;cursor:pointer;">
            Cancel
          </button>
        </div>
      `;

      modal.appendChild(modalContent);
      document.body.appendChild(modal);
    },

    /* Copy configuration JSON to clipboard */
    _copyConfigJson: function () {
      const textarea = document.getElementById("eswConfigJsonOutput");
      if (textarea) {
        textarea.select();
        document.execCommand("copy");
        ESWMenu.showToast("Configuration JSON copied to clipboard", "success");
      }
    },

    /* Continue after saving configuration */
    _continueAfterSave: function () {
      ESWMenu._closeSaveConfigModal();

      // Get the config from the form and apply it
      const orgId = document.getElementById("eswDeployOrgId").value.trim();
      const deploymentName = document.getElementById("eswDeployApiName").value.trim();
      const siteEndpoint = document.getElementById("eswDeploySiteEndpoint").value.trim();
      const scrt2URL = document.getElementById("eswDeployScrt2").value.trim();

      try {
        sessionStorage.setItem("eswDeployOverride", JSON.stringify({
          orgId: orgId,
          deploymentName: deploymentName,
          siteEndpoint: siteEndpoint,
          scrt2URL: scrt2URL
        }));
      } catch (e) { /* ignore */ }

      ESWMenu.showToast("Reloading with new deployment settings…", "info");
      setTimeout(function () { location.reload(); }, 800);
    },

    /* Close save config modal */
    _closeSaveConfigModal: function () {
      const modal = document.getElementById("eswSaveConfigModal");
      if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
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
      const lbl = document.getElementById("eswChatBtnLabel");
      if (lbl) lbl.textContent = isChecked ? "Visible" : "Hidden";
      if (typeof embeddedservice_bootstrap !== "undefined" && embeddedservice_bootstrap.utilAPI) {
        const method = isChecked ? "showChatButton" : "hideChatButton";
        try {
          const result = embeddedservice_bootstrap.utilAPI[method]();
          if (result && typeof result.then === "function") {
            result
              .then(function () { ESWMenu.showToast(isChecked ? "Chat button visible" : "Chat button hidden", "success"); })
              .catch(function () {
                ESWMenu.showToast("Unable to " + (isChecked ? "show" : "hide") + " chat button", "error");
                document.getElementById("eswChatButtonToggle").checked = !isChecked;
                if (lbl) lbl.textContent = !isChecked ? "Visible" : "Hidden";
              });
          } else {
            ESWMenu.showToast(isChecked ? "Chat button visible" : "Chat button hidden", "success");
          }
        } catch (e) {
          ESWMenu.showToast("Unable to " + (isChecked ? "show" : "hide") + " chat button", "error");
          document.getElementById("eswChatButtonToggle").checked = !isChecked;
          if (lbl) lbl.textContent = !isChecked ? "Visible" : "Hidden";
        }
      } else {
        ESWMenu.showToast("Chat is not ready yet", "info");
        document.getElementById("eswChatButtonToggle").checked = !isChecked;
        if (lbl) lbl.textContent = !isChecked ? "Visible" : "Hidden";
      }
    },

    /* ── Hidden Pre-chat ────────────────────────────────────────────────── */

    HIDDEN_PRECHAT_KEY: "eswHiddenPrechatSettings",

    _toggleRoutingDirection: function () {
      const isChecked    = document.getElementById("eswRoutingDirectionToggle").checked;
      const routingValue = isChecked ? "Agent" : "Queue";
      const lbl = document.getElementById("eswRoutingLabel");
      if (lbl) lbl.textContent = routingValue;

      // Persist so it survives page refresh
      try {
        localStorage.setItem(ESWMenu.HIDDEN_PRECHAT_KEY, JSON.stringify({ routingDirection: routingValue }));
      } catch (e) { /* ignore */ }

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
    },

    /**
     * Restore the saved routing direction toggle state into the panel UI.
     * Called from init(). Does NOT call setHiddenPrechatFields — that must
     * happen inside onEmbeddedMessagingReady via applyHiddenPrechatSettings().
     */
    _restoreHiddenPrechatSettings: function () {
      try {
        const saved = localStorage.getItem(ESWMenu.HIDDEN_PRECHAT_KEY);
        if (saved) {
          const s = JSON.parse(saved);
          const toggle = document.getElementById("eswRoutingDirectionToggle");
          const lbl    = document.getElementById("eswRoutingLabel");
          if (toggle && s.routingDirection) {
            toggle.checked = (s.routingDirection === "Agent");
            if (lbl) lbl.textContent = s.routingDirection;
          }
        }
      } catch (e) { /* ignore */ }
    },

    /**
     * Apply the persisted hidden pre-chat settings to the bootstrap API.
     * Call this inside your page's onEmbeddedMessagingReady handler so the
     * saved value is re-applied every time the widget initialises.
     *
     * Usage:
     *   window.addEventListener('onEmbeddedMessagingReady', function () {
     *     ESWMenu.applyHiddenPrechatSettings();
     *     // ... rest of ready handler
     *   });
     */
    applyHiddenPrechatSettings: function () {
      try {
        const saved = localStorage.getItem(ESWMenu.HIDDEN_PRECHAT_KEY);
        const routingValue = saved ? (JSON.parse(saved).routingDirection || "Queue") : "Queue";
        if (typeof embeddedservice_bootstrap !== "undefined" && embeddedservice_bootstrap.prechatAPI) {
          embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields({ routingDirection: routingValue });
        }
      } catch (e) { /* ignore */ }
    },

    /* ── Inline Mode ────────────────────────────────────────────────────── */

    INLINE_MODE_KEY: "eswInlineModeSettings",

    /**
     * Restore saved inline mode settings into the panel toggle controls.
     * Called from init() whenever inlineMode is enabled.
     */
    _restoreInlineModeSettings: function () {
      try {
        const saved = localStorage.getItem(ESWMenu.INLINE_MODE_KEY);
        if (saved) {
          const s = JSON.parse(saved);
          // displayMode: 'shelf' (checked=true) | 'inline' (checked=false)
          const displayToggle = document.getElementById("eswDisplayModeToggle");
          const displayLabel  = document.getElementById("eswDisplayModeLabel");
          if (displayToggle) {
            displayToggle.checked = (s.displayMode === "shelf");
            if (displayLabel) displayLabel.textContent = (s.displayMode === "shelf") ? "Shelf" : "Inline";
          }
          const headerToggle = document.getElementById("eswHeaderEnabledToggle");
          const headerLabel  = document.getElementById("eswHeaderLabel");
          if (headerToggle && s.headerEnabled !== undefined) {
            headerToggle.checked = !!s.headerEnabled;
            if (headerLabel) headerLabel.textContent = s.headerEnabled ? "Enabled" : "Disabled";
          }
        }
      } catch (e) { /* localStorage not available */ }
    },

    /** Update the Display Mode label when the toggle changes. */
    _updateDisplayModeLabel: function () {
      const toggle = document.getElementById("eswDisplayModeToggle");
      const label  = document.getElementById("eswDisplayModeLabel");
      if (toggle && label) {
        label.textContent = toggle.checked ? "Shelf" : "Inline";
      }
    },

    /** Update the Chat Header label when the toggle changes. */
    _updateHeaderLabel: function () {
      const toggle = document.getElementById("eswHeaderEnabledToggle");
      const label  = document.getElementById("eswHeaderLabel");
      if (toggle && label) {
        label.textContent = toggle.checked ? "Enabled" : "Disabled";
      }
    },

    /**
     * Save settings and reload. The page reads these values via
     * ESWMenu.getInlineModeConfig() during its own init.
     */
    _applyInlineModeSettings: function () {
      const displayToggle = document.getElementById("eswDisplayModeToggle");
      const headerToggle  = document.getElementById("eswHeaderEnabledToggle");

      const settings = {
        displayMode:   (displayToggle && displayToggle.checked) ? "shelf" : "inline",
        headerEnabled: (headerToggle  && headerToggle.checked)
      };

      try {
        localStorage.setItem(ESWMenu.INLINE_MODE_KEY, JSON.stringify(settings));
      } catch (e) { /* ignore */ }

      ESWMenu.showToast("Reloading with updated inline mode settings…", "info");
      setTimeout(function () { location.reload(); }, 800);
    },

    /**
     * Called by the page's initEmbeddedMessaging() to get the persisted
     * inline mode settings. Falls back to the provided defaults if nothing
     * is saved.
     *
     * Usage:
     *   const inlineConfig = ESWMenu.getInlineModeConfig({ displayMode: 'shelf', headerEnabled: true });
     *   embeddedservice_bootstrap.settings.displayMode   = inlineConfig.displayMode;
     *   embeddedservice_bootstrap.settings.headerEnabled = inlineConfig.headerEnabled;
     */
    getInlineModeConfig: function (defaults) {
      defaults = defaults || { displayMode: "shelf", headerEnabled: true };
      try {
        const saved = localStorage.getItem(ESWMenu.INLINE_MODE_KEY);
        if (saved) {
          const s = JSON.parse(saved);
          if (s.displayMode) {
            return {
              displayMode:   s.displayMode,
              headerEnabled: (s.headerEnabled !== undefined) ? !!s.headerEnabled : defaults.headerEnabled
            };
          }
        }
      } catch (e) { /* ignore */ }
      return defaults;
    }

  }; // end ESWMenu

  /* Expose globally */
  global.ESWMenu = ESWMenu;

}(window));
