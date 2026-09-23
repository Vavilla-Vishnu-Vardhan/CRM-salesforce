// Deals Pipeline (Kanban) Component
const DealsComponent = {
  stages: ['Qualification', 'Proposal', 'Negotiation', 'Closed Won'],

  render(container) {
    const state = window.CRMStore.state;
    
    // Group deals by stage
    const groupedDeals = {};
    this.stages.forEach(stage => {
      groupedDeals[stage] = state.deals.filter(d => d.stage === stage);
    });

    let boardHTML = '';

    this.stages.forEach(stage => {
      const deals = groupedDeals[stage] || [];
      const stageTotal = deals.reduce((sum, d) => sum + d.value, 0);
      const formattedTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(stageTotal);

      boardHTML += `
        <div class="kanban-column">
          <div class="column-header">
            <div class="column-title">
              <span>${stage}</span>
              <span class="column-count">${deals.length}</span>
            </div>
            <span class="column-total">${formattedTotal}</span>
          </div>

          <div class="column-cards-container" id="kanban-stage-${stage.replace(/\s+/g, '-')}">
            ${deals.length === 0 ? `
              <div style="text-align: center; border: 2px dashed var(--border-color); border-radius: 8px; padding: 24px; color: var(--text-muted); font-size: 0.775rem;">
                No active deals
              </div>
            ` : deals.map(deal => this.renderDealCard(deal)).join('')}
          </div>
        </div>
      `;
    });

    const sfConfig = state.salesforceConfig;
    let syncMsg = 'Opportunities pipeline offline (disconnected).';
    if (sfConfig.connected) {
      syncMsg = sfConfig.mockMode 
        ? 'Opportunities pipeline synced automatically with Mock Sandbox.' 
        : 'Opportunities pipeline synced automatically with Live Salesforce API.';
    }

    container.innerHTML = `
      <div class="table-actions-bar">
        <div>
          <span style="font-size:0.9rem; color:var(--text-secondary); font-weight:500;">
            ${syncMsg}
          </span>
        </div>
        <div class="action-buttons">
          <button class="btn btn-secondary" onclick="window.CRMStore.importFromSalesforce()" title="Import new/updated records from Salesforce">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Pull from SF
          </button>
          <button class="btn btn-primary" onclick="window.DealsComponent.openAddModal()">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Deal
          </button>
        </div>
      </div>

      <div class="kanban-board">
        ${boardHTML}
      </div>
    `;
  },

  renderDealCard(deal) {
    let syncBadgeColor = 'var(--warning)';
    if (deal.syncStatus === 'synced') syncBadgeColor = 'var(--success)';
    if (deal.syncStatus === 'conflict') syncBadgeColor = 'var(--danger)';

    const formattedVal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(deal.value);

    const currentStageIdx = this.stages.indexOf(deal.stage);
    const canMoveLeft = currentStageIdx > 0;
    const canMoveRight = currentStageIdx < this.stages.length - 1;

    return `
      <div class="deal-card">
        <div class="deal-header">
          <span class="deal-title">${deal.name}</span>
          <span class="deal-value">${formattedVal}</span>
        </div>
        <div class="deal-details">
          <span>🏢 ${deal.company}</span>
          <span>📅 Est. Close: ${deal.closeDate}</span>
          ${deal.salesforceId ? `<span style="font-family: monospace; font-size: 0.7rem; color: var(--text-muted);">☁️ SFID: ${deal.salesforceId}</span>` : '<span style="color:var(--text-muted);">☁️ Local Reference</span>'}
        </div>
        
        <div class="deal-footer">
          <span style="display:flex; align-items:center; gap:4px; font-size:0.675rem; color: var(--text-secondary); text-transform:uppercase; font-weight:600;">
            <span style="width:6px; height:6px; border-radius:50%; background-color:${syncBadgeColor};"></span>
            ${deal.syncStatus}
          </span>
          <div style="display: flex; gap: 4px;">
            ${canMoveLeft ? `
              <button class="deal-stage-btn" onclick="window.DealsComponent.moveDeal('${deal.id}', -1)" title="Move Stage Left">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>
            ` : ''}
            
            <button class="deal-stage-btn" onclick="window.DealsComponent.deleteDeal('${deal.id}')" title="Delete Deal" style="color: var(--danger);">
              🗑️
            </button>
            
            ${canMoveRight ? `
              <button class="deal-stage-btn" onclick="window.DealsComponent.moveDeal('${deal.id}', 1)" title="Move Stage Right">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  moveDeal(id, offset) {
    const deal = window.CRMStore.state.deals.find(d => d.id === id);
    if (!deal) return;

    const currentIdx = this.stages.indexOf(deal.stage);
    const targetIdx = currentIdx + offset;

    if (targetIdx >= 0 && targetIdx < this.stages.length) {
      window.CRMStore.updateDeal(id, { stage: this.stages[targetIdx] });
    }
  },

  deleteDeal(id) {
    if (confirm("Are you sure you want to delete this Opportunity deal?")) {
      window.CRMStore.deleteDeal(id);
    }
  },

  openAddModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('active');
    modalContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Create Deal Opportunity</h3>
          <button class="modal-close" onclick="window.DealsComponent.closeModal()">✕</button>
        </div>
        <form id="add-deal-form" onsubmit="window.DealsComponent.handleAddSubmit(event)">
          <div class="modal-body">
            <div class="form-group">
              <label for="deal-name">Deal Name</label>
              <input type="text" id="deal-name" class="form-control" required placeholder="E.g., Cyberdyne System Integration">
            </div>
            <div class="form-group">
              <label for="deal-company">Company</label>
              <input type="text" id="deal-company" class="form-control" required placeholder="E.g., Cyberdyne Systems">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="deal-value">Deal Value ($)</label>
                <input type="number" id="deal-value" class="form-control" required placeholder="15000" min="0">
              </div>
              <div class="form-group">
                <label for="deal-closedate">Est. Close Date</label>
                <input type="date" id="deal-closedate" class="form-control" required value="${new Date(Date.now() + 30*24*3600*1000).toISOString().split('T')[0]}">
              </div>
            </div>
            <div class="form-group">
              <label for="deal-stage">Pipeline Stage</label>
              <select id="deal-stage" class="form-control">
                <option value="Qualification">Qualification</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.DealsComponent.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Deal</button>
          </div>
        </form>
      </div>
    `;
  },

  handleAddSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('deal-name').value;
    const company = document.getElementById('deal-company').value;
    const value = document.getElementById('deal-value').value;
    const closeDate = document.getElementById('deal-closedate').value;
    const stage = document.getElementById('deal-stage').value;

    window.CRMStore.addDeal({ name, company, value, closeDate, stage });
    this.closeModal();
  },

  closeModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('active');
    modalContainer.innerHTML = '';
  }
};

window.DealsComponent = DealsComponent;
