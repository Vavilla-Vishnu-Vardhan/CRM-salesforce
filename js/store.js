// Salesforce CRM Store - Local State & Synchronization Logic
const CRMStore = {
  state: {
    leads: [],
    deals: [],
    salesforceConfig: {
      clientId: '',
      redirectUri: 'http://localhost:8000',
      environment: 'sandbox',
      connected: false,
      autoSync: true,
      mockMode: false,
      accessToken: null,
      instanceUrl: null
    },
    automationRules: [
      {
        id: 'rule-1',
        name: 'Auto-Create Deal on Qualification',
        trigger: 'lead_qualified',
        action: 'create_deal',
        active: true,
        desc: 'When a lead status is set to Closed - Converted, automatically create an Opportunity with standard values.'
      },
      {
        id: 'rule-2',
        name: 'Alert Owner on Closed Won',
        trigger: 'deal_won',
        action: 'send_notification',
        active: true,
        desc: 'When a deal is closed won, trigger a welcome notification and sync customer record.'
      }
    ],
    logs: [],
    activeConflict: null // Stores lead or deal ID currently in conflict resolution
  },

  listeners: [],
  _pollTimer: null,
  _isSyncing: false,
  POLL_INTERVAL_MS: 30000, // 30 seconds

  // Subscribe to changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  },

  // Notify listeners
  notify() {
    this.saveToLocalStorage();
    this.listeners.forEach(cb => cb(this.state));
  },

  // Initialize data
  init() {
    const saved = localStorage.getItem('sf_crm_state');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        // Reset and migrate if state was in mock mode
        if (this.state.salesforceConfig.mockMode === undefined || this.state.salesforceConfig.mockMode === true) {
          this.state.salesforceConfig.mockMode = false;
          this.state.leads = [];
          this.state.deals = [];
          this.state.logs = [];
        }
        // Migrate legacy statuses
        if (this.state.leads && Array.isArray(this.state.leads)) {
          this.state.leads.forEach(l => {
            l.status = this.mapSalesforceLeadStatus(l.status);
            if (l.salesforceData) {
              l.salesforceData.status = this.mapSalesforceLeadStatus(l.salesforceData.status);
            }
          });
        }
      } catch (e) {
        console.error("Failed to parse saved state, loading default mock data", e);
        this.loadDefaultData();
      }
    } else {
      this.loadDefaultData();
    }

    // Start auto-sync polling if already connected
    if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
      this.startAutoSync();
    }
  },

  // AUTO-SYNC POLLING
  startAutoSync() {
    this.stopAutoSync(); // clear any existing timer
    if (!this.state.salesforceConfig.connected || !this.state.salesforceConfig.autoSync) return;
    
    this.addLog('sync', 'success', `Auto-sync polling started (every ${this.POLL_INTERVAL_MS / 1000}s)`);
    
    // Do an immediate silent pull
    this.importFromSalesforce(true);
    
    // Then poll on interval
    this._pollTimer = setInterval(() => {
      if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
        this.importFromSalesforce(true);
      } else {
        this.stopAutoSync();
      }
    }, this.POLL_INTERVAL_MS);
  },

  stopAutoSync() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  // Save to LocalStorage
  saveToLocalStorage() {
    localStorage.setItem('sf_crm_state', JSON.stringify(this.state));
  },

  // Generate Salesforce-like 15-character record ID
  generateSfId(prefix) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix; // '00Q' for Lead, '006' for Opportunity
    for (let i = 0; i < 15; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Map Salesforce Lead Status picklist values to local CRM status values
  mapSalesforceLeadStatus(sfStatus) {
    if (!sfStatus) return 'Open - Not Contacted';
    const s = sfStatus.trim();
    if (['Open - Not Contacted', 'Working - Contacted', 'Closed - Converted', 'Closed - Not Converted'].includes(s)) {
      return s;
    }
    const lower = s.toLowerCase();
    if (lower === 'open - not contacted' || lower === 'new' || lower === 'open') return 'Open - Not Contacted';
    if (lower === 'working - contacted' || lower === 'working' || lower === 'contacted' || lower === 'attempted to contact' || lower === 'nurturing') return 'Working - Contacted';
    if (lower === 'closed - converted' || lower === 'qualified' || lower === 'closed') return 'Closed - Converted';
    if (lower === 'closed - not converted' || lower === 'unqualified') return 'Closed - Not Converted';
    return 'Open - Not Contacted';
  },

  loadDefaultData() {
    this.state.leads = [];
    this.state.deals = [];
    this.state.logs = [
      {
        id: 'log-1',
        timestamp: new Date().toLocaleString(),
        type: 'auth',
        status: 'success',
        message: 'Salesforce API connected. Ready for Live Gateway operations.'
      }
    ];
  },

  // Log action helper
  addLog(type, status, message, payload = '') {
    const log = {
      id: 'log-' + Date.now() + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleString(),
      type,
      status,
      message,
      payload: typeof payload === 'object' ? JSON.stringify(payload, null, 2) : payload
    };
    this.state.logs.unshift(log);
    // Keep logs to a reasonable count (e.g. 50)
    if (this.state.logs.length > 50) {
      this.state.logs.pop();
    }
  },

  // LEAD METHODS
  addLead(leadData) {
    const newLead = {
      id: 'lead-' + Date.now(),
      name: leadData.name || '',
      company: leadData.company || '',
      email: leadData.email || '',
      phone: leadData.phone || '',
      status: leadData.status || 'Open - Not Contacted',
      source: leadData.source || 'Web',
      syncStatus: 'pending',
      salesforceId: null,
      lastSync: null,
      salesforceData: null
    };
    this.state.leads.push(newLead);
    this.addLog('local', 'success', `Created local Lead: ${newLead.name} (${newLead.company})`);
    
    // Check Automation Rules for "Lead Created"
    this.triggerAutomation('lead_created', newLead);

    // Notify immediately so the new lead shows up as "pending" in the UI
    this.notify();

    // Auto-sync in the background if configured and connected
    if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
      this.syncLeadToSalesforce(newLead.id);
    }
  },

  updateLead(id, updates) {
    this.state.leads = this.state.leads.map(lead => {
      if (lead.id === id) {
        const originalStatus = lead.status;
        const updatedLead = { ...lead, ...updates };
        
        // If it was previously synced and we edited fields, set to pending
        if (lead.syncStatus === 'synced') {
          updatedLead.syncStatus = 'pending';
        }
        
        this.addLog('local', 'success', `Updated Lead details: ${updatedLead.name}`);
        
        // Check triggers
        if (originalStatus !== updatedLead.status && updatedLead.status === 'Closed - Converted') {
          this.triggerAutomation('lead_qualified', updatedLead);
        }
        
        // Auto sync
        setTimeout(() => {
          if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
            this.syncLeadToSalesforce(updatedLead.id);
          }
        }, 500);

        return updatedLead;
      }
      return lead;
    });
    this.notify();
  },

  deleteLead(id) {
    const lead = this.state.leads.find(l => l.id === id);
    if (lead) {
      this.state.leads = this.state.leads.filter(l => l.id !== id);
      this.addLog('local', 'success', `Deleted local Lead: ${lead.name}`);
      
      if (lead.salesforceId && this.state.salesforceConfig.connected) {
        this._liveDeleteLead(lead.salesforceId, lead.name);
      }
      this.notify();
    }
  },

  async _liveDeleteLead(sfId, name) {
    const { accessToken, instanceUrl } = this.state.salesforceConfig;
    const endpoint = `${instanceUrl}/services/data/v58.0/sobjects/Lead/${sfId}`;
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (response.status === 204 || response.ok) {
        this.addLog('sync', 'success', `[LIVE] Deleted Lead from Salesforce. SFID: ${sfId}`);
      } else {
        const err = await response.json();
        this.addLog('sync', 'error', `[LIVE] Salesforce rejected Lead deletion: ${JSON.stringify(err)}`, err);
      }
    } catch (err) {
      this.addLog('sync', 'error', `[LIVE] Network error deleting Salesforce Lead: ${err.message}`, { error: err.message });
    }
    this.notify();
  },

  // DEAL METHODS
  addDeal(dealData) {
    const newDeal = {
      id: 'deal-' + Date.now(),
      name: dealData.name || '',
      company: dealData.company || '',
      value: Number(dealData.value) || 0,
      stage: dealData.stage || 'Qualification',
      closeDate: dealData.closeDate || new Date(Date.now() + 30*24*3600*1000).toISOString().split('T')[0],
      syncStatus: 'pending',
      salesforceId: null,
      lastSync: null
    };
    this.state.deals.push(newDeal);
    this.addLog('local', 'success', `Created local Deal: ${newDeal.name} ($${newDeal.value})`);
    
    // Notify immediately so the new deal shows up as "pending" in the UI
    this.notify();

    if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
      this.syncDealToSalesforce(newDeal.id);
    }
  },

  updateDeal(id, updates) {
    this.state.deals = this.state.deals.map(deal => {
      if (deal.id === id) {
        const originalStage = deal.stage;
        const updatedDeal = { ...deal, ...updates };
        if (deal.syncStatus === 'synced') {
          updatedDeal.syncStatus = 'pending';
        }
        this.addLog('local', 'success', `Updated Deal stage/details: ${updatedDeal.name} to ${updatedDeal.stage}`);
        
        // Trigger automated action if deal won
        if (originalStage !== updatedDeal.stage && updatedDeal.stage === 'Closed Won') {
          this.triggerAutomation('deal_won', updatedDeal);
        }

        setTimeout(() => {
          if (this.state.salesforceConfig.connected && this.state.salesforceConfig.autoSync) {
            this.syncDealToSalesforce(updatedDeal.id);
          }
        }, 500);

        return updatedDeal;
      }
      return deal;
    });
    this.notify();
  },

  deleteDeal(id) {
    const deal = this.state.deals.find(d => d.id === id);
    if (deal) {
      this.state.deals = this.state.deals.filter(d => d.id !== id);
      this.addLog('local', 'success', `Deleted Deal: ${deal.name}`);
      
      if (deal.salesforceId && this.state.salesforceConfig.connected) {
        this._liveDeleteDeal(deal.salesforceId);
      }
      this.notify();
    }
  },

  async _liveDeleteDeal(sfId) {
    const { accessToken, instanceUrl } = this.state.salesforceConfig;
    const endpoint = `${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${sfId}`;
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (response.status === 204 || response.ok) {
        this.addLog('sync', 'success', `[LIVE] Deleted Opportunity from Salesforce. SFID: ${sfId}`);
      } else {
        const err = await response.json();
        this.addLog('sync', 'error', `[LIVE] Salesforce rejected Opportunity deletion: ${JSON.stringify(err)}`, err);
      }
    } catch (err) {
      this.addLog('sync', 'error', `[LIVE] Network error deleting Salesforce Opportunity: ${err.message}`, { error: err.message });
    }
    this.notify();
  },

  // CONFIGURATION
  connectSalesforce(config) {
    this.state.salesforceConfig = { ...this.state.salesforceConfig, ...config };
    this.state.salesforceConfig.mockMode = false;
    this.authenticateWithSalesforce();
  },

  authenticateWithSalesforce() {
    const cfg = this.state.salesforceConfig;
    const loginBase = cfg.environment === 'sandbox'
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';

    this.addLog('auth', 'warning', `Redirecting to Salesforce for authentication...`);
    this.notify();

    // Redirect to Salesforce Authorization Endpoint
    const authUrl = `${loginBase}/services/oauth2/authorize?response_type=token&client_id=${cfg.clientId}&redirect_uri=${encodeURIComponent(cfg.redirectUri)}`;
    window.location.href = authUrl;
  },

  handleOAuthRedirect(hashParams) {
    const params = new URLSearchParams(hashParams.substring(1));
    const accessToken = params.get('access_token');
    const instanceUrl = params.get('instance_url');
    
    if (accessToken) {
      this.state.salesforceConfig.accessToken = accessToken;
      this.state.salesforceConfig.instanceUrl = instanceUrl;
      this.state.salesforceConfig.connected = true;
      this.state.salesforceConfig.mockMode = false;
      this.addLog('auth', 'success', `Successfully authenticated via Implicit Flow! Instance: ${instanceUrl}`);
      
      // Start auto-sync polling after successful login
      if (this.state.salesforceConfig.autoSync) {
        this.startAutoSync();
      }
    } else {
      const error = params.get('error_description') || params.get('error') || 'Unknown error';
      this.addLog('auth', 'error', `Salesforce Authentication failed: ${error}`);
      setTimeout(() => alert(`Salesforce Login Failed:\n\n${decodeURIComponent(error)}`), 100);
    }
    
    this.notify();
  },

  disconnectSalesforce() {
    this.stopAutoSync();
    this.state.salesforceConfig.connected = false;
    this.state.salesforceConfig.accessToken = null;
    this.state.salesforceConfig.instanceUrl = null;
    this.addLog('auth', 'warning', 'Salesforce API integration disconnected. Auto-sync stopped.');
    this.notify();
  },

  toggleAutoSync(val) {
    this.state.salesforceConfig.autoSync = val;
    this.addLog('local', 'success', `Real-time synchronization turned ${val ? 'ON' : 'OFF'}`);
    if (val && this.state.salesforceConfig.connected) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    this.notify();
  },

  // SYNC ACTION LOGIC
  syncLeadToSalesforce(id) {
    const lead = this.state.leads.find(l => l.id === id);
    if (!lead) return;

    if (!this.state.salesforceConfig.connected) {
      this.addLog('sync', 'error', `Failed to sync Lead: "${lead.name}". Salesforce API disconnected.`, 'NETWORK_ERROR');
      return;
    }

    if (lead.syncStatus === 'conflict') {
      this.addLog('sync', 'warning', `Cannot sync Lead "${lead.name}" due to unresolved conflict.`, lead);
      return;
    }

    this.addLog('sync', 'success', `Initializing sync request for Lead: "${lead.name}"`);
    this._liveSyncLead(lead);
  },

  async _liveSyncLead(lead) {
    const { accessToken, instanceUrl } = this.state.salesforceConfig;
    const isNew = !lead.salesforceId;
    const payload = {
      LastName: lead.name.split(' ').pop() || lead.name,
      FirstName: lead.name.split(' ').slice(0, -1).join(' ') || '',
      Company: lead.company,
      Email: lead.email,
      Phone: lead.phone,
      Status: this.mapSalesforceLeadStatus(lead.status),
      LeadSource: lead.source
    };
    const endpoint = isNew
      ? `${instanceUrl}/services/data/v58.0/sobjects/Lead`
      : `${instanceUrl}/services/data/v58.0/sobjects/Lead/${lead.salesforceId}`;
    try {
      const response = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (response.status === 204 || response.ok) {
        const data = isNew ? await response.json() : {};
        const sfId = isNew ? data.id : lead.salesforceId;
        lead.salesforceId = sfId;
        lead.syncStatus = 'synced';
        lead.lastSync = new Date().toLocaleString();
        lead.salesforceData = { name: lead.name, company: lead.company, email: lead.email, phone: lead.phone, status: this.mapSalesforceLeadStatus(lead.status), source: lead.source };
        this.addLog('sync', 'success', `[LIVE] Lead ${isNew ? 'Created' : 'Updated'} on Salesforce. SFID: ${sfId}`, { endpoint, payload, response: data });
      } else {
        const err = await response.json();
        lead.syncStatus = 'pending';
        
        const errCode = Array.isArray(err) && err[0]?.errorCode;
        if (errCode === 'INVALID_CROSS_REFERENCE_KEY' || errCode === 'INVALID_ID_FIELD' || response.status === 404) {
          lead.salesforceId = null;
          lead.salesforceData = null;
          this.addLog('sync', 'warning', `[LIVE] Invalid/Missing Salesforce ID. Reset ID for "${lead.name}". Sync again to create new.`, err);
        } else {
          this.addLog('sync', 'error', `[LIVE] Salesforce rejected Lead sync: ${JSON.stringify(err)}`, err);
        }
      }
    } catch (err) {
      lead.syncStatus = 'pending';
      this.addLog('sync', 'error', `[LIVE] Network error syncing Lead: ${err.message}`, { error: err.message });
    }
    this.notify();
  },

  syncDealToSalesforce(id) {
    const deal = this.state.deals.find(d => d.id === id);
    if (!deal) return;

    if (!this.state.salesforceConfig.connected) {
      this.addLog('sync', 'error', `Failed to sync Opportunity: "${deal.name}". Salesforce API disconnected.`, 'NETWORK_ERROR');
      return;
    }

    this._liveSyncDeal(deal);
  },

  async _liveSyncDeal(deal) {
    const { accessToken, instanceUrl } = this.state.salesforceConfig;
    const isNew = !deal.salesforceId;
    const payload = {
      Name: deal.name,
      Amount: deal.value,
      StageName: deal.stage,
      CloseDate: deal.closeDate
    };
    const endpoint = isNew
      ? `${instanceUrl}/services/data/v58.0/sobjects/Opportunity`
      : `${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${deal.salesforceId}`;
    try {
      const response = await fetch(endpoint, {
        method: isNew ? 'POST' : 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (response.status === 204 || response.ok) {
        const data = isNew ? await response.json() : {};
        const sfId = isNew ? data.id : deal.salesforceId;
        deal.salesforceId = sfId;
        deal.syncStatus = 'synced';
        deal.lastSync = new Date().toLocaleString();
        this.addLog('sync', 'success', `[LIVE] Opportunity ${isNew ? 'Created' : 'Updated'} on Salesforce. SFID: ${sfId}`, { endpoint, payload, response: data });
      } else {
        const err = await response.json();
        deal.syncStatus = 'pending';
        
        const errCode = Array.isArray(err) && err[0]?.errorCode;
        if (errCode === 'INVALID_CROSS_REFERENCE_KEY' || errCode === 'INVALID_ID_FIELD' || response.status === 404) {
          deal.salesforceId = null;
          this.addLog('sync', 'warning', `[LIVE] Invalid/Missing Salesforce ID. Reset ID for "${deal.name}". Sync again to create new.`, err);
        } else {
          this.addLog('sync', 'error', `[LIVE] Salesforce rejected Opportunity sync: ${JSON.stringify(err)}`, err);
        }
      }
    } catch (err) {
      deal.syncStatus = 'pending';
      this.addLog('sync', 'error', `[LIVE] Network error syncing Opportunity: ${err.message}`, { error: err.message });
    }
    this.notify();
  },

  // CONFLICT RESOLUTION ACTION
  resolveConflict(id, resolutionStrategy, mergedData = null) {
    const lead = this.state.leads.find(l => l.id === id);
    if (!lead) return;

    this.addLog('sync', 'success', `Resolving conflict for Lead: "${lead.name}" using strategy: ${resolutionStrategy}`);

    if (resolutionStrategy === 'keep_local') {
      // Local changes take precedence. Keep local properties, update Salesforce mock data
      lead.salesforceData = {
        name: lead.name,
        company: lead.company,
        email: lead.email,
        phone: lead.phone,
        status: lead.status,
        source: lead.source
      };
      lead.syncStatus = 'pending'; // Queue it to push local version
      this.addLog('sync', 'success', `Selected Local data. Scheduling push to Salesforce.`);
      setTimeout(() => this.syncLeadToSalesforce(id), 500);
    } 
    else if (resolutionStrategy === 'keep_salesforce') {
      // Salesforce data takes precedence. Overwrite local fields with Salesforce-side data
      const sf = lead.salesforceData;
      lead.name = sf.name;
      lead.company = sf.company;
      lead.email = sf.email;
      lead.phone = sf.phone;
      lead.status = sf.status;
      lead.source = sf.source;
      lead.syncStatus = 'synced';
      lead.lastSync = new Date().toLocaleString();
      this.addLog('sync', 'success', `Overwrote local Lead record with Salesforce Cloud data.`);
    } 
    else if (resolutionStrategy === 'merge' && mergedData) {
      // Merge values
      lead.name = mergedData.name;
      lead.company = mergedData.company;
      lead.email = mergedData.email;
      lead.phone = mergedData.phone;
      lead.status = mergedData.status;
      lead.source = mergedData.source;
      
      lead.salesforceData = { ...mergedData };
      lead.syncStatus = 'pending';
      this.addLog('sync', 'success', `Merged records. Scheduling push to Salesforce.`);
      setTimeout(() => this.syncLeadToSalesforce(id), 500);
    }

    this.notify();
  },

  // AUTOMATION TRIGGER ENGINE
  triggerAutomation(triggerType, data) {
    this.state.automationRules.forEach(rule => {
      if (rule.active && rule.trigger === triggerType) {
        this.addLog('automation', 'success', `Automation Triggered: "${rule.name}"`);
        
        if (rule.action === 'create_deal' && triggerType === 'lead_qualified') {
          // Auto create a deal for this qualified lead
          setTimeout(() => {
            const dealValue = Math.floor(Math.random() * 8 + 2) * 10000; // $20k - $90k
            this.addDeal({
              name: `${data.company} - Expansion Deal`,
              company: data.company,
              value: dealValue,
              stage: 'Qualification',
              closeDate: new Date(Date.now() + 60*24*3600*1000).toISOString().split('T')[0]
            });
            this.addLog('automation', 'success', `Executed: Auto-created new Opportunity for "${data.company}" worth $${dealValue}`);
          }, 1000);
        }
        else if (rule.action === 'send_notification' && triggerType === 'deal_won') {
          // Alert trigger
          setTimeout(() => {
            this.addLog('automation', 'success', `Executed: Simulated API Trigger to Salesforce Chatter: "Congratulations team on winning deal ${data.name} ($${data.value})!"`);
          }, 600);
        }
      }
    });
  },

  // Manual trigger: Sync all pending items
  syncAll() {
    this.addLog('sync', 'success', 'Starting bulk synchronization script.');
    let syncedLeadsCount = 0;
    let syncedDealsCount = 0;

    this.state.leads.forEach(lead => {
      if (lead.syncStatus === 'pending') {
        syncedLeadsCount++;
        this.syncLeadToSalesforce(lead.id);
      }
    });

    this.state.deals.forEach(deal => {
      if (deal.syncStatus === 'pending') {
        syncedDealsCount++;
        this.syncDealToSalesforce(deal.id);
      }
    });

    if (syncedLeadsCount === 0 && syncedDealsCount === 0) {
      this.addLog('sync', 'success', 'Bulk sync complete. All local records are already synchronized.');
    }
  },

  async importFromSalesforce(silent = false) {
    // Prevent overlapping syncs
    if (this._isSyncing) return;
    this._isSyncing = true;

    if (!silent) {
      this.addLog('sync', 'success', 'Initializing query pull request from Salesforce...');
    }

    if (!this.state.salesforceConfig.connected) {
      this._isSyncing = false;
      if (!silent) {
        this.addLog('sync', 'error', 'Import failed: Salesforce API disconnected.', 'NETWORK_ERROR');
        alert('Cannot import: Salesforce API is disconnected.');
      }
      return;
    }

    // --- LIVE IMPORT ---
    const { accessToken, instanceUrl } = this.state.salesforceConfig;
    
    // We will query for both Leads and Opportunities
    const leadQuery = encodeURIComponent("SELECT Id, FirstName, LastName, Company, Email, Phone, Status, LeadSource FROM Lead ORDER BY CreatedDate DESC LIMIT 50");
    const dealQuery = encodeURIComponent("SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity ORDER BY CreatedDate DESC LIMIT 50");

    const leadEndpoint = `${instanceUrl}/services/data/v58.0/query/?q=${leadQuery}`;
    const dealEndpoint = `${instanceUrl}/services/data/v58.0/query/?q=${dealQuery}`;

    try {
      let pulledLeadsCount = 0;
      let updatedLeadsCount = 0;
      let pulledDealsCount = 0;
      let updatedDealsCount = 0;

      // 1. Pull Leads
      const leadRes = await fetch(leadEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (leadRes.ok) {
        const leadData = await leadRes.json();
        const sfLeads = leadData.records || [];
        
        sfLeads.forEach(sfLead => {
          let localLeadIdx = this.state.leads.findIndex(l => l.salesforceId === sfLead.Id);
          const fullName = `${sfLead.FirstName || ''} ${sfLead.LastName || ''}`.trim();
          
          // Fuzzy check: if not found by ID, match by email or name for unsynced local records
          if (localLeadIdx === -1) {
            localLeadIdx = this.state.leads.findIndex(l => 
              !l.salesforceId && 
              (l.email.toLowerCase() === (sfLead.Email || '').toLowerCase() || 
               l.name.toLowerCase() === fullName.toLowerCase())
            );
            if (localLeadIdx >= 0) {
              const local = this.state.leads[localLeadIdx];
              local.salesforceId = sfLead.Id; // link them
              this.addLog('sync', 'success', `Linked existing local Lead "${local.name}" to Salesforce Record ID: ${sfLead.Id}`);
            }
          }

          if (localLeadIdx >= 0) {
            // Record exists locally: update it
            const local = this.state.leads[localLeadIdx];
            local.name = fullName;
            local.company = sfLead.Company || '';
            local.email = sfLead.Email || '';
            local.phone = sfLead.Phone || '';
            local.status = this.mapSalesforceLeadStatus(sfLead.Status);
            local.source = sfLead.LeadSource || 'Web';
            local.salesforceData = {
              name: fullName,
              company: sfLead.Company || '',
              email: sfLead.Email || '',
              phone: sfLead.Phone || '',
              status: this.mapSalesforceLeadStatus(sfLead.Status),
              source: sfLead.LeadSource || 'Web'
            };
            local.syncStatus = 'synced';
            local.lastSync = new Date().toLocaleString();
            updatedLeadsCount++;
          } else {
            // New record from Salesforce: insert it locally
            this.state.leads.push({
              id: 'lead-' + Date.now() + Math.random().toString(36).substr(2, 4),
              name: fullName,
              company: sfLead.Company || '',
              email: sfLead.Email || '',
              phone: sfLead.Phone || '',
              status: this.mapSalesforceLeadStatus(sfLead.Status),
              source: sfLead.LeadSource || 'Web',
              syncStatus: 'synced',
              salesforceId: sfLead.Id,
              lastSync: new Date().toLocaleString(),
              salesforceData: {
                name: fullName,
                company: sfLead.Company || '',
                email: sfLead.Email || '',
                phone: sfLead.Phone || '',
                status: this.mapSalesforceLeadStatus(sfLead.Status),
                source: sfLead.LeadSource || 'Web'
              }
            });
            pulledLeadsCount++;
          }
        });
      } else {
        const err = await leadRes.json();
        this.addLog('sync', 'error', `[LIVE] Salesforce Lead Pull Query failed: ${JSON.stringify(err)}`, err);
      }

      // 2. Pull Deals (Opportunities)
      const dealRes = await fetch(dealEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (dealRes.ok) {
        const dealData = await dealRes.json();
        const sfDeals = dealData.records || [];
        
        sfDeals.forEach(sfDeal => {
          let localDealIdx = this.state.deals.findIndex(d => d.salesforceId === sfDeal.Id);
          let mappedStage = sfDeal.StageName;
          // Map standard SF stages to our local stage values if needed
          if (mappedStage === 'ClosedWon') mappedStage = 'Closed Won';
          // Ensure it matches one of our pipeline columns
          if (!['Qualification', 'Proposal', 'Negotiation', 'Closed Won'].includes(mappedStage)) {
            mappedStage = 'Qualification';
          }

          // Fuzzy check: if not found by ID, match by name for unsynced local records
          if (localDealIdx === -1) {
            localDealIdx = this.state.deals.findIndex(d => 
              !d.salesforceId && 
              d.name.toLowerCase() === sfDeal.Name.toLowerCase()
            );
            if (localDealIdx >= 0) {
              const local = this.state.deals[localDealIdx];
              local.salesforceId = sfDeal.Id; // link them
              this.addLog('sync', 'success', `Linked existing local Deal "${local.name}" to Salesforce Opportunity ID: ${sfDeal.Id}`);
            }
          }

          if (localDealIdx >= 0) {
            const local = this.state.deals[localDealIdx];
            local.name = sfDeal.Name;
            local.value = Number(sfDeal.Amount) || 0;
            local.stage = mappedStage;
            local.closeDate = sfDeal.CloseDate || '';
            local.syncStatus = 'synced';
            local.lastSync = new Date().toLocaleString();
            updatedDealsCount++;
          } else {
            this.state.deals.push({
              id: 'deal-' + Date.now() + Math.random().toString(36).substr(2, 4),
              name: sfDeal.Name,
              company: 'Salesforce Imported Account',
              value: Number(sfDeal.Amount) || 0,
              stage: mappedStage,
              closeDate: sfDeal.CloseDate || '',
              syncStatus: 'synced',
              salesforceId: sfDeal.Id,
              lastSync: new Date().toLocaleString()
            });
            pulledDealsCount++;
          }
        });
      } else {
        const err = await dealRes.json();
        this.addLog('sync', 'error', `[LIVE] Salesforce Opportunity Pull Query failed: ${JSON.stringify(err)}`, err);
      }

      const totalChanges = pulledLeadsCount + updatedLeadsCount + pulledDealsCount + updatedDealsCount;
      if (!silent || totalChanges > 0) {
        this.addLog('sync', 'success', `[LIVE] Pull Sync complete! Leads: ${pulledLeadsCount} new, ${updatedLeadsCount} updated. Deals: ${pulledDealsCount} new, ${updatedDealsCount} updated.`);
      }
      this.notify();
      
      if (!silent) {
        alert(`Salesforce Import Complete!\n\nLeads: Imported ${pulledLeadsCount} new records, updated ${updatedLeadsCount} existing.\nDeals: Imported ${pulledDealsCount} new records, updated ${updatedDealsCount} existing.`);
      }
      
    } catch (err) {
      if (!silent) {
        this.addLog('sync', 'error', `[LIVE] Network error during pull sync: ${err.message}`, { error: err.message });
        alert(`Import error: ${err.message}`);
      } else {
        console.warn('[AutoSync] Silent pull error:', err.message);
      }
    } finally {
      this._isSyncing = false;
    }
  }
};

// Initialize Store
CRMStore.init();
window.CRMStore = CRMStore;
