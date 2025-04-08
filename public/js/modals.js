/**
 * Auto-MQM Modals Functionality
 * Handles modal interactions, dashboard, and related UI elements
 */

// Global namespace for Auto-MQM
window.AutoMQM = window.AutoMQM || {};

// DOM Elements
let dashboardModal;
let dashboardLink;

/**
 * Initialize modals functionality
 */
function initModals() {
  // Get DOM elements
  dashboardModal = document.getElementById('dashboard-modal');
  dashboardLink = document.getElementById('dashboard-link');
  
  // Add event listeners
  if (dashboardLink) {
    dashboardLink.addEventListener('click', function(e) {
      e.preventDefault();
      showDashboardModal();
    });
  }
  
  // Add event listeners for all modal close buttons
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal-overlay');
      hideModal(modal);
    });
  });
  
  // Close modals when clicking outside
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        hideModal(this);
      }
    });
  });
}

/**
 * Show dashboard modal
 */
function showDashboardModal() {
  hideAllModals();
  if (!dashboardModal) return;
  
  // Check if user is authenticated
  if (!window.AutoMQM.Auth || !window.AutoMQM.Auth.isAuthenticated()) {
    // Show login modal instead
    if (window.AutoMQM.Auth && typeof window.AutoMQM.Auth.showLoginModal === 'function') {
      window.AutoMQM.Auth.showLoginModal();
    }
    return;
  }
  
  // Load dashboard data
  loadDashboardData();
  
  // Show modal
  showModal(dashboardModal);
}

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  if (!dashboardModal) return;
  
  try {
    // Show loading state
    const dashboardContent = dashboardModal.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.innerHTML = '<div class="loading">Loading dashboard data...</div>';
    }
    
    // Get token
    const token = window.AutoMQM.Auth && window.AutoMQM.Auth.getToken ? window.AutoMQM.Auth.getToken() : null;
    
    // Fetch dashboard data
    const response = await fetch('/api/users/dashboard', {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load dashboard data');
    }
    
    const data = await response.json();
    
    // Update dashboard UI
    if (dashboardContent) {
      // Create dashboard HTML
      let html = `
        <h3>Recent Assessments</h3>
        <div class="dashboard-section">
      `;
      
      if (data.recentRuns && data.recentRuns.length > 0) {
        html += `<div class="dashboard-runs">`;
        
        data.recentRuns.forEach(run => {
          html += `
            <div class="dashboard-run-item">
              <div class="run-info">
                <div class="run-date">${AutoMQM.Utils.formatDate(run.createdAt)}</div>
                <div class="run-languages">${run.sourceLang || 'Unknown'} → ${run.targetLang || 'Unknown'}</div>
                <div class="run-mode">${run.isMonolingual ? 'Monolingual' : 'Bilingual'}</div>
              </div>
              <div class="run-actions">
                <button class="btn btn-sm btn-secondary view-run-btn" data-run-id="${run._id}">View</button>
                <button class="btn btn-sm btn-secondary download-excel-btn" data-run-id="${run._id}">Excel</button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      } else {
        html += `<p class="no-data">No recent assessments found.</p>`;
      }
      
      html += `
        </div>
        
        <h3>Usage Statistics</h3>
        <div class="dashboard-section">
          <div class="usage-stats">
            <div class="usage-stat">
              <div class="stat-label">Total Assessments</div>
              <div class="stat-value">${data.stats ? data.stats.totalRuns : 0}</div>
            </div>
            <div class="usage-stat">
              <div class="stat-label">This Month</div>
              <div class="stat-value">${data.stats ? data.stats.monthlyRuns : 0}</div>
            </div>
            <div class="usage-stat">
              <div class="stat-label">Account Type</div>
              <div class="stat-value">${data.user ? (data.user.accountType.charAt(0).toUpperCase() + data.user.accountType.slice(1)) : 'User'}</div>
            </div>
          </div>
        </div>
      `;
      
      // Update dashboard content
      dashboardContent.innerHTML = html;
      
      // Add event listeners for run actions
      dashboardContent.querySelectorAll('.view-run-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const runId = this.getAttribute('data-run-id');
          viewRun(runId);
        });
      });
      
      dashboardContent.querySelectorAll('.download-excel-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const runId = this.getAttribute('data-run-id');
          if (window.AutoMQM.ExcelReports && typeof window.AutoMQM.ExcelReports.downloadExcelReport === 'function') {
            window.AutoMQM.ExcelReports.downloadExcelReport(runId);
          }
        });
      });
    }
  } catch (error) {
    console.error('Dashboard data error:', error);
    
    // Show error in dashboard
    const dashboardContent = dashboardModal.querySelector('.dashboard-content');
    if (dashboardContent) {
      dashboardContent.innerHTML = `<div class="error">Error loading dashboard: ${error.message}</div>`;
    }
  }
}

/**
 * View a specific run
 * @param {string} runId - The ID of the run to view
 */
async function viewRun(runId) {
  if (!runId) return;
  
  try {
    // Show loading state
    AutoMQM.UI.showLoading();
    
    // Get token
    const token = window.AutoMQM.Auth && window.AutoMQM.Auth.getToken ? window.AutoMQM.Auth.getToken() : null;
    
    // Fetch run data
    const response = await fetch(`/api/runs/${runId}`, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load run data');
    }
    
    const data = await response.json();
    
    // Hide dashboard modal
    hideAllModals();
    
    // Populate form with run data
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translationToggle = document.getElementById('translation-mode-toggle');
    
    if (sourceText) sourceText.value = data.sourceText || '';
    if (targetText) targetText.value = data.targetText || '';
    if (sourceLang) sourceLang.value = data.sourceLang || '';
    if (targetLang) targetLang.value = data.targetLang || '';
    
    // Set monolingual mode if applicable
    if (translationToggle && data.isMonolingual) {
      translationToggle.checked = true;
      if (window.AutoMQM.Toggle && typeof window.AutoMQM.Toggle.toggleSourceTextVisibility === 'function') {
        window.AutoMQM.Toggle.toggleSourceTextVisibility(true);
      }
    } else if (translationToggle) {
      translationToggle.checked = false;
      if (window.AutoMQM.Toggle && typeof window.AutoMQM.Toggle.toggleSourceTextVisibility === 'function') {
        window.AutoMQM.Toggle.toggleSourceTextVisibility(false);
      }
    }
    
    // Update word counts
    if (window.AutoMQM.UI && typeof window.AutoMQM.UI.updateWordCountDisplay === 'function') {
      window.AutoMQM.UI.updateWordCountDisplay();
    }
    
    // Update analyze button state
    if (window.AutoMQM.UI && typeof window.AutoMQM.UI.updateAnalyzeButton === 'function') {
      window.AutoMQM.UI.updateAnalyzeButton();
    }
    
    // Display results if available
    if (data.results) {
      // Call the analysis display function if available
      if (window.AutoMQM.Analysis && typeof window.AutoMQM.Analysis.displayResults === 'function') {
        window.AutoMQM.Analysis.displayResults(data.results);
      }
    }
    
    // Hide loading indicator
    AutoMQM.UI.hideLoading();
    
    // Show notification
    AutoMQM.Utils.showNotification('Assessment loaded', 'success');
  } catch (error) {
    console.error('View run error:', error);
    AutoMQM.UI.hideLoading();
    AutoMQM.Utils.showNotification(`Error: ${error.message}`, 'error');
  }
}

/**
 * Show modal helper
 * @param {HTMLElement} modal - The modal to show
 */
function showModal(modal) {
  if (!modal) return;
  
  // Hide all other modals first
  hideAllModals();
  
  // Show the modal
  modal.style.display = 'block';
  
  // Add event listener to close button
  const closeBtn = modal.querySelector('.close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => hideModal(modal));
  }
}

/**
 * Hide modal helper
 * @param {HTMLElement} modal - The modal to hide
 */
function hideModal(modal) {
  if (modal) modal.style.display = 'none';
}

/**
 * Hide all modals
 */
function hideAllModals() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initModals);

// Export functions for use in other modules
window.AutoMQM.Modals = {
  showDashboardModal,
  loadDashboardData,
  viewRun,
  showModal,
  hideModal,
  hideAllModals,
  initModals
};
