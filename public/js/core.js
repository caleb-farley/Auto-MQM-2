/**
 * Auto-MQM Core Functionality
 * Handles the main application logic
 */

// DOM Elements
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const sourceWordCount = document.getElementById('source-word-count');
const targetWordCount = document.getElementById('target-word-count');
const translateBtn = document.getElementById('translate-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const resetBtn = document.getElementById('reset-btn');
const resultsContainer = document.getElementById('results-container');
const textAreasContainer = document.getElementById('text-areas-container');
const translationModeToggle = document.getElementById('translation-mode-toggle');
const llmModelSelect = document.getElementById('llm-model');
const applyAllBtn = document.getElementById('apply-all-btn');
const undoBtn = document.getElementById('und-btn');
const loadingIndicator = document.getElementById('analysis-loading-indicator');

// RTL language codes
const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

/**
 * Check if a language is RTL
 */
function isRTL(langCode) {
  if (!langCode) return false;
  // Check if the language code starts with any RTL language prefix
  return rtlLanguages.some(rtlCode => langCode.startsWith(rtlCode));
}

/**
 * Update text direction based on language
 */
function updateTextDirection() {
  const sourceLanguage = sourceLang.value;
  const targetLanguage = targetLang.value;
  
  // Set text direction based on language (while keeping dir='auto' for automatic detection)
  if (sourceLanguage && isRTL(sourceLanguage)) {
    sourceText.style.textAlign = 'right';
  } else if (sourceLanguage) {
    sourceText.style.textAlign = 'left';
  }
  
  if (targetLanguage && isRTL(targetLanguage)) {
    targetText.style.textAlign = 'right';
  } else if (targetLanguage) {
    targetText.style.textAlign = 'left';
  }
}

/**
 * Toggle source text visibility based on translation mode
 */
function toggleSourceTextVisibility(isMonolingual) {
  // Get references to key elements
  const sourceTextContainer = document.getElementById('source-text-container');
  const targetTextContainer = document.getElementById('target-text-container');
  
  // Check if we're in monolingual mode
  if (isMonolingual) {
    // Add monolingual class to container
    textAreasContainer.classList.add('monolingual-mode');
    
    // Update button states based on mode
    updateAnalyzeButton();
    
    // If the translate button exists, hide it in monolingual mode
    if (translateBtn) {
      translateBtn.style.display = 'none';
    }
    
    // Dispatch a custom event to notify other components about the mode change
    document.dispatchEvent(new CustomEvent('translation-mode-changed', { 
      detail: { mode: 'monolingual' } 
    }));
  } else {
    // Remove monolingual class from container
    textAreasContainer.classList.remove('monolingual-mode');
    
    // Update button states based on mode
    updateAnalyzeButton();
    
    // If the translate button exists, show it in bilingual mode
    if (translateBtn) {
      translateBtn.style.display = 'block';
    }
    
    // Dispatch a custom event to notify other components about the mode change
    document.dispatchEvent(new CustomEvent('translation-mode-changed', { 
      detail: { mode: 'bilingual' } 
    }));
  }
}

/**
 * Update analyze button state based on form completeness
 */
function updateAnalyzeButton() {
  // Check if in monolingual mode
  const isMonolingual = translationModeToggle.checked;
  
  if (isMonolingual) {
    // In monolingual mode, we only need target text and language
    analyzeBtn.disabled = !targetText.value.trim() || !targetLang.value;
  } else {
    // In bilingual mode, we need both source and target text and languages
    analyzeBtn.disabled = !sourceText.value.trim() || !targetText.value.trim() || 
                         !sourceLang.value || !targetLang.value;
  }
}

// Function moved to utils.js

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Text input changes
  sourceText.addEventListener('input', function() {
    window.AutoMQM.Core.updateWordCountDisplay();
  });
  
  targetText.addEventListener('input', function() {
    window.AutoMQM.Core.updateWordCountDisplay();
  });
  
  // Initial word count update
  window.AutoMQM.Core.updateWordCountDisplay();
  
  // Listen for translation mode changes
  document.addEventListener('translation-mode-changed', updateAnalyzeButton);
}

/**
 * Initialize the application
 */
function init() {
  // Set initial visibility based on translation mode toggle
  toggleSourceTextVisibility(translationModeToggle.checked);
  
  // Initialize event listeners
  initEventListeners();
  
  // Update word count display
  updateWordCountDisplay();
  
  // Update text direction
  updateTextDirection();
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for use in other modules
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Core = {
  isRTL,
  updateTextDirection,
  toggleSourceTextVisibility,
  updateWordCountDisplay,
  updateAnalyzeButton,
  init
};
