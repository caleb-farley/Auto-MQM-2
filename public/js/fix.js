/**
 * Fix script for Auto-MQM functionality issues
 * This script ensures all buttons and text inputs work correctly
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Fix script loaded');
  
  // Fix for text areas not registering input
  const sourceText = document.getElementById('source-text');
  const targetText = document.getElementById('target-text');
  
  if (sourceText) {
    console.log('Source text area found');
    // Ensure the text area is not disabled or readonly
    sourceText.disabled = false;
    sourceText.readOnly = false;
    
    // Re-attach input event listener
    sourceText.addEventListener('input', function() {
      console.log('Source text input event fired');
      // Update word count if that function exists
      if (typeof updateWordCountDisplay === 'function') {
        updateWordCountDisplay();
      }
    });
  } else {
    console.error('Source text area not found');
  }
  
  if (targetText) {
    console.log('Target text area found');
    // Ensure the text area is not disabled or readonly
    targetText.disabled = false;
    targetText.readOnly = false;
    
    // Re-attach input event listener
    targetText.addEventListener('input', function() {
      console.log('Target text input event fired');
      // Update word count if that function exists
      if (typeof updateWordCountDisplay === 'function') {
        updateWordCountDisplay();
      }
    });
  } else {
    console.error('Target text area not found');
  }
  
  // Fix for translation mode toggle
  const translationModeToggle = document.getElementById('translation-mode-toggle');
  if (translationModeToggle) {
    console.log('Translation mode toggle found');
    
    // Re-attach change event listener
    translationModeToggle.addEventListener('change', function() {
      console.log('Translation mode toggle changed:', this.checked ? 'Monolingual' : 'Bilingual');
      
      // Toggle source text visibility
      const sourceContainer = document.getElementById('source-text-container');
      const textAreasContainer = document.getElementById('text-areas-container');
      const translateBtn = document.getElementById('translate-btn');
      
      if (this.checked) { // Monolingual mode
        if (textAreasContainer) textAreasContainer.classList.add('monolingual-mode');
        if (translateBtn) translateBtn.style.display = 'none';
      } else { // Bilingual mode
        if (textAreasContainer) textAreasContainer.classList.remove('monolingual-mode');
        if (translateBtn) translateBtn.style.display = 'block';
      }
      
      // Dispatch custom event
      document.dispatchEvent(new CustomEvent('translation-mode-changed', {
        detail: { isMonolingual: this.checked }
      }));
    });
    
    // Trigger change event to ensure correct initial state
    translationModeToggle.dispatchEvent(new Event('change'));
  } else {
    console.error('Translation mode toggle not found');
  }
  
  // Fix for analyze button
  const analyzeBtn = document.getElementById('analyze-btn');
  if (analyzeBtn) {
    console.log('Analyze button found');
    
    // Ensure button is not disabled
    analyzeBtn.disabled = false;
    
    // Re-attach click event listener
    analyzeBtn.addEventListener('click', function() {
      console.log('Analyze button clicked');
      // Call runAnalysis function if it exists
      if (typeof runAnalysis === 'function') {
        runAnalysis();
      } else {
        console.error('runAnalysis function not found');
      }
    });
  } else {
    console.error('Analyze button not found');
  }
  
  // Fix for translate button
  const translateBtn = document.getElementById('translate-btn');
  if (translateBtn) {
    console.log('Translate button found');
    
    // Ensure button is not disabled
    translateBtn.disabled = false;
    
    // Re-attach click event listener
    translateBtn.addEventListener('click', function() {
      console.log('Translate button clicked');
      // Call translateText function if it exists
      if (typeof translateText === 'function') {
        translateText();
      } else {
        console.error('translateText function not found');
      }
    });
  } else {
    console.error('Translate button not found');
  }
  
  // Add monolingual mode styles if not already present
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
  
  console.log('Fix script completed');
});
