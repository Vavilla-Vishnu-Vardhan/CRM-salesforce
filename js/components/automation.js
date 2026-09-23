// Workflow Automation Engine Component
const AutomationEngineComponent = {
  render(container) {
    const state = window.CRMStore.state;
    const rules = state.automationRules;

    // Filter logs for automation logs
    const autoLogs = state.logs.filter(l => l.type === 'automation');

    container.innerHTML = `
      <div style="margin-bottom: 24px;">
        <span style="font-size:0.9rem; color:var(--text-secondary); font-weight:500;">
          Configure local triggers that automate Salesforce standard workflows and chatter integrations.
        </span>
      </div>

      <div class="automation-rules-list">
        ${rules.map(rule => this.renderRuleItem(rule)).join('')}
      </div>

      <!-- Run History -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Workflow Execution History</h3>
          <span class="badge badge-sync-synced" style="text-transform:uppercase;">Active Engine</span>
        </div>
        <div class="card-body">
          ${autoLogs.length === 0 ? `
            <div style="text-align:center; padding: 30px; color:var(--text-muted); font-size:0.875rem;">
              No workflow executions logged. Try changing a Lead to 'Closed - Converted' to trigger rules.
            </div>
          ` : `
            <div class="activity-list">
              ${autoLogs.map(log => `
                <div class="activity-item">
                  <div style="background-color: #06b6d4; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  </div>
                  <div class="activity-content">
                    <span class="activity-text" style="font-weight: 500;">${log.message}</span>
                    <span class="activity-time">${log.timestamp} • <span style="font-weight:600; color:#06b6d4;">Workflow Run</span></span>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  },

  renderRuleItem(rule) {
    let triggerText = '';
    if (rule.trigger === 'lead_qualified') triggerText = 'Lead Status changes to Closed - Converted';
    if (rule.trigger === 'deal_won') triggerText = 'Opportunity stage changes to Closed Won';
    if (rule.trigger === 'lead_created') triggerText = 'Lead record is created';

    let actionText = '';
    if (rule.action === 'create_deal') actionText = 'Create Opportunity Deal';
    if (rule.action === 'send_notification') actionText = 'Trigger Salesforce Chatter Notification';
    if (rule.action === 'escalate_priority') actionText = 'Escalate Case Priority';

    return `
      <div class="rule-item">
        <div class="rule-info">
          <span class="rule-title">${rule.name}</span>
          <span class="rule-summary">
            IF <span class="pill">${triggerText}</span> THEN <span class="pill">${actionText}</span>
          </span>
          <div style="font-size:0.775rem; color:var(--text-muted); margin-top:6px;">${rule.desc}</div>
        </div>
        <div class="rule-actions">
          <label class="switch">
            <input type="checkbox" ${rule.active ? 'checked' : ''} onchange="window.AutomationEngineComponent.toggleRule('${rule.id}', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `;
  },

  toggleRule(id, val) {
    const rules = window.CRMStore.state.automationRules;
    const rule = rules.find(r => r.id === id);
    if (rule) {
      rule.active = val;
      window.CRMStore.addLog('local', 'success', `Automation rule "${rule.name}" set to ${val ? 'ACTIVE' : 'INACTIVE'}`);
      window.CRMStore.saveToLocalStorage();
      
      // Re-render
      const panel = document.getElementById('view-automation');
      this.render(panel);
    }
  }
};

window.AutomationEngineComponent = AutomationEngineComponent;
