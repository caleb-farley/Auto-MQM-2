/**
 * Auto-MQM Analysis Functionality
 * Handles MQM analysis requests and results display
 */

// DOM Elements
const analyzeBtn = document.getElementById('analyze-btn');
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const llmModelSelect = document.getElementById('llm-model');
const resultsContainer = document.getElementById('results-container');
const loadingIndicator = document.getElementById('analysis-loading-indicator');
const translationModeToggle = document.getElementById('translation-mode-toggle');
const applyAllBtn = document.getElementById('apply-all-btn');
const undoBtn = document.getElementById('undo-btn');
const correctedTextContainer = document.getElementById('corrected-text-container');
const correctedTextArea = document.getElementById('corrected-text');

// Store original text and corrections
let originalText = '';
let corrections = [];

/**
 * Run MQM analysis
 */
async function runAnalysis() {
  // Check if in monolingual mode
  const isMonolingual = translationModeToggle.checked;
  console.log('Running assessment in mode:', isMonolingual ? 'monolingual' : 'bilingual');
  
  // Validate inputs
  if (isMonolingual) {
    if (!targetText.value.trim() || !targetLang.value) {
      alert('Please enter target text and select target language');
      return;
    }
  } else {
    if (!sourceText.value.trim() || !targetText.value.trim() || !sourceLang.value || !targetLang.value) {
      alert('Please enter source and target text and select languages');
      return;
    }
  }
  
  // Check word count limit
  const WORD_COUNT_LIMIT = 500;
  
  if (isMonolingual) {
    // For monolingual mode, check target text word count
    const targetWords = targetText.value.trim().split(/\s+/);
    const targetWordCount = targetWords.length > 0 && targetWords[0] !== '' ? targetWords.length : 0;
    
    if (targetWordCount > WORD_COUNT_LIMIT) {
      alert(`Target text exceeds the ${WORD_COUNT_LIMIT} word limit`);
      return;
    }
  } else {
    // For bilingual mode, check source text word count
    const sourceWords = sourceText.value.trim().split(/\s+/);
    const sourceWordCount = sourceWords.length > 0 && sourceWords[0] !== '' ? sourceWords.length : 0;
    
    if (sourceWordCount > WORD_COUNT_LIMIT) {
      alert(`Source text exceeds the ${WORD_COUNT_LIMIT} word limit`);
      return;
    }
  }
  
  // Show loading indicator
  loadingIndicator.style.display = 'flex';
  
  try {
    // For development/testing without backend
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Simulate API call with a delay
      setTimeout(() => {
        const mockResults = getMockResults();
        displayResults(mockResults);
        loadingIndicator.style.display = 'none';
      }, 2000);
      return;
    }
    
    // Prepare request data
    const requestData = {
      sourceText: isMonolingual ? null : sourceText.value,
      targetText: targetText.value,
      sourceLang: isMonolingual ? null : sourceLang.value,
      targetLang: targetLang.value,
      mode: isMonolingual ? 'monolingual' : 'bilingual',
      llmModel: llmModelSelect.value
    };
    
    // Make API request
    const response = await fetch('/api/mqm-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    // Check if response is ok
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze text');
    }
    
    // Parse response
    const results = await response.json();
    
    // Display results
    displayResults(results);
  } catch (error) {
    console.error('Analysis error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
  }
}

/**
 * Display analysis results
 */
function displayResults(results) {
  // Store original text for corrections
  originalText = targetText.value;
  corrections = [];
  
  // Show results container
  resultsContainer.style.display = 'block';
  
  // Create results HTML
  let html = `
    <div class="results-header">
      <h2 class="results-title gothic-title">MQM Analysis Results</h2>
      <div class="score-container">
        <div class="score-label">Overall Score</div>
        <div class="score-value">${results.overallScore.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="summary">
      <p>${results.summary}</p>
    </div>
  `;
  
  // Add categories section if available
  if (results.categories && Object.keys(results.categories).length > 0) {
    html += '<div class="categories">';
    
    for (const [category, stats] of Object.entries(results.categories)) {
      html += `
        <div class="category">
          <h3 class="category-title">${category}</h3>
          <div class="category-stats">
      `;
      
      for (const [subcategory, count] of Object.entries(stats)) {
        html += `
          <div class="stat-item">
            <div class="stat-label">${subcategory}</div>
            <div class="stat-value">${count}</div>
          </div>
        `;
      }
      
      html += '</div></div>';
    }
    
    html += '</div>';
  }
  
  // Add issues section if available
  if (results.mqmIssues && results.mqmIssues.length > 0) {
    html += `
      <div class="issues-header" style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0 15px;">
        <h3 class="gothic-title" style="margin: 0; font-size: 18px;">Issues Found (${results.mqmIssues.length})</h3>
        <div class="issues-actions" style="display: flex; gap: 10px;">
          <button id="apply-all-btn" class="btn btn-primary">Apply All Fixes</button>
          <button id="undo-btn" class="btn btn-secondary">Undo Changes</button>
        </div>
      </div>
      <div class="issues-list">
    `;
    
    // Add each issue
    results.mqmIssues.forEach((issue, index) => {
      html += `
        <div class="issue" data-issue-id="${index}">
          <div class="issue-header">
            <h4 class="issue-title">${issue.category}: ${issue.subcategory}</h4>
            <span class="issue-severity ${issue.severity.toLowerCase()}">${issue.severity}</span>
          </div>
          <div class="issue-content">
            <div class="issue-segment">${issue.segment}</div>
            <div class="issue-explanation">${issue.explanation}</div>
            ${issue.suggestion ? `<div class="issue-suggestion">Suggestion: ${issue.suggestion}</div>` : ''}
          </div>
          <div class="issue-actions">
            ${issue.suggestion ? `<button class="btn btn-primary action-btn apply-fix-btn" data-issue-id="${index}">Apply Fix</button>` : ''}
            <button class="btn btn-secondary action-btn ignore-btn" data-issue-id="${index}">Ignore</button>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    
    // Show apply all button and undo button if there are issues
    applyAllBtn.style.display = 'block';
    undoBtn.style.display = 'block';
  } else {
    html += `
      <div class="no-issues" style="margin-top: 20px; padding: 15px; background-color: var(--bg-success); border-radius: 8px; color: var(--text-primary);">
        <p style="margin: 0;">No issues found! The text appears to be of good quality.</p>
      </div>
    `;
    
    // Hide apply all button and undo button if there are no issues
    applyAllBtn.style.display = 'none';
    undoBtn.style.display = 'none';
  }
  
  // Set results HTML
  resultsContainer.innerHTML = html;
  
  // Add event listeners for issue actions
  document.querySelectorAll('.apply-fix-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const issueId = parseInt(this.getAttribute('data-issue-id'));
      applyFix(results.mqmIssues[issueId]);
    });
  });
  
  document.querySelectorAll('.ignore-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const issueId = parseInt(this.getAttribute('data-issue-id'));
      ignoreIssue(issueId);
    });
  });
  
  // Add event listener for apply all button
  const applyAllButton = document.getElementById('apply-all-btn');
  if (applyAllButton) {
    applyAllButton.addEventListener('click', function() {
      applyAllFixes(results.mqmIssues);
    });
  }
  
  // Add event listener for undo button
  const undoButton = document.getElementById('undo-btn');
  if (undoButton) {
    undoButton.addEventListener('click', function() {
      undoChanges();
    });
  }
  
  // Scroll to results
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Apply fix for a single issue
 */
function applyFix(issue) {
  if (!issue.suggestion) return;
  
  // Store original text if this is the first correction
  if (corrections.length === 0) {
    originalText = targetText.value;
  }
  
  // Add to corrections array
  corrections.push({
    segment: issue.segment,
    suggestion: issue.suggestion
  });
  
  // Apply the fix
  const escapedSegment = window.AutoMQM.Core.escapeRegExp(issue.segment);
  const regex = new RegExp(escapedSegment, 'g');
  targetText.value = targetText.value.replace(regex, issue.suggestion);
  
  // Show corrected text container
  correctedTextContainer.style.display = 'block';
  correctedTextArea.value = targetText.value;
  
  // Update word count
  window.AutoMQM.Core.updateWordCountDisplay();
  
  // Highlight the issue as fixed
  const issueElement = document.querySelector(`.issue[data-issue-id="${issue.id}"]`);
  if (issueElement) {
    issueElement.classList.add('fixed');
    issueElement.querySelector('.apply-fix-btn').disabled = true;
  }
}

/**
 * Apply all fixes
 */
function applyAllFixes(issues) {
  // Store original text if this is the first correction
  if (corrections.length === 0) {
    originalText = targetText.value;
  }
  
  // Clear corrections array
  corrections = [];
  
  // Apply all fixes
  let updatedText = targetText.value;
  
  issues.forEach(issue => {
    if (issue.suggestion) {
      // Add to corrections array
      corrections.push({
        segment: issue.segment,
        suggestion: issue.suggestion
      });
      
      // Apply the fix
      const escapedSegment = window.AutoMQM.Core.escapeRegExp(issue.segment);
      const regex = new RegExp(escapedSegment, 'g');
      updatedText = updatedText.replace(regex, issue.suggestion);
    }
  });
  
  // Update target text
  targetText.value = updatedText;
  
  // Show corrected text container
  correctedTextContainer.style.display = 'block';
  correctedTextArea.value = targetText.value;
  
  // Update word count
  window.AutoMQM.Core.updateWordCountDisplay();
  
  // Highlight all issues as fixed
  document.querySelectorAll('.issue').forEach(issueElement => {
    issueElement.classList.add('fixed');
    const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
    if (applyFixBtn) {
      applyFixBtn.disabled = true;
    }
  });
}

/**
 * Ignore an issue
 */
function ignoreIssue(issueId) {
  const issueElement = document.querySelector(`.issue[data-issue-id="${issueId}"]`);
  if (issueElement) {
    issueElement.classList.add('ignored');
    issueElement.style.opacity = '0.5';
    
    const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
    if (applyFixBtn) {
      applyFixBtn.disabled = true;
    }
    
    const ignoreBtn = issueElement.querySelector('.ignore-btn');
    if (ignoreBtn) {
      ignoreBtn.disabled = true;
    }
  }
}

/**
 * Undo all changes
 */
function undoChanges() {
  if (originalText) {
    targetText.value = originalText;
    correctedTextArea.value = originalText;
    
    // Update word count
    window.AutoMQM.Core.updateWordCountDisplay();
    
    // Reset corrections
    corrections = [];
    
    // Reset issue elements
    document.querySelectorAll('.issue').forEach(issueElement => {
      issueElement.classList.remove('fixed', 'ignored');
      issueElement.style.opacity = '1';
      
      const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
      if (applyFixBtn) {
        applyFixBtn.disabled = false;
      }
      
      const ignoreBtn = issueElement.querySelector('.ignore-btn');
      if (ignoreBtn) {
        ignoreBtn.disabled = false;
      }
    });
  }
}

/**
 * Get mock results for testing
 */
function getMockResults() {
  return {
    mqmIssues: [
      {
        category: 'Accuracy',
        subcategory: 'Mistranslation',
        severity: 'Major',
        segment: 'incorrect translation',
        explanation: 'This segment is incorrectly translated.',
        suggestion: 'correct translation'
      },
      {
        category: 'Fluency',
        subcategory: 'Grammar',
        severity: 'Minor',
        segment: 'grammar error',
        explanation: 'This segment contains a grammar error.',
        suggestion: 'grammatically correct'
      }
    ],
    categories: {
      'Accuracy': {
        'Mistranslation': 1
      },
      'Fluency': {
        'Grammar': 1
      }
    },
    wordCount: 100,
    overallScore: 85.5,
    summary: 'This is a mock summary of the analysis results.'
  };
}

/**
 * Initialize analysis functionality
 */
function init() {
  // Add event listener for analyze button
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', runAnalysis);
  }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for use in other modules
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Analysis = {
  runAnalysis,
  displayResults,
  applyFix,
  applyAllFixes,
  ignoreIssue,
  undoChanges,
  init
};
