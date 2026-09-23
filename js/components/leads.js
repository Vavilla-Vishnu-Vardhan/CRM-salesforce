// Leads Manager Component
const LeadsComponent = {
  searchQuery: '',
  statusFilter: 'All',

  render(container) {
    const state = window.CRMStore.state;
    
    // Filter and search logic
    const filteredLeads = state.leads.filter(lead => {
      const matchesSearch = 
        lead.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        lead.company.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchesFilter = this.statusFilter === 'All' || lead.status === this.statusFilter;
      
      return matchesSearch && matchesFilter;
    });

    container.innerHTML = `
      <div class="table-actions-bar">
        <div class="search-input-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" class="search-input" id="lead-search-input" placeholder="Search by name, email, company..." value="${this.searchQuery}">
        </div>

        <div style="display: flex; gap: 12px; align-items: center;">
          <select class="form-control" id="lead-status-filter" style="width: 160px; padding: 8px 12px;">
            <option value="All" ${this.statusFilter === 'All' ? 'selected' : ''}>All Statuses</option>
            <option value="Open - Not Contacted" ${this.statusFilter === 'Open - Not Contacted' ? 'selected' : ''}>Open - Not Contacted</option>
            <option value="Working - Contacted" ${this.statusFilter === 'Working - Contacted' ? 'selected' : ''}>Working - Contacted</option>
            <option value="Closed - Converted" ${this.statusFilter === 'Closed - Converted' ? 'selected' : ''}>Closed - Converted</option>
            <option value="Closed - Not Converted" ${this.statusFilter === 'Closed - Not Converted' ? 'selected' : ''}>Closed - Not Converted</option>
          </select>

          <div class="action-buttons">
            <button class="btn btn-secondary" onclick="window.CRMStore.importFromSalesforce()" title="Import new/updated records from Salesforce">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Pull from SF
            </button>
            <button class="btn btn-secondary" onclick="window.CRMStore.syncAll()" title="Push local pending records to Salesforce">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              Sync All
            </button>
            <button class="btn btn-primary" onclick="window.LeadsComponent.openAddModal()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Lead
            </button>
          </div>
        </div>
      </div>

      <div class="table-container">
        <table class="crm-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email / Phone</th>
              <th>Status</th>
              <th>Source</th>
              <th>Salesforce ID</th>
              <th>Sync Status</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredLeads.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 40px;">
                  No leads found matching current query.
                </td>
              </tr>
            ` : filteredLeads.map(lead => this.renderLeadRow(lead)).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Attach Event Listeners
    const searchEl = document.getElementById('lead-search-input');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render(container);
      });
    }

    const filterEl = document.getElementById('lead-status-filter');
    if (filterEl) {
      filterEl.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render(container);
      });
    }
  },

  renderLeadRow(lead) {
    let syncBadgeClass = 'badge-sync-pending';
    if (lead.syncStatus === 'synced') syncBadgeClass = 'badge-sync-synced';
    if (lead.syncStatus === 'conflict') syncBadgeClass = 'badge-sync-conflict';

    let statusBadgeClass = 'badge-lead-new';
    if (lead.status === 'Working - Contacted') statusBadgeClass = 'badge-lead-working';
    else if (lead.status === 'Closed - Converted') statusBadgeClass = 'badge-lead-qualified';
    else if (lead.status === 'Closed - Not Converted') statusBadgeClass = 'badge-lead-unqualified';

    return `
      <tr>
        <td style="font-weight: 600;">${lead.name}</td>
        <td>${lead.company}</td>
        <td>
          <div style="font-weight: 500;">${lead.email}</div>
          <div style="font-size: 0.775rem; color: var(--text-muted);">${lead.phone}</div>
        </td>
        <td><span class="badge ${statusBadgeClass}">${lead.status}</span></td>
        <td>${lead.source}</td>
        <td>
          <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-secondary);">
            ${lead.salesforceId ? `<span title="${lead.salesforceId}">${lead.salesforceId.substring(0, 8)}...</span>` : '<span style="color:var(--text-muted);">Unlinked</span>'}
          </span>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span class="badge ${syncBadgeClass}" style="width:fit-content; text-transform: uppercase;">${lead.syncStatus}</span>
            ${lead.lastSync ? `<span style="font-size:0.675rem; color:var(--text-muted);">Synced: ${lead.lastSync.split(',')[1] || lead.lastSync}</span>` : ''}
          </div>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button class="btn btn-secondary" onclick="window.CRMStore.syncLeadToSalesforce('${lead.id}')" title="Sync with Salesforce" style="padding: 6px 10px; font-size:0.85rem;">
              🔄
            </button>
            <button class="btn btn-secondary" onclick="window.LeadsComponent.openEditModal('${lead.id}')" title="Edit Lead Details" style="padding: 6px 10px; font-size:0.85rem;">
              ✏️
            </button>
            <button class="btn btn-danger" onclick="window.CRMStore.deleteLead('${lead.id}')" title="Delete Lead" style="padding: 6px 10px; background-color: var(--danger-light); color: var(--danger); font-size:0.85rem;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  openAddModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('active');
    modalContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Create New Lead</h3>
          <button class="modal-close" onclick="window.LeadsComponent.closeModal()">✕</button>
        </div>
        <form id="add-lead-form" onsubmit="window.LeadsComponent.handleAddSubmit(event)">
          <div class="modal-body">
            <div class="form-group">
              <label for="lead-name">Full Name</label>
              <input type="text" id="lead-name" class="form-control" required placeholder="E.g., Jane Doe">
            </div>
            <div class="form-group">
              <label for="lead-company">Company</label>
              <input type="text" id="lead-company" class="form-control" required placeholder="E.g., Acme Corp">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="lead-email">Email</label>
                <input type="email" id="lead-email" class="form-control" required placeholder="name@company.com">
              </div>
              <div class="form-group">
                <label for="lead-phone">Phone</label>
                <input type="tel" id="lead-phone" class="form-control" placeholder="555-1234">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="lead-status">Status</label>
                <select id="lead-status" class="form-control">
                  <option value="Open - Not Contacted">Open - Not Contacted</option>
                  <option value="Working - Contacted">Working - Contacted</option>
                  <option value="Closed - Converted">Closed - Converted</option>
                  <option value="Closed - Not Converted">Closed - Not Converted</option>
                </select>
              </div>
              <div class="form-group">
                <label for="lead-source">Lead Source</label>
                <select id="lead-source" class="form-control">
                  <option value="Web">Web</option>
                  <option value="Referral">Referral</option>
                  <option value="Partner">Partner</option>
                  <option value="Cold Outreach">Cold Outreach</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.LeadsComponent.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Lead</button>
          </div>
        </form>
      </div>
    `;
  },

  handleAddSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('lead-name').value;
    const company = document.getElementById('lead-company').value;
    const email = document.getElementById('lead-email').value;
    const phone = document.getElementById('lead-phone').value;
    const status = document.getElementById('lead-status').value;
    const source = document.getElementById('lead-source').value;

    window.CRMStore.addLead({ name, company, email, phone, status, source });
    this.closeModal();
  },

  openEditModal(id) {
    const lead = window.CRMStore.state.leads.find(l => l.id === id);
    if (!lead) return;

    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.add('active');
    modalContainer.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">Edit Lead Details</h3>
          <button class="modal-close" onclick="window.LeadsComponent.closeModal()">✕</button>
        </div>
        <form id="edit-lead-form" onsubmit="window.LeadsComponent.handleEditSubmit(event, '${id}')">
          <div class="modal-body">
            <div class="form-group">
              <label for="lead-name">Full Name</label>
              <input type="text" id="lead-name" class="form-control" required value="${lead.name}">
            </div>
            <div class="form-group">
              <label for="lead-company">Company</label>
              <input type="text" id="lead-company" class="form-control" required value="${lead.company}">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="lead-email">Email</label>
                <input type="email" id="lead-email" class="form-control" required value="${lead.email}">
              </div>
              <div class="form-group">
                <label for="lead-phone">Phone</label>
                <input type="tel" id="lead-phone" class="form-control" value="${lead.phone}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="lead-status">Status</label>
                <select id="lead-status" class="form-control">
                  <option value="Open - Not Contacted" ${lead.status === 'Open - Not Contacted' ? 'selected' : ''}>Open - Not Contacted</option>
                  <option value="Working - Contacted" ${lead.status === 'Working - Contacted' ? 'selected' : ''}>Working - Contacted</option>
                  <option value="Closed - Converted" ${lead.status === 'Closed - Converted' ? 'selected' : ''}>Closed - Converted</option>
                  <option value="Closed - Not Converted" ${lead.status === 'Closed - Not Converted' ? 'selected' : ''}>Closed - Not Converted</option>
                </select>
              </div>
              <div class="form-group">
                <label for="lead-source">Lead Source</label>
                <select id="lead-source" class="form-control">
                  <option value="Web" ${lead.source === 'Web' ? 'selected' : ''}>Web</option>
                  <option value="Referral" ${lead.source === 'Referral' ? 'selected' : ''}>Referral</option>
                  <option value="Partner" ${lead.source === 'Partner' ? 'selected' : ''}>Partner</option>
                  <option value="Cold Outreach" ${lead.source === 'Cold Outreach' ? 'selected' : ''}>Cold Outreach</option>
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" onclick="window.LeadsComponent.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
  },

  handleEditSubmit(e, id) {
    e.preventDefault();
    const name = document.getElementById('lead-name').value;
    const company = document.getElementById('lead-company').value;
    const email = document.getElementById('lead-email').value;
    const phone = document.getElementById('lead-phone').value;
    const status = document.getElementById('lead-status').value;
    const source = document.getElementById('lead-source').value;

    window.CRMStore.updateLead(id, { name, company, email, phone, status, source });
    this.closeModal();
  },

  closeModal() {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.classList.remove('active');
    modalContainer.innerHTML = '';
  }
};

window.LeadsComponent = LeadsComponent;
