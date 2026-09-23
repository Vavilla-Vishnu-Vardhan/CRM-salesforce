// Salesforce Portal Component
const SalesforcePortalComponent = {
  selectedLogPayload: null,

  render(container) {
    const state = window.CRMStore.state;
    const config = state.salesforceConfig;

    // Check if there are active conflicts
    const conflictLeads = state.leads.filter(l => l.syncStatus === 'conflict');

    let conflictSectionHTML = '';
    if (conflictLeads.length > 0) {
      conflictSectionHTML = `
        <div class="card" style="border-color: var(--warning); margin-bottom: 24px;">
          <div class="card-header" style="background-color: var(--warning-light); color: var(--warning);">
            <h3 class="card-title" style="color: #b45309; display: flex; align-items: center; gap: 8px;">
              ⚠️ Synchronization Conflict Alert
            </h3>
            <span class="badge badge-sync-conflict">${conflictLeads.length} Unresolved</span>
          </div>
          <div class="card-body">
            <p style="font-size:0.875rem; margin-bottom: 16px;">
              Mismatched modifications were detected in Salesforce. Click below to resolve conflicts side-by-side.
            </p>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${conflictLeads.map(lead => `
                <div style="display:flex; justify-content:space-between; align-items:center; border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 8px;">
                  <div>
                    <strong style="font-size:0.9rem;">Lead: ${lead.name} (${lead.company})</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted);">Record ID: ${lead.salesforceId || 'Unknown'}</div>
                  </div>
                  <button class="btn btn-primary" style="background-color: var(--warning); color: white;" onclick="window.SalesforcePortalComponent.openConflictResolver('${lead.id}')">
                    Resolve Conflict
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      ${conflictSectionHTML}

      <div class="sf-portal-grid">
        <!-- Configuration Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Integration Parameters</h3>
            <span class="sf-status-badge ${config.connected ? 'connected' : 'disconnected'}">
              <span class="indicator-dot"></span>
              ${config.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div class="card-body">
            <form onsubmit="window.SalesforcePortalComponent.handleConnectSubmit(event)">

              <!-- Connected App Credentials (always shown) -->
              <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:10px;">Connected App OAuth Credentials</div>
              <div class="form-group">
                <label for="sf-client-id">Consumer Key (Client ID)</label>
                <input type="text" id="sf-client-id" class="form-control" value="${config.clientId}" required placeholder="3MVG9...yourConsumerKey">
              </div>

              <div style="border-top: 1px solid var(--border-color); padding-top: 16px; margin-top: 4px;">
                <div style="font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:10px;">OAuth Settings</div>
                <div class="form-group">
                  <label for="sf-redirect-uri">Callback URL (Redirect URI)</label>
                  <input type="text" id="sf-redirect-uri" class="form-control" value="${config.redirectUri}" required placeholder="http://localhost:8000">
                </div>
                <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 14px; font-size: 0.775rem; color: #075985; margin-bottom: 12px; line-height: 1.6;">
                  ℹ️ <strong>Implicit Login Flow:</strong> When you click authenticate, you will be redirected to the official Salesforce login page. After logging in, you will be brought back here securely.
                </div>
              </div>

              <div class="form-group">
                <label for="sf-env">Target Environment</label>
                <select id="sf-env" class="form-control">
                  <option value="sandbox" ${config.environment === 'sandbox' ? 'selected' : ''}>Developer Sandbox (test.salesforce.com)</option>
                  <option value="production" ${config.environment === 'production' ? 'selected' : ''}>Production (login.salesforce.com)</option>
                </select>
              </div>

              <div class="config-toggle-row">
                <div>
                  <span class="toggle-label">Real-Time Synchronization</span>
                  <div class="toggle-desc">Automatically push additions/edits to Salesforce</div>
                </div>
                <label class="switch">
                  <input type="checkbox" id="sf-auto-sync" ${config.autoSync ? 'checked' : ''} onchange="window.CRMStore.toggleAutoSync(this.checked)">
                  <span class="slider"></span>
                </label>
              </div>

              <div style="margin-top: 20px; display: flex; gap: 12px;">
                ${config.connected ? `
                  <button type="button" class="btn btn-danger" style="flex-grow:1;" onclick="window.CRMStore.disconnectSalesforce()">
                    Disconnect
                  </button>
                ` : `
                  <button type="submit" class="btn btn-primary" style="flex-grow:1;">
                    🔒 Login via Salesforce
                  </button>
                `}
              </div>
            </form>
          </div>
        </div>

        <!-- Sync Activity and Logs Card -->
        <div class="card" style="display:flex; flex-direction:column; max-height: 560px;">
          <div class="card-header">
            <h3 class="card-title">Integration Logs</h3>
            <button class="btn btn-secondary" onclick="window.SalesforcePortalComponent.clearLogs()" style="padding: 4px 10px; font-size: 0.75rem;">
              Clear Logs
            </button>
          </div>
          <div class="card-body" style="overflow-y:auto; flex-grow:1; padding:0;">
            ${state.logs.length === 0 ? `
              <div style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.875rem;">
                No integration transactions logged.
              </div>
            ` : `
              <div style="display:flex; flex-direction:column;">
                ${state.logs.map(log => this.renderLogItem(log)).join('')}
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- Log Payload Viewer (Collapsible) -->
      ${this.selectedLogPayload ? `
        <div class="card" style="margin-top:24px;">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
            <h3 class="card-title">API Transmission JSON Payload</h3>
            <button class="modal-close" onclick="window.SalesforcePortalComponent.closePayloadViewer()">✕</button>
          </div>
          <div class="card-body">
            <pre class="code-block" style="margin-bottom:0; max-height:250px;">${this.selectedLogPayload}</pre>
          </div>
        </div>
      ` : ''}
    `;
  },

  renderLogItem(log) {
    let color = 'var(--primary)';
    if (log.status === 'warning') color = 'var(--warning)';
    if (log.status === 'error') color = 'var(--danger)';
    if (log.type === 'auth') color = '#a855f7';
    if (log.type === 'automation') color = '#06b6d4';

    return `
      <div style="border-bottom: 1px solid var(--border-color); padding: 14px 20px; cursor: pointer; transition: background-color 0.2s ease;" 
           hover-bg 
           onclick="window.SalesforcePortalComponent.viewPayload('${log.id}')"
           title="Click to view raw API payload">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 4px;">
          <span style="font-size:0.875rem; font-weight:600; color:var(--text-primary);">${log.message}</span>
          <span class="badge" style="background-color:${color}; color:white; font-size:0.65rem; text-transform:uppercase;">${log.type}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
          <span>${log.timestamp}</span>
          ${log.payload ? `<span style="text-decoration:underline; font-weight:500;">View Payload</span>` : ''}
        </div>
      </div>
    `;
  },

  handleConnectSubmit(e) {
    e.preventDefault();
    const clientId = document.getElementById('sf-client-id')?.value || '';
    const redirectUri = document.getElementById('sf-redirect-uri')?.value || 'http://localhost:8000';
    const environment = document.getElementById('sf-env').value;

    window.CRMStore.connectSalesforce({ clientId, redirectUri, environment });
  },

  viewPayload(id) {
    const log = window.CRMStore.state.logs.find(l => l.id === id);
    if (log && log.payload) {
      this.selectedLogPayload = log.payload;
    } else {
      this.selectedLogPayload = 'No payload details for this log.';
    }
    // Redraw view
    const panel = document.getElementById('view-salesforce');
    this.render(panel);
  },

  closePayloadViewer() {
    this.selectedLogPayload = null;
    const panel = document.getElementById('view-salesforce');
    this.render(panel);
  },

  clearLogs() {
    window.CRMStore.state.logs = [];
    window.CRMStore.saveToLocalStorage();
    this.selectedLogPayload = null;
    const panel = document.getElementById('view-salesforce');
    this.render(panel);
  },

  // CONFLICT RESOLUTION UI SUB-COMPONENT
  openConflictResolver(leadId) {
    const lead = window.CRMStore.state.leads.find(l => l.id === leadId);
    if (!lead) return;

    const sf = lead.salesforceData || {};
    const local = lead;

    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('active');
    modalContainer.innerHTML = `
      <div class="modal-content" style="max-width: 750px;">
        <div class="modal-header">
          <h3 class="modal-title">Sync Conflict Resolution Center</h3>
          <button class="modal-close" onclick="window.SalesforcePortalComponent.closeModal()">✕</button>
        </div>
        <div class="modal-body">
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 18px;">
            The record was updated on both Salesforce Cloud and the local client. Review the highlighted differences below.
          </p>

          <div class="conflict-split-pane">
            <!-- Local Version -->
            <div class="conflict-pane">
              <div class="conflict-pane-header local">
                💻 Local Client Version
              </div>
              <div class="conflict-pane-body">
                ${this.renderConflictField('Name', local.name, sf.name)}
                ${this.renderConflictField('Company', local.company, sf.company)}
                ${this.renderConflictField('Email', local.email, sf.email)}
                ${this.renderConflictField('Phone', local.phone, sf.phone)}
                ${this.renderConflictField('Status', local.status, sf.status)}
                ${this.renderConflictField('Source', local.source, sf.source)}
              </div>
            </div>

            <!-- Salesforce Cloud Version -->
            <div class="conflict-pane">
              <div class="conflict-pane-header sf">
                ☁️ Salesforce Cloud Version
              </div>
              <div class="conflict-pane-body">
                ${this.renderConflictField('Name', sf.name, local.name)}
                ${this.renderConflictField('Company', sf.company, local.company)}
                ${this.renderConflictField('Email', sf.email, local.email)}
                ${this.renderConflictField('Phone', sf.phone, local.phone)}
                ${this.renderConflictField('Status', sf.status, local.status)}
                ${this.renderConflictField('Source', sf.source, local.source)}
              </div>
            </div>
          </div>

          <!-- Merged Builder Interface -->
          <div class="card" style="border: 1px solid var(--primary-light); background-color: var(--primary-light)/0.05;">
            <div class="card-header" style="padding: 10px 16px;">
              <h4 style="font-size:0.85rem; font-weight:600; color:var(--primary);">Custom Merge Editor</h4>
            </div>
            <div class="card-body" style="padding: 16px;">
              <form id="merge-resolve-form" onsubmit="window.SalesforcePortalComponent.submitCustomMerge(event, '${lead.id}')">
                <div class="form-row">
                  <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="merge-name" class="form-control" value="${local.name}">
                  </div>
                  <div class="form-group">
                    <label>Company</label>
                    <input type="text" id="merge-company" class="form-control" value="${local.company}">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="merge-email" class="form-control" value="${local.email}">
                  </div>
                  <div class="form-group">
                    <label>Phone</label>
                    <input type="text" id="merge-phone" class="form-control" value="${local.phone}">
                  </div>
                </div>
                <div class="form-row">
                  <div class="form-group" style="margin-bottom:0;">
                    <label>Status</label>
                    <select id="merge-status" class="form-control">
                      <option value="Open - Not Contacted" ${local.status === 'Open - Not Contacted' ? 'selected' : ''}>Open - Not Contacted</option>
                      <option value="Working - Contacted" ${local.status === 'Working - Contacted' ? 'selected' : ''}>Working - Contacted</option>
                      <option value="Closed - Converted" ${local.status === 'Closed - Converted' ? 'selected' : ''}>Closed - Converted</option>
                      <option value="Closed - Not Converted" ${local.status === 'Closed - Not Converted' ? 'selected' : ''}>Closed - Not Converted</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>Lead Source</label>
                    <select id="merge-source" class="form-control">
                      <option value="Web" ${local.source === 'Web' ? 'selected' : ''}>Web</option>
                      <option value="Referral" ${local.source === 'Referral' ? 'selected' : ''}>Referral</option>
                      <option value="Partner" ${local.source === 'Partner' ? 'selected' : ''}>Partner</option>
                      <option value="Cold Outreach" ${local.source === 'Cold Outreach' ? 'selected' : ''}>Cold Outreach</option>
                    </select>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div class="modal-footer" style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; gap:10px;">
            <button class="btn btn-secondary" onclick="window.SalesforcePortalComponent.resolve('${lead.id}', 'keep_local')">
              Use Local Version
            </button>
            <button class="btn btn-secondary" onclick="window.SalesforcePortalComponent.resolve('${lead.id}', 'keep_salesforce')">
              Use Salesforce Version
            </button>
          </div>
          <button type="submit" form="merge-resolve-form" class="btn btn-primary">
            Apply Merged Fields
          </button>
        </div>
      </div>
    `;
  },

  renderConflictField(fieldName, thisValue, comparisonValue) {
    const isMismatch = thisValue !== comparisonValue;
    return `
      <div class="conflict-field-row ${isMismatch ? 'mismatch' : ''}">
        <span class="conflict-field-name">${fieldName}</span>
        <span class="conflict-field-val">${thisValue || '<span style="color:var(--text-muted); font-style:italic;">[empty]</span>'}</span>
      </div>
    `;
  },

  resolve(id, strategy) {
    window.CRMStore.resolveConflict(id, strategy);
    this.closeModal();
  },

  submitCustomMerge(e, id) {
    e.preventDefault();
    const mergedData = {
      name: document.getElementById('merge-name').value,
      company: document.getElementById('merge-company').value,
      email: document.getElementById('merge-email').value,
      phone: document.getElementById('merge-phone').value,
      status: document.getElementById('merge-status').value,
      source: document.getElementById('merge-source').value
    };

    window.CRMStore.resolveConflict(id, 'merge', mergedData);
    this.closeModal();
  },

  closeModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('active');
    modalContainer.innerHTML = '';
  }
};

window.SalesforcePortalComponent = SalesforcePortalComponent;
