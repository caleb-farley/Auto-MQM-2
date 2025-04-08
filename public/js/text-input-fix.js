/**
 * Emergency fix for text input functionality
 * This script directly handles text input issues by bypassing potential event conflicts
 */

// Execute immediately to ensure text areas work
(function() {
  console.log('Emergency text input fix loaded');
  
  // Wait for DOM to be fully loaded
  function initTextAreas() {
    console.log('Initializing text areas with direct event handlers');
    
    // Get text areas
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    
    if (sourceText) {
      // Force enable the text area
      sourceText.disabled = false;
      sourceText.readOnly = false;
      
      // Remove any existing event listeners (might be causing conflicts)
      sourceText.replaceWith(sourceText.cloneNode(true));
      
      // Get the fresh element reference
      const newSourceText = document.getElementById('source-text');
      
      // Add direct event listener
      newSourceText.addEventListener('input', function(e) {
        console.log('Direct source text input detected:', e.target.value.length, 'characters');
        
        // Update word count manually
        const sourceWordCount = document.getElementById('source-word-count');
        if (sourceWordCount) {
          const words = e.target.value.trim().split(/\s+/);
          const wordCount = words.length > 0 && words[0] !== '' ? words.length : 0;
          sourceWordCount.textContent = `${wordCount} words`;
          
          if (wordCount > 500) {
            sourceWordCount.classList.add('text-warning');
          } else {
            sourceWordCount.classList.remove('text-warning');
          }
        }
        
        // Update button states
        updateButtonStates();
      });
      
      console.log('Source text area fixed with direct handler');
    }
    
    if (targetText) {
      // Force enable the text area
      targetText.disabled = false;
      targetText.readOnly = false;
      
      // Remove any existing event listeners (might be causing conflicts)
      targetText.replaceWith(targetText.cloneNode(true));
      
      // Get the fresh element reference
      const newTargetText = document.getElementById('target-text');
      
      // Add direct event listener
      newTargetText.addEventListener('input', function(e) {
        console.log('Direct target text input detected:', e.target.value.length, 'characters');
        
        // Update word count manually
        const targetWordCount = document.getElementById('target-word-count');
        if (targetWordCount) {
          const words = e.target.value.trim().split(/\s+/);
          const wordCount = words.length > 0 && words[0] !== '' ? words.length : 0;
          targetWordCount.textContent = `${wordCount} words`;
          
          if (wordCount > 500) {
            targetWordCount.classList.add('text-warning');
          } else {
            targetWordCount.classList.remove('text-warning');
          }
        }
        
        // Update button states
        updateButtonStates();
      });
      
      console.log('Target text area fixed with direct handler');
    }
  }
  
  // Update analyze button state based on text content
  function updateButtonStates() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    
    if (analyzeBtn && sourceText && targetText && sourceLang && targetLang) {
      const isMonolingual = translationModeToggle ? translationModeToggle.checked : false;
      
      if (isMonolingual) {
        // In monolingual mode, we only need target text and language
        analyzeBtn.disabled = !targetText.value.trim() || !targetLang.value;
      } else {
        // In bilingual mode, we need both source and target text and languages
        analyzeBtn.disabled = !sourceText.value.trim() || !targetText.value.trim() || 
                             !sourceLang.value || !targetLang.value;
      }
      
      console.log('Analyze button state updated, disabled:', analyzeBtn.disabled);
    }
  }
  
  // Initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTextAreas);
  } else {
    // DOM already loaded, run immediately
    initTextAreas();
  }
  
  // Also run after a short delay to ensure everything is loaded
  setTimeout(initTextAreas, 500);
  
  // And run one more time after a longer delay for good measure
  setTimeout(initTextAreas, 1500);
})();
