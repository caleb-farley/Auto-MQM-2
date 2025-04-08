/**
 * Auto-MQM Utility Functions
 * Common helper functions used across the application
 */

// Global namespace for Auto-MQM
window.AutoMQM = window.AutoMQM || {};

/**
 * Show a notification to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, info, warning)
 * @param {number} duration - How long to show the notification in ms
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Create notification container if it doesn't exist
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  // Add to container
  container.appendChild(notification);
  
  // Add close button functionality
  const closeBtn = notification.querySelector('.notification-close');
  closeBtn.addEventListener('click', () => {
    notification.classList.add('notification-hiding');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
  
  // Auto-remove after duration
  setTimeout(() => {
    if (notification.parentNode) {
      notification.classList.add('notification-hiding');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }
  }, duration);
}

/**
 * Copy text to clipboard
 * @param {string} text - The text to copy
 * @returns {Promise<boolean>} - Whether the copy was successful
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand('copy');
      textArea.remove();
      return success;
    }
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
}

/**
 * Format a date string
 * @param {string|Date} dateString - The date to format
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} html - The HTML string to escape
 * @returns {string} - Escaped HTML
 */
function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Check if a string is empty or only whitespace
 * @param {string} str - The string to check
 * @returns {boolean} - Whether the string is empty
 */
function isEmpty(str) {
  return !str || str.trim() === '';
}

/**
 * Count words in a string
 * @param {string} str - The string to count words in
 * @returns {number} - The word count
 */
function countWords(str) {
  if (!str || typeof str !== 'string') return 0;
  return str.trim().split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Escape special characters in regular expressions
 * @param {string} string - The string to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Show loading overlay
 */
function showLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
}

/**
 * Hide loading overlay
 */
function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

/**
 * Detect the language of a text string
 * @param {string} text - The text to detect language for
 * @returns {Promise<string|null>} - The detected language code or null if detection fails
 */
async function detectLanguage(text) {
  if (!text || text.trim().length < 5) return null;
  
  try {
    const response = await fetch('/api/detect-language', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text.trim() })
    });
    
    if (!response.ok) {
      throw new Error('Language detection failed');
    }
    
    const data = await response.json();
    return data.language;
  } catch (error) {
    console.error('Language detection error:', error);
    return null;
  }
}

/**
 * Analyze text using the MQM framework
 * @param {Object} data - The data to analyze
 * @returns {Promise<Object>} - The analysis results
 */
async function analyze(data) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

/**
 * Display analysis results in the UI
 * @param {Object} results - The analysis results to display
 */
function displayResults(results) {
  const resultsContainer = document.getElementById('results-container');
  if (!resultsContainer) return;
  
  resultsContainer.innerHTML = '';
  resultsContainer.style.display = 'block';
  
  // Create results header
  const header = document.createElement('div');
  header.className = 'results-header';
  header.innerHTML = `
    <h3>Analysis Results</h3>
    <p>Found ${results.mqmIssues?.length || 0} issues</p>
  `;
  resultsContainer.appendChild(header);
  
  // Display each issue
  if (results.mqmIssues && results.mqmIssues.length > 0) {
    const issuesList = document.createElement('div');
    issuesList.className = 'issues-list';
    
    results.mqmIssues.forEach((issue, index) => {
      const issueElement = document.createElement('div');
      issueElement.className = 'issue-item';
      issueElement.innerHTML = `
        <div class="issue-header">
          <span class="issue-type">${issue.type}</span>
          <span class="issue-severity">${issue.severity}</span>
        </div>
        <div class="issue-content">
          <p>${issue.description}</p>
          ${issue.suggestion ? `<p class="suggestion">Suggestion: ${issue.suggestion}</p>` : ''}
        </div>
      `;
      issuesList.appendChild(issueElement);
    });
    
    resultsContainer.appendChild(issuesList);
  } else {
    // No issues found
    const noIssues = document.createElement('div');
    noIssues.className = 'no-issues';
    noIssues.textContent = 'No quality issues found.';
    resultsContainer.appendChild(noIssues);
  }
}

// Export utility functions to global namespace
window.AutoMQM.Utils = {
  showNotification,
  copyToClipboard,
  analyze,
  displayResults,
  formatDate,
  escapeHtml,
  debounce,
  isEmpty,
  countWords,
  escapeRegExp,
  showLoading,
  hideLoading,
  detectLanguage
};
