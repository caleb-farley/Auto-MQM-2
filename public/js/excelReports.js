/**
 * Excel Reports functionality for Auto-MQM
 * Handles downloading, viewing, and managing Excel reports stored in S3
 */

// Download Excel report for a run
async function downloadExcelReport(runId) {
  if (!runId) {
    showNotification('Invalid assessment ID', 'error');
    return;
  }
  
  try {
    // First try to get a signed URL for the report
    const response = await fetch(`/api/runs/${runId}/excel-report`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      // If we got a signed URL, open it in a new tab
      const data = await response.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
        showNotification('Opening Excel report...', 'success');
        return;
      }
    }
    
    // If the report doesn't exist yet or there was an error, download it directly
    window.open(`/api/download-report/${runId}/excel`, '_blank');
    showNotification('Downloading Excel report...', 'success');
  } catch (error) {
    console.error('Error downloading Excel report:', error);
    showNotification('Failed to download Excel report', 'error');
  }
}

// Regenerate Excel report for a run
async function regenerateExcelReport(runId) {
  if (!runId) {
    showNotification('Invalid assessment ID', 'error');
    return;
  }
  
  try {
    showNotification('Regenerating Excel report...', 'info');
    
    // Call the regenerate endpoint
    const response = await fetch(`/api/runs/${runId}/regenerate-excel-report`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      // If successful, download the new report
      window.open(`/api/download-report/${runId}/excel?force=true`, '_blank');
      showNotification('Excel report regenerated successfully', 'success');
    } else {
      throw new Error('Failed to regenerate report');
    }
  } catch (error) {
    console.error('Error regenerating Excel report:', error);
    showNotification('Failed to regenerate Excel report', 'error');
  }
}
