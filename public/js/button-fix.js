/**
 * Button Functionality Fix for Auto-MQM
 * Ensures all buttons work properly and prevents event handler conflicts
 */

(function() {
  console.log('Button fix loading...');
  
  // Initialize AutoMQM namespace if it doesn't exist
  window.AutoMQM = window.AutoMQM || {};
  
  function initButtonFix() {
    // Get all button elements
    const analyzeBtn = document.getElementById('analyze-btn');
    const translateBtn = document.getElementById('translate-btn');
    const resetBtn = document.getElementById('reset-btn');
    const applyAllBtn = document.getElementById('apply-all-btn');
    const undoBtn = document.getElementById('undo-btn');
    
    // Helper function to safely add event listener
    function safeAddEventListener(element, event, handler) {
      if (element) {
        // Remove existing listeners by cloning
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
        newElement.addEventListener(event, handler);
        return newElement;
      }
      return null;
    }
    
    // Analyze button
    if (analyzeBtn) {
      safeAddEventListener(analyzeBtn, 'click', function() {
        console.log('Analyze button clicked');
        if (!this.disabled) {
          if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.runAnalysis) {
            window.AutoMQM.Analysis.runAnalysis();
          }
        }
      });
    }
    
    // Translate button
    if (translateBtn) {
      safeAddEventListener(translateBtn, 'click', function() {
        console.log('Translate button clicked');
        if (!this.disabled) {
          if (window.AutoMQM && window.AutoMQM.Translation && window.AutoMQM.Translation.translateText) {
            window.AutoMQM.Translation.translateText();
          }
        }
      });
    }
    
    // Reset button
    if (resetBtn) {
      safeAddEventListener(resetBtn, 'click', function() {
        console.log('Reset button clicked');
        if (!this.disabled) {
          const sourceText = document.getElementById('source-text');
          const targetText = document.getElementById('target-text');
          if (sourceText) sourceText.value = '';
          if (targetText) targetText.value = '';
          
          // Reset word counts
          const sourceWordCount = document.getElementById('source-word-count');
          const targetWordCount = document.getElementById('target-word-count');
          if (sourceWordCount) sourceWordCount.textContent = '0 words';
          if (targetWordCount) targetWordCount.textContent = '0 words';
          
          // Clear any warnings
          if (sourceWordCount) sourceWordCount.classList.remove('text-warning');
          if (targetWordCount) targetWordCount.classList.remove('text-warning');
          
          // Hide results if they exist
          const resultsContainer = document.getElementById('results-container');
          if (resultsContainer) resultsContainer.style.display = 'none';
          
          // Update button states
          if (window.updateButtonStates) {
            window.updateButtonStates();
          }
        }
      });
    }
    
    // Apply All button
    if (applyAllBtn) {
      safeAddEventListener(applyAllBtn, 'click', function() {
        console.log('Apply All button clicked');
        if (!this.disabled) {
          if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.applyAllCorrections) {
            window.AutoMQM.Analysis.applyAllCorrections();
          }
        }
      });
    }
    
    // Undo button
    if (undoBtn) {
      safeAddEventListener(undoBtn, 'click', function() {
        console.log('Undo button clicked');
        if (!this.disabled) {
          if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.undoLastCorrection) {
            window.AutoMQM.Analysis.undoLastCorrection();
          }
        }
      });
    }
    
    // Copy button
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      safeAddEventListener(copyBtn, 'click', function() {
        const correctedText = document.getElementById('corrected-text');
        if (correctedText) {
          if (window.AutoMQM && window.AutoMQM.Utils && window.AutoMQM.Utils.copyToClipboard) {
            window.AutoMQM.Utils.copyToClipboard(correctedText.value)
              .then(success => {
                if (success) {
                  window.AutoMQM.Utils.showNotification('Copied to clipboard!', 'success');
                } else {
                  window.AutoMQM.Utils.showNotification('Failed to copy text', 'error');
                }
              });
          } else {
            // Fallback if AutoMQM.Utils is not available
            navigator.clipboard.writeText(correctedText.value)
              .then(() => {
                console.log('Text copied to clipboard');
                const originalText = copyBtn.textContent;
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                  copyBtn.textContent = originalText;
                }, 2000);
              })
              .catch(err => {
                console.error('Failed to copy text:', err);
              });
          }
        }
      });
    }
    
    console.log('Button fix initialized successfully');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initButtonFix);
  } else {
    initButtonFix();
  }
  
  // Also run after a short delay to ensure everything is loaded
  setTimeout(initButtonFix, 500);
})();
