// Action Logs Functionality

// DOM Elements - Actions Tab
const actionsTable = document.getElementById('actions-table');
const actionsTbody = document.getElementById('actions-tbody');
const actionPaginationInfo = document.getElementById('action-pagination-info');
const actionPrevPageBtn = document.getElementById('action-prev-page-btn');
const actionNextPageBtn = document.getElementById('action-next-page-btn');
const actionSearchInput = document.getElementById('action-search');
const actionStartDateInput = document.getElementById('action-start-date');
const actionEndDateInput = document.getElementById('action-end-date');
const actionTypeSelect = document.getElementById('action-type');
const applyActionFiltersBtn = document.getElementById('apply-action-filters-btn');
const resetActionFiltersBtn = document.getElementById('reset-action-filters-btn');
const exportActionsCsvBtn = document.getElementById('export-actions-csv-btn');
const actionErrorContainer = document.getElementById('action-error-container');

// Global variables - Actions Tab
let actionCurrentPage = 1;
let actionTotalPages = 1;
let actions = [];
let actionPagination = {};
let actionFilters = {
  search: '',
  startDate: '',
  endDate: '',
  actionType: ''
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabEventListeners();
  setupActionEventListeners();
  // Only fetch actions data if the actions tab is active initially
  if (document.getElementById('actions-tab').classList.contains('active')) {
    fetchActionsData();
  }
});

// Setup Tab Event Listeners
function setupTabEventListeners() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      // Refresh data if needed
      if (tabId === 'actions') {
        fetchActionsData();
      }
    });
  });
}

// Setup Action Event Listeners
function setupActionEventListeners() {
  actionPrevPageBtn.addEventListener('click', () => {
    if (actionCurrentPage > 1) {
      actionCurrentPage--;
      fetchActionsData();
    }
  });

  actionNextPageBtn.addEventListener('click', () => {
    if (actionCurrentPage < actionTotalPages) {
      actionCurrentPage++;
      fetchActionsData();
    }
  });

  applyActionFiltersBtn.addEventListener('click', () => {
    actionFilters.search = actionSearchInput.value.trim();
    actionFilters.startDate = actionStartDateInput.value;
    actionFilters.endDate = actionEndDateInput.value;
    actionFilters.actionType = actionTypeSelect.value;
    actionCurrentPage = 1;
    fetchActionsData();
  });

  resetActionFiltersBtn.addEventListener('click', () => {
    actionSearchInput.value = '';
    actionStartDateInput.value = '';
    actionEndDateInput.value = '';
    actionTypeSelect.value = '';
    actionFilters = {
      search: '',
      startDate: '',
      endDate: '',
      actionType: ''
    };
    actionCurrentPage = 1;
    fetchActionsData();
  });

  exportActionsCsvBtn.addEventListener('click', exportActionsToCsv);
}

// Fetch Actions Data
async function fetchActionsData() {
  try {
    showActionLoading();
    hideActionError();
    
    const queryParams = new URLSearchParams({
      page: actionCurrentPage,
      limit: 20
    });
    
    if (actionFilters.search) queryParams.append('search', actionFilters.search);
    if (actionFilters.startDate) queryParams.append('startDate', actionFilters.startDate);
    if (actionFilters.endDate) queryParams.append('endDate', actionFilters.endDate);
    if (actionFilters.actionType) queryParams.append('actionType', actionFilters.actionType);
    
    const response = await fetch(`/api/admin/actions?${queryParams}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch action logs');
    }
    
    const data = await response.json();
    actions = data.actions;
    actionPagination = data.pagination;
    actionTotalPages = data.pagination.pages;
    
    renderActionsTable(actions);
    updateActionPagination(actionPagination);
  } catch (error) {
    console.error('Error fetching action logs:', error);
    showActionError('Failed to load action logs. Please try again.');
  }
}

// Render Actions Table
function renderActionsTable(actions) {
  if (!actions || actions.length === 0) {
    renderEmptyActionsTable();
    return;
  }
  
  let html = '';
  
  actions.forEach(action => {
    const date = new Date(action.timestamp).toLocaleString();
    const actionType = action.actionType === 'translate' ? 'Translation' : 'QA';
    const actionTypeBadge = `<span class="badge badge-${action.actionType}">${actionType}</span>`;
    
    const languages = action.sourceLang && action.targetLang ? 
      `${action.sourceLang} → ${action.targetLang}` : 
      (action.targetLang || 'N/A');
    
    const engine = action.engineUsed || action.llmModel || 'N/A';
    
    const textLength = action.sourceTextLength && action.targetTextLength ? 
      `${action.sourceTextLength} → ${action.targetTextLength}` : 
      (action.targetTextLength || 'N/A');
    
    const user = action.user ? 
      (action.user.email || 'Registered User') : 
      'Anonymous';
    
    const details = action.run ? 
      `<button class="btn btn-secondary btn-sm" onclick="fetchRunDetails('${action.run}')">View Run</button>` : 
      'N/A';
    
    html += `
      <tr>
        <td>${date}</td>
        <td>${actionTypeBadge}</td>
        <td>${languages}</td>
        <td>${engine}</td>
        <td>${textLength}</td>
        <td>${user}</td>
        <td>${details}</td>
      </tr>
    `;
  });
  
  actionsTbody.innerHTML = html;
}

// Render Empty Actions Table
function renderEmptyActionsTable() {
  actionsTbody.innerHTML = `<tr><td colspan="7" class="empty-table">No action logs found</td></tr>`;
}

// Show Action Loading
function showActionLoading() {
  actionsTbody.innerHTML = `<tr><td colspan="7" class="loading">Loading...</td></tr>`;
}

// Update Action Pagination
function updateActionPagination(pagination) {
  actionPaginationInfo.textContent = `Showing ${pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} entries`;
  
  actionPrevPageBtn.disabled = actionCurrentPage <= 1;
  actionNextPageBtn.disabled = actionCurrentPage >= actionTotalPages;
}

// Show Action Error
function showActionError(message) {
  actionErrorContainer.textContent = message;
  actionErrorContainer.style.display = 'block';
}

// Hide Action Error
function hideActionError() {
  actionErrorContainer.style.display = 'none';
}

// Export Actions to CSV
function exportActionsToCsv() {
  // Get all actions data for export
  fetch('/api/admin/actions?limit=1000')
    .then(response => response.json())
    .then(data => {
      const actions = data.actions;
      
      if (!actions || actions.length === 0) {
        alert('No action logs to export');
        return;
      }
      
      // Prepare CSV content
      let csvContent = 'Date,Action Type,Source Language,Target Language,Engine/Model,Source Length,Target Length,User\n';
      
      actions.forEach(action => {
        const date = new Date(action.timestamp).toLocaleString();
        const actionType = action.actionType === 'translate' ? 'Translation' : 'QA';
        const sourceLang = action.sourceLang || 'N/A';
        const targetLang = action.targetLang || 'N/A';
        const engine = action.engineUsed || action.llmModel || 'N/A';
        const sourceLength = action.sourceTextLength || 'N/A';
        const targetLength = action.targetTextLength || 'N/A';
        const user = action.user ? (action.user.email || 'Registered User') : 'Anonymous';
        
        csvContent += `"${date}","${actionType}","${sourceLang}","${targetLang}","${engine}","${sourceLength}","${targetLength}","${user}"\n`;
      });
      
      // Create download link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `action-logs-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(error => {
      console.error('Error exporting action logs:', error);
      alert('Failed to export action logs. Please try again.');
    });
}
