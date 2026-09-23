// Main Application Coordinator & Routing
let currentView = 'dashboard';

window.appRouter = function(viewName) {
  currentView = viewName;
  
  // Update navigation classes
  document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  
  const targetPanel = document.getElementById(`view-${viewName}`);
  if (targetPanel) targetPanel.classList.add('active');
  
  const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (targetNav) targetNav.classList.add('active');
  
  // Update Header Title
  const titles = {
    dashboard: 'CRM Analytics Dashboard',
    leads: 'Customer Leads Directory',
    deals: 'Sales Opportunities Board',
    salesforce: 'Salesforce API Configuration',
    automation: 'Business Workflows Engine',
    docs: 'System Integration & Diagnostics'
  };
  
  const headerTitleEl = document.getElementById('header-view-title');
  if (headerTitleEl) {
    headerTitleEl.innerText = titles[viewName] || 'Customer Relationship Management';
  }
  
  // Render view
  renderCurrentView();
};

function renderCurrentView() {
  const container = document.getElementById(`view-${currentView}`);
  if (!container) return;
  
  // Dispatch render commands to individual views
  if (currentView === 'dashboard' && window.DashboardComponent) {
    window.DashboardComponent.render(container);
  } else if (currentView === 'leads' && window.LeadsComponent) {
    window.LeadsComponent.render(container);
  } else if (currentView === 'deals' && window.DealsComponent) {
    window.DealsComponent.render(container);
  } else if (currentView === 'salesforce' && window.SalesforcePortalComponent) {
    window.SalesforcePortalComponent.render(container);
  } else if (currentView === 'automation' && window.AutomationEngineComponent) {
    window.AutomationEngineComponent.render(container);
  } else if (currentView === 'docs' && window.DocsComponent) {
    window.DocsComponent.render(container);
  }
  
  // Update Salesforce connection indicator in the main header
  updateHeaderSfStatus();
}

function updateHeaderSfStatus() {
  const config = window.CRMStore.state.salesforceConfig;
  const badge = document.getElementById('header-sf-status');
  if (badge) {
    const isConnected = config.connected;
    const isMock = config.mockMode;
    
    badge.className = `sf-status-badge ${isConnected ? (isMock ? 'mocked' : 'connected') : 'disconnected'}`;
    badge.innerHTML = `
      <span class="indicator-dot"></span>
      ${isConnected ? (isMock ? 'Mock Sandbox' : 'Connected') : 'Disconnected'}
    `;
  }
}

// Bind to window load
window.addEventListener('DOMContentLoaded', () => {
  // Subscribe component redrawing to store notifications
  window.CRMStore.subscribe((state) => {
    renderCurrentView();
  });
  
  // Check for Salesforce OAuth Redirect Hash
  if (window.location.hash && window.location.hash.includes('access_token=')) {
    window.CRMStore.handleOAuthRedirect(window.location.hash);
    // Clear the hash for security and clean URL
    window.history.replaceState('', document.title, window.location.pathname + window.location.search);
    window.appRouter('salesforce');
  } else if (window.location.hash && window.location.hash.includes('error=')) {
    window.CRMStore.handleOAuthRedirect(window.location.hash);
    window.history.replaceState('', document.title, window.location.pathname + window.location.search);
    window.appRouter('salesforce');
  } else {
    // Set default view on start
    window.appRouter('dashboard');
  }
});
