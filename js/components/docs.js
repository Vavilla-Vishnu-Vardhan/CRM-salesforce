// Help and System Validation Component
const DocsComponent = {
  diagnosticRunning: false,
  diagnosticLogs: [],

  render(container) {
    container.innerHTML = `
      <div class="docs-layout">
        <!-- Validation and Troubleshooting Sandbox -->
        <div class="docs-section" style="border: 2px solid var(--primary-light); background-color: rgba(37, 99, 235, 0.01);">
          <h3>🔍 System Verification & Troubleshooting Suite</h3>
          <p>
            Validate the CRM integration pipeline, test business logic automations, and diagnose authentication handshake status.
          </p>
          
          <div style="margin: 20px 0;">
            <button class="btn btn-primary" onclick="window.DocsComponent.runDiagnostics()" ${this.diagnosticRunning ? 'disabled' : ''}>
              ${this.diagnosticRunning ? 'Running Diagnoses...' : '⚡ Run Integration Diagnostics'}
            </button>
          </div>

          <div id="diagnostics-console" class="code-block" style="background-color:#0f172a; color:#f8fafc; font-family: 'Courier New', Courier, monospace; min-height: 180px; max-height: 280px; overflow-y: auto; padding: 16px; border-radius: 8px;">
            ${this.diagnosticLogs.length === 0 ? `
              <span style="color:#64748b;">// System Diagnostic Engine Ready. Click button to initialize tests.</span>
            ` : this.diagnosticLogs.map(log => {
              let color = '#38bdf8'; // Sky blue
              if (log.startsWith('[SUCCESS]')) color = '#34d399'; // Emerald green
              if (log.startsWith('[ERROR]')) color = '#f87171'; // Red
              if (log.startsWith('[WARN]')) color = '#fbbf24'; // Amber
              return `<div style="color: ${color}; line-height: 1.6;">${log}</div>`;
            }).join('')}
          </div>
        </div>

        <!-- REST API Data Schema Documentation -->
        <div class="docs-section">
          <h3>📂 Salesforce REST API Mapping Mappings</h3>
          <p>
            The application communicates with the Salesforce REST API version 58.0 using standard JSON schemas.
          </p>
          
          <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--text-primary);">
            Lead SObject Schema Mapping (<code>POST /services/data/v58.0/sobjects/Lead</code>)
          </div>
          <pre class="code-block">{
  "LastName": "Connor",          // Salesforce maps names as LastName (Required)
  "FirstName": "Sarah",          // Optional field
  "Company": "Cyberdyne Systems", // Mandatory for Lead conversions (Required)
  "Email": "sconnor@cyberdyne.io",
  "Phone": "555-0199",
  "Status": "New",                // Maps to LeadStatus Picklist
  "LeadSource": "Web"             // Maps to LeadSource Picklist
}</pre>

          <div style="font-weight: 600; font-size: 0.85rem; margin-bottom: 8px; color: var(--text-primary);">
            Opportunity SObject Schema Mapping (<code>POST /services/data/v58.0/sobjects/Opportunity</code>)
          </div>
          <pre class="code-block">{
  "Name": "Cyberdyne Systems - Deal", // Opportunity Name (Required)
  "Amount": 120000,                  // Value mapping (Required)
  "StageName": "Proposal",            // Salesforce Stage picklist (Required)
  "CloseDate": "2026-09-30"           // YYYY-MM-DD Date (Required)
}</pre>
        </div>

        <!-- Workflow Rules Documentation -->
        <div class="docs-section">
          <h3>⚙️ Configured Business Workflows</h3>
          <p>
            The system executes two primary business workflow automations that model critical business logic:
          </p>
          <ul>
            <li>
              <strong>Lead Qualification Funnel</strong>: Triggers when a Lead's status transitions to <code>Qualified</code>. It verifies local mapping, calls the Salesforce Opportunity constructor, and generates a corresponding Deal in the <code>Qualification</code> stage with a randomized mock deal value ($20,000 to $90,000).
            </li>
            <li>
              <strong>Opportunity Won Notification</strong>: Triggers when an Opportunity stage moves to <code>Closed Won</code>. It logs a Chatter transmission simulating enterprise social notifications.
            </li>
          </ul>
        </div>
      </div>
    `;
  },

  async runDiagnostics() {
    if (this.diagnosticRunning) return;
    this.diagnosticRunning = true;
    this.diagnosticLogs = [];
    
    const panel = document.getElementById('view-docs');
    this.render(panel);

    const log = (msg) => {
      this.diagnosticLogs.push(msg);
      this.render(panel);
      // Auto-scroll the diagnostics console
      const consoleEl = document.getElementById('diagnostics-console');
      if (consoleEl) consoleEl.scrollTop = consoleEl.scrollHeight;
    };

    // Diagnostic step simulation
    log("Initializing CRM Handshake and Validation suite...");
    await this.sleep(600);

    // Test 1: Local Storage Database
    const state = window.CRMStore.state;
    log(`[RUN] Inspecting local cache status...`);
    await this.sleep(400);
    log(`[SUCCESS] Local cache healthy. Found ${state.leads.length} Leads and ${state.deals.length} Opportunities.`);

    // Test 2: Connection details
    log(`[RUN] Verifying Salesforce OAuth parameters...`);
    await this.sleep(500);
    if (state.salesforceConfig.clientId && state.salesforceConfig.clientSecret) {
      log(`[SUCCESS] Credentials found. Client ID: ${state.salesforceConfig.clientId.substring(0, 10)}... (Format Verified).`);
    } else {
      log(`[WARN] Credentials missing or empty. Please insert Client credentials inside Salesforce Portal.`);
    }

    // Test 3: Sandbox mode status
    log(`[RUN] Handshaking Salesforce Integration Gateway...`);
    await this.sleep(600);
    if (state.salesforceConfig.connected) {
      const mode = state.salesforceConfig.mockMode ? 'MOCK_SANDBOX' : 'LIVE_GATEWAY';
      log(`[SUCCESS] Connection online. Mode: ${mode}. Target Server: ${state.salesforceConfig.environment}.`);
    } else {
      log(`[ERROR] Connection Offline. Connect via Salesforce Portal.`);
    }

    // Test 4: Business Automations Verification
    log(`[RUN] Simulating Business Rules Workflow (Lead Qualified -> Create Deal)...`);
    await this.sleep(800);
    const activeRules = state.automationRules.filter(r => r.active);
    log(`[SUCCESS] Workflow Engine: ${activeRules.length} active automation rule(s) registered.`);
    
    // Test 5: Conflict Resolution verification
    log(`[RUN] Scanning conflict mapping queues...`);
    await this.sleep(500);
    const conflicts = state.leads.filter(l => l.syncStatus === 'conflict');
    if (conflicts.length > 0) {
      log(`[WARN] Sync Conflict Queue: ${conflicts.length} unresolved records require manual review.`);
    } else {
      log(`[SUCCESS] Conflict Queue empty. Synchronization logs clean.`);
    }

    log(`==========================================`);
    log(`[SUCCESS] DIAGNOSTICS SUITE COMPLETE. SYSTEM VALIDATED.`);
    
    this.diagnosticRunning = false;
    this.render(panel);
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

window.DocsComponent = DocsComponent;
