/**
 * Auto-MQM Toggle Functionality
 * Handles the monolingual/bilingual toggle and related UI changes
 */

// Global namespace for Auto-MQM
window.AutoMQM = window.AutoMQM || {};

// RTL language codes
const rtlLanguages = ['ar', 'he', 'fa', 'ur'];

/**
 * Check if a language is RTL
 * @param {string} langCode - The language code to check
 * @returns {boolean} - Whether the language is RTL
 */
function isRTL(langCode) {
  if (!langCode) return false;
  // Check if the language code starts with any RTL language prefix
  return rtlLanguages.some(rtlCode => langCode.startsWith(rtlCode));
}

/**
 * Update text direction based on selected languages
 */
function updateTextDirection() {
  const sourceLang = document.getElementById('source-lang').value;
  const targetLang = document.getElementById('target-lang').value;
  const sourceText = document.getElementById('source-text');
  const targetText = document.getElementById('target-text');
  
  // Set text direction based on language (while keeping dir='auto' for automatic detection)
  if (sourceLang && isRTL(sourceLang)) {
    sourceText.style.textAlign = 'right';
  } else if (sourceLang) {
    sourceText.style.textAlign = 'left';
  }
  
  if (targetLang && isRTL(targetLang)) {
    targetText.style.textAlign = 'right';
  } else if (targetLang) {
    targetText.style.textAlign = 'left';
  }
}

/**
 * Toggle source text visibility based on monolingual/bilingual mode
 * @param {boolean} isMonolingual - Whether to switch to monolingual mode
 */
function toggleSourceTextVisibility(isMonolingual) {
  // Use direct IDs for maximum reliability
  const sourceContainer = document.getElementById('source-text-container');
  const targetContainer = document.getElementById('target-text-container');
  const sourceText = document.getElementById('source-text');
  const sourceLang = document.getElementById('source-lang');
  const textAreasContainer = document.getElementById('text-areas-container');
  const translateBtn = document.getElementById('translate-btn');
  
  console.log('Toggle called with isMonolingual:', isMonolingual);
  
  // Set global state for reference
  window.isMonolingualMode = isMonolingual;
  
  // Add CSS to document if not already present
  if (!document.getElementById('monolingual-mode-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'monolingual-mode-styles';
    styleEl.textContent = `
      .monolingual-mode #source-text-container {
        display: none !important;
      }
      .monolingual-mode #target-text-container {
        width: 100% !important;
        flex: 1 0 100% !important;
      }
      .monolingual-mode #translate-btn {
        display: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  // Apply or remove monolingual mode class
  if (isMonolingual) {
    textAreasContainer.classList.add('monolingual-mode');
    // Clear source text when switching to monolingual mode
    if (sourceText) sourceText.value = '';
    // Hide translate button in monolingual mode
    if (translateBtn) translateBtn.style.display = 'none';
  } else {
    textAreasContainer.classList.remove('monolingual-mode');
    // Show translate button in bilingual mode
    if (translateBtn) translateBtn.style.display = 'block';
  }
  
  // Dispatch custom event for other components to react
  document.dispatchEvent(new CustomEvent('translation-mode-changed', {
    detail: { isMonolingual }
  }));
  
  // Update analyze button state
  if (typeof updateAnalyzeButton === 'function') {
    updateAnalyzeButton();
  }
}

/**
 * Initialize toggle functionality
 */
function initToggle() {
  const translationToggle = document.getElementById('translation-mode-toggle');
  const bilingualRadio = document.querySelector('input[name="translation-mode"][value="bilingual"]');
  const monolingualRadio = document.querySelector('input[name="translation-mode"][value="monolingual"]');
  
  // Language handlers moved to core-functions.js
  if (translationToggle) {
    translationToggle.addEventListener('change', function() {
      toggleSourceTextVisibility(this.checked);
    });
    
    // Initialize toggle based on current state
    toggleSourceTextVisibility(translationToggle.checked);
  }
  
  // Handle radio button changes (if they exist)
  if (bilingualRadio && monolingualRadio) {
    bilingualRadio.addEventListener('change', function() {
      if (this.checked && translationToggle) {
        translationToggle.checked = false;
        toggleSourceTextVisibility(false);
      }
    });
    
    monolingualRadio.addEventListener('change', function() {
      if (this.checked && translationToggle) {
        translationToggle.checked = true;
        toggleSourceTextVisibility(true);
      }
    });
    
    // Initialize toggle based on radio button state
    if (translationToggle) {
      translationToggle.checked = monolingualRadio.checked;
      toggleSourceTextVisibility(monolingualRadio.checked);
    }
  }
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', initToggle);

// Export functions for use in other modules
window.AutoMQM.Toggle = {
  isRTL,
  updateTextDirection,
  toggleSourceTextVisibility,
  initToggle
};
