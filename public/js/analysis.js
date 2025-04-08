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
  // Use core function for analysis
  await window.AutoMQM.Core.runAnalysis();
}

/**
 * Display analysis results
 */
function displayResults(results) {
  originalText = targetText.value;
  corrections = [];
  
  // Use core function for displaying results
  window.AutoMQM.Core.displayResults(results);
  
  // Add event listeners for issue actions
  const applyFixBtns = document.querySelectorAll('.apply-fix-btn');
  const ignoreBtns = document.querySelectorAll('.ignore-btn');
  
  applyFixBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const issueId = parseInt(btn.dataset.issueId);
      applyFix(results.mqmIssues[issueId]);
    });
  });
  
  ignoreBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const issueId = parseInt(btn.dataset.issueId);
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
