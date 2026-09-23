// Dashboard Component
const DashboardComponent = {
  render(container) {
    const state = window.CRMStore.state;
    
    // Calculate dashboard statistics
    const totalLeads = state.leads.length;
    const totalOpportunities = state.deals.length;
    const pipelineValue = state.deals.reduce((sum, d) => d.stage !== 'Closed Lost' ? sum + d.value : sum, 0);
    
    const syncLogsCount = state.logs.filter(l => l.type === 'sync').length;
    const syncSuccessCount = state.logs.filter(l => l.type === 'sync' && l.status === 'success').length;
    const syncHealth = syncLogsCount > 0 ? Math.round((syncSuccessCount / syncLogsCount) * 100) : 100;

    // Format pipeline value as readable currency
    const formattedPipeline = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(pipelineValue);

    // Calculate details for charts
    // 1. Leads by status count
    const statusCounts = { 
      'Open - Not Contacted': 0, 
      'Working - Contacted': 0, 
      'Closed - Converted': 0, 
      'Closed - Not Converted': 0 
    };
    state.leads.forEach(l => { if (statusCounts[l.status] !== undefined) statusCounts[l.status]++; });

    // 2. Opportunities by stage value
    const stageValues = { Qualification: 0, Proposal: 0, Negotiation: 0, 'Closed Won': 0 };
    state.deals.forEach(d => { if (stageValues[d.stage] !== undefined) stageValues[d.stage] += d.value; });

    // 3. Lead Source breakdown
    const sourceCounts = { Web: 0, Referral: 0, Partner: 0, Other: 0 };
    state.leads.forEach(l => {
      if (sourceCounts[l.source] !== undefined) {
        sourceCounts[l.source]++;
      } else {
        sourceCounts.Other++;
      }
    });

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Total Leads</span>
            <span class="stat-value">${totalLeads}</span>
          </div>
          <div class="stat-icon-wrapper primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Active Deals</span>
            <span class="stat-value">${totalOpportunities}</span>
          </div>
          <div class="stat-icon-wrapper success">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Pipeline Value</span>
            <span class="stat-value">${formattedPipeline}</span>
          </div>
          <div class="stat-icon-wrapper warning">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-info">
            <span class="stat-label">Sync Health</span>
            <span class="stat-value">${syncHealth}%</span>
          </div>
          <div class="stat-icon-wrapper ${syncHealth > 80 ? 'primary' : 'danger'}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          </div>
        </div>
      </div>

      <div class="dashboard-charts-grid">
        <!-- SVG Deal Pipeline Chart -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Deal Pipeline by Stage ($ Value)</h3>
            <span class="column-total">Total Active: ${formattedPipeline}</span>
          </div>
          <div class="card-body">
            <div class="chart-container" id="pipeline-chart-container">
              ${this.createBarChartSVG(stageValues)}
            </div>
          </div>
        </div>

        <!-- Lead Source Breakdown -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Lead Sources</h3>
          </div>
          <div class="card-body">
            <div class="chart-container" id="sources-chart-container" style="height: 180px;">
              ${this.createDoughnutChartSVG(sourceCounts)}
            </div>
            <div style="display: flex; justify-content: center; gap: 16px; margin-top: 16px; font-size: 0.75rem; color: var(--text-secondary);">
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background-color:#2563eb;"></span>Web (${sourceCounts.Web})</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background-color:#10b981;"></span>Referral (${sourceCounts.Referral})</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background-color:#f59e0b;"></span>Partner (${sourceCounts.Partner})</span>
              <span style="display:flex; align-items:center; gap:4px;"><span style="width:10px; height:10px; border-radius:50%; background-color:#94a3b8;"></span>Other (${sourceCounts.Other})</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h3 class="card-title">Recent Activity Audit Log</h3>
          <button class="btn btn-secondary" onclick="window.appRouter('salesforce')" style="padding: 6px 12px; font-size: 0.8rem;">
            View All Integration Logs
          </button>
        </div>
        <div class="card-body">
          <div class="activity-list" id="dashboard-activity-list">
            ${this.renderActivityLogs(state.logs)}
          </div>
        </div>
      </div>
    `;
  },

  createBarChartSVG(values) {
    const keys = Object.keys(values);
    const maxVal = Math.max(...Object.values(values), 50000); // minimum scale peak
    
    let barsHTML = '';
    const chartWidth = 500;
    const chartHeight = 180;
    const padX = 50;
    const padY = 20;
    const colWidth = (chartWidth - padX * 2) / keys.length;

    keys.forEach((key, idx) => {
      const val = values[key];
      const percent = val / maxVal;
      const barHeight = Math.max(percent * (chartHeight - padY * 2), 6); // min height
      const x = padX + idx * colWidth + colWidth * 0.15;
      const y = chartHeight - padY - barHeight;
      const rectWidth = colWidth * 0.7;

      const formattedVal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(val);

      barsHTML += `
        <g class="bar-group" style="cursor: pointer;">
          <!-- Bar Background Hover Box -->
          <rect x="${x - 10}" y="${padY}" width="${rectWidth + 20}" height="${chartHeight - padY * 2 + 10}" fill="transparent" />
          
          <!-- Bar Rect -->
          <rect x="${x}" y="${y}" width="${rectWidth}" height="${barHeight}" rx="4" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5" style="transition: all 0.3s ease;">
            <animate attributeName="height" from="0" to="${barHeight}" dur="0.6s" fill="freeze" />
            <animate attributeName="y" from="${chartHeight - padY}" to="${y}" dur="0.6s" fill="freeze" />
          </rect>
          
          <!-- Value text label -->
          <text x="${x + rectWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#2563eb">${val > 0 ? formattedVal : '$0'}</text>
          
          <!-- Category label -->
          <text x="${x + rectWidth / 2}" y="${chartHeight - 4}" text-anchor="middle" font-size="10" font-weight="500" fill="#64748b">${key}</text>
        </g>
      `;
    });

    return `
      <svg viewBox="0 0 ${chartWidth} ${chartHeight}" style="width: 100%; height: 100%;">
        <!-- Grid horizontal guidelines -->
        <line x1="${padX}" y1="${padY}" x2="${chartWidth - padX}" y2="${padY}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padX}" y1="${(chartHeight - padY * 2) / 2 + padY}" x2="${chartWidth - padX}" y2="${(chartHeight - padY * 2) / 2 + padY}" stroke="#e2e8f0" stroke-dasharray="3,3" />
        <line x1="${padX}" y1="${chartHeight - padY}" x2="${chartWidth - padX}" y2="${chartHeight - padY}" stroke="#cbd5e1" stroke-width="1.5" />
        
        ${barsHTML}
      </svg>
    `;
  },

  createDoughnutChartSVG(counts) {
    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
    if (total === 0) {
      return `
        <svg viewBox="0 0 100 100" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">
          <circle cx="50" cy="50" r="30" fill="none" stroke="#e2e8f0" stroke-width="10" />
          <text x="50" y="54" text-anchor="middle" font-size="6" font-weight="500" fill="#94a3b8">No Leads</text>
        </svg>
      `;
    }

    const segments = [
      { key: 'Web', count: counts.Web, color: '#2563eb' },
      { key: 'Referral', count: counts.Referral, color: '#10b981' },
      { key: 'Partner', count: counts.Partner, color: '#f59e0b' },
      { key: 'Other', count: counts.Other, color: '#94a3b8' }
    ].filter(s => s.count > 0);

    const radius = 35;
    const circ = 2 * Math.PI * radius; // 219.9
    let accumulatedPercent = 0;
    let circlesHTML = '';

    segments.forEach((seg) => {
      const pct = seg.count / total;
      const strokeLength = pct * circ;
      const strokeOffset = circ - strokeLength + (accumulatedPercent * circ);
      
      circlesHTML += `
        <circle cx="50" cy="50" r="${radius}" 
                fill="none" 
                stroke="${seg.color}" 
                stroke-width="10" 
                stroke-dasharray="${strokeLength} ${circ - strokeLength}" 
                stroke-dashoffset="${strokeOffset}" 
                transform="rotate(-90 50 50)" 
                style="transition: all 0.5s ease; stroke-linecap: round;" />
      `;
      accumulatedPercent -= pct; // subtract because offset operates in reverse
    });

    return `
      <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
        <!-- Inner shadow circle -->
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#f1f5f9" stroke-width="10" />
        
        <!-- Render Dash Segments -->
        ${circlesHTML}
        
        <!-- Center Hole text -->
        <circle cx="50" cy="50" r="28" fill="#ffffff" />
        <text x="50" y="47" text-anchor="middle" font-size="8" font-weight="700" fill="#0f172a">${total}</text>
        <text x="50" y="56" text-anchor="middle" font-size="5" font-weight="500" fill="#64748b">Total Leads</text>
      </svg>
    `;
  },

  renderActivityLogs(logs) {
    if (logs.length === 0) {
      return `<div style="text-align:center; padding: 20px; color:var(--text-muted); font-size:0.875rem;">No recent activities logged.</div>`;
    }

    // Display first 4 logs
    return logs.slice(0, 4).map(log => {
      let color = 'var(--primary)';
      if (log.status === 'warning') color = 'var(--warning)';
      if (log.status === 'error') color = 'var(--danger)';
      if (log.type === 'auth') color = '#a855f7'; // Purple for Auth
      if (log.type === 'automation') color = '#06b6d4'; // Cyan for Automation

      const typeIcons = {
        auth: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        sync: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
        automation: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
        local: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
      };

      return `
        <div class="activity-item">
          <div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white;">
            ${typeIcons[log.type] || ''}
          </div>
          <div class="activity-content">
            <span class="activity-text" style="font-weight: 500;">${log.message}</span>
            <span class="activity-time">${log.timestamp} • <span style="text-transform: capitalize; font-weight:600; color:${color};">${log.type}</span></span>
          </div>
        </div>
      `;
    }).join('');
  }
};

window.DashboardComponent = DashboardComponent;
