/**
 * Auto-MQM UI Functionality
 * Handles UI interactions, word counts, and other UI-related functionality
 */

// Global namespace for Auto-MQM
window.AutoMQM = window.AutoMQM || {};

// DOM Elements
let sourceText;
let targetText;
let sourceWordCount;
let targetWordCount;
let sourceLang;
let targetLang;
let translateBtn;
let analyzeBtn;
let resetBtn;
let copyBtn;
let applyAllBtn;
let undoBtn;
let excelUploadForm;

/**
 * Initialize UI elements
 */
function initUI() {
  // Get DOM elements
  sourceText = document.getElementById('source-text');
  targetText = document.getElementById('target-text');
  sourceWordCount = document.getElementById('source-word-count');
  targetWordCount = document.getElementById('target-word-count');
  sourceLang = document.getElementById('source-lang');
  targetLang = document.getElementById('target-lang');
  translateBtn = document.getElementById('translate-btn');
  analyzeBtn = document.getElementById('analyze-btn');
  resetBtn = document.getElementById('reset-btn');
  copyBtn = document.getElementById('copy-btn');
  applyAllBtn = document.getElementById('apply-all-btn');
  undoBtn = document.getElementById('undo-btn');
  excelUploadForm = document.getElementById('excel-upload-form');
  
  // Add event listeners
  // Initialize text input handlers
  if (sourceText) {
    sourceText.addEventListener('input', function() {
      window.AutoMQM.Core.updateWordCountDisplay();
      updateAnalyzeButton();
    });
  }
  
  if (targetText) {
    targetText.addEventListener('input', function() {
      window.AutoMQM.Core.updateWordCountDisplay();
      updateAnalyzeButton();
    });
  }
  
  // Listen for translation mode changes
  document.addEventListener('translation-mode-changed', updateAnalyzeButton);
  
  // Initialize word count display
  updateWordCountDisplay();
}

/**
 * Update word count display
 */
function updateWordCountDisplay() {
  if (sourceText && sourceWordCount) {
    const count = AutoMQM.Utils.countWords(sourceText.value);
    sourceWordCount.textContent = `${count} words`;
    
    // Add warning class if over limit
    if (count > 500) {
      sourceWordCount.classList.add('word-count-warning');
    } else {
      sourceWordCount.classList.remove('word-count-warning');
    }
  }
  
  if (targetText && targetWordCount) {
    const count = AutoMQM.Utils.countWords(targetText.value);
    targetWordCount.textContent = `${count} words`;
    
    // Add warning class if over limit
    if (count > 500) {
      targetWordCount.classList.add('word-count-warning');
    } else {
      targetWordCount.classList.remove('word-count-warning');
    }
  }
}

/**
 * Update analyze button state based on form completeness
 */
function updateAnalyzeButton() {
  if (!analyzeBtn) return;
  
  const isMonolingual = document.getElementById('translation-mode-toggle')?.checked;
  
  if (isMonolingual) {
    // For monolingual mode, we only need target text and language
    const isValid = targetText && targetText.value.trim() !== '' && 
                   targetLang && targetLang.value !== '';
    
    analyzeBtn.disabled = !isValid;
  } else {
    // For bilingual mode, we need both source and target text and languages
    const isValid = sourceText && sourceText.value.trim() !== '' && 
                   targetText && targetText.value.trim() !== '' && 
                   sourceLang && sourceLang.value !== '' && 
                   targetLang && targetLang.value !== '';
    
    analyzeBtn.disabled = !isValid;
  }
}

/**
 * Reset the form
 */
function resetForm() {
  if (sourceText) sourceText.value = '';
  if (targetText) targetText.value = '';
  
  // Reset language detection
  const sourceLangDetected = document.getElementById('source-lang-detected');
  const targetLangDetected = document.getElementById('target-lang-detected');
  if (sourceLangDetected) sourceLangDetected.textContent = '';
  if (targetLangDetected) targetLangDetected.textContent = '';
  
  // Reset word counts
  updateWordCountDisplay();
  
  // Hide results container
  const resultsContainer = document.getElementById('results-container');
  if (resultsContainer) resultsContainer.style.display = 'none';
  
  // Hide corrected text container
  const correctedTextContainer = document.getElementById('corrected-text-container');
  if (correctedTextContainer) correctedTextContainer.style.display = 'none';
  
  // Reset buttons
  if (analyzeBtn) analyzeBtn.disabled = true;
  if (applyAllBtn) applyAllBtn.style.display = 'none';
  if (undoBtn) undoBtn.style.display = 'none';
  
  // Clear any error messages
  const errorMessages = document.querySelectorAll('.error-message');
  errorMessages.forEach(el => el.style.display = 'none');
  
  // Show notification
  AutoMQM.Utils.showNotification('Form reset', 'info');
}

/**
 * Show target language error
 * @param {string} message - Error message to display
 */
function showTargetLangError(message) {
  // Find or create error element
  let targetLangError = document.getElementById('target-lang-error');
  
  if (!targetLangError) {
    targetLangError = document.createElement('div');
    targetLangError.id = 'target-lang-error';
    targetLangError.className = 'error-message';
    
    // Find the target language dropdown's parent
    const targetLangParent = targetLang?.parentElement;
    if (targetLangParent) {
      // Insert after the dropdown
      targetLangParent.insertAdjacentElement('afterend', targetLangError);
    }
  }
  
  // Set message and show
  targetLangError.textContent = message;
  targetLangError.style.display = 'block';
  
  // Highlight the dropdown
  if (targetLang) {
    targetLang.classList.add('input-error');
    
    // Remove error class after 5 seconds
    setTimeout(() => {
      targetLang.classList.remove('input-error');
      targetLangError.style.display = 'none';
    }, 5000);
  }
}

/**
 * Show loading indicator
 */
function showLoading() {
  const loadingIndicator = document.getElementById('analysis-loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'flex';
  }
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  const loadingIndicator = document.getElementById('analysis-loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
  }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initUI);

// Export functions for use in other modules
window.AutoMQM.UI = {
  updateWordCountDisplay,
  updateAnalyzeButton,
  resetForm,
  showTargetLangError,
  showLoading,
  hideLoading,
  initUI
};
