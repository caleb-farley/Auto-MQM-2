/**
 * Core Functions for Auto-MQM
 * Centralizes common functionality to prevent conflicts
 */

// Initialize AutoMQM namespace
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Core = window.AutoMQM.Core || {};

(function() {
  // Core functions
  const CoreFunctions = {
    // State management
    _state: {
      isMonolingual: false,
      sourceWordCount: 0,
      targetWordCount: 0,
      accountType: 'Anonymous'
    },

    // Initialize function to set up event listeners
    init: function() {
      // Initialize language handlers
      this.initLanguageHandlers();

      // Add event listeners for text inputs
      const sourceText = document.getElementById('source-text');
      const targetText = document.getElementById('target-text');
      const translationModeToggle = document.getElementById('translation-mode-toggle');
      const analyzeBtn = document.getElementById('analyze-btn');

      // Set up input handlers with debounce
      if (sourceText) {
        sourceText.addEventListener('input', this._debounce(() => {
          this._updateWordCount('source');
          this.handleSourceLanguageDetection();
        }, 100));
      }

      if (targetText) {
        targetText.addEventListener('input', this._debounce(() => {
          this._updateWordCount('target');
          this.handleTargetLanguageDetection();
        }, 100));
      }

      // Set up translation mode toggle
      if (translationModeToggle) {
        translationModeToggle.addEventListener('change', () => {
          this._state.isMonolingual = translationModeToggle.checked;
          this._updateUIVisibility();
          this._updateWordCounts();
          this.updateAnalyzeButton();
          
          // Notify other components
          document.dispatchEvent(new CustomEvent('monolingual-mode-changed', {
            detail: { isMonolingual: this._state.isMonolingual }
          }));
        });
      }

      if (analyzeBtn) {
        analyzeBtn.addEventListener('click', this.runAnalysis.bind(this));
      }

      // Initial setup
      this._updateAccountType();
      this._updateWordCounts();
      this._updateUIVisibility();
      this.updateAnalyzeButton();
    },

    // Helper function for debouncing
    _debounce: function(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    // Update UI visibility based on monolingual mode
    _updateUIVisibility: function() {
      const sourceContainer = document.getElementById('source-text-container');
      const targetContainer = document.getElementById('target-text-container');
      
      if (sourceContainer) {
        sourceContainer.style.display = this._state.isMonolingual ? 'none' : 'block';
      }
      if (targetContainer) {
        targetContainer.classList.toggle('monolingual', this._state.isMonolingual);
      }
    },
    // Update account type and word limit
    _updateAccountType: function() {
      const accountTypeElement = document.querySelector('.account-type');
      if (accountTypeElement && accountTypeElement.textContent) {
        this._state.accountType = accountTypeElement.textContent.trim();
      }
    },

    // Get word limit based on account type
    _getWordLimit: function() {
      const limits = {
        'Anonymous': 500,
        'Premium': 1000,
        'Professional': 2000,
        'Enterprise': 5000,
        'Admin': 10000
      };
      return limits[this._state.accountType] || 500;
    },

    // Count words in text
    _countWords: function(text) {
      const words = (text || '').trim().split(/\s+/);
      return words.length > 0 && words[0] !== '' ? words.length : 0;
    },

    // Update word count for a specific text area
    _updateWordCount: function(type) {
      const element = document.getElementById(`${type}-text`);
      const countElement = document.getElementById(`${type}-word-count`);
      
      if (element && countElement) {
        const count = this._countWords(element.value);
        this._state[`${type}WordCount`] = count;
        this._updateWordCountDisplay(type);
      }
    },

    // Update all word counts
    _updateWordCounts: function() {
      this._updateWordCount('source');
      this._updateWordCount('target');
    },

    // Update word count display for a specific type
    _updateWordCountDisplay: function(type) {
      const countElement = document.getElementById(`${type}-word-count`);
      if (!countElement) return;

      const count = this._state[`${type}WordCount`];
      const limit = this._getWordLimit();
      
      countElement.textContent = `${count} / ${limit} words`;
      countElement.classList.toggle('text-warning', count > limit);

      // Dispatch event for word count change
      document.dispatchEvent(new CustomEvent('word-count-updated', {
        detail: { type, count, limit }
      }));

      // Update analyze button state
      this.updateAnalyzeButton();
    },

    handleSourceLanguageDetection: async function() {
      // Debounce language detection
      clearTimeout(this._sourceDetectionTimeout);
      this._sourceDetectionTimeout = setTimeout(async () => {
      const sourceText = document.getElementById('source-text');
      const sourceLang = document.getElementById('source-lang');
      const sourceLangBubble = document.getElementById('source-lang-bubble');
      
      if (!sourceText || !sourceLang) return;
      
      const text = sourceText.value.trim();
      if (text.length >= 5) {
        try {
          // Call language detection API
          const response = await fetch('/api/detect-language', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
          });
          
          if (!response.ok) throw new Error('Language detection failed');
          
          const data = await response.json();
          if (data.language && (!sourceLang.value || sourceLang.dataset.autoDetected === 'true')) {
            sourceLang.value = data.language;
            sourceLang.dataset.autoDetected = 'true';
            if (sourceLangBubble) {
              sourceLangBubble.style.display = 'none';
            }
            // Update analyze button state after language detection
            this.updateAnalyzeButton();
          }
        } catch (error) {
          console.error('Language detection failed:', error);
        }
      }  
      }, 100);
    },

    handleTargetLanguageDetection: async function() {
      // Debounce language detection
      clearTimeout(this._targetDetectionTimeout);
      this._targetDetectionTimeout = setTimeout(async () => {
      const targetText = document.getElementById('target-text');
      const targetLang = document.getElementById('target-lang');
      const targetLangBubble = document.getElementById('target-lang-bubble');
      
      if (!targetText || !targetLang) return;
      
      const text = targetText.value.trim();
      if (text.length >= 5) {
        try {
          // Call language detection API
          const response = await fetch('/api/detect-language', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
          });
          
          if (!response.ok) throw new Error('Language detection failed');
          
          const data = await response.json();
          if (data.language && (!targetLang.value || targetLang.dataset.autoDetected === 'true')) {
            targetLang.value = data.language;
            targetLang.dataset.autoDetected = 'true';
            if (targetLangBubble) {
              targetLangBubble.style.display = 'none';
            }
            // Update analyze button state after language detection
            this.updateAnalyzeButton();
          }
        } catch (error) {
          console.error('Language detection failed:', error);
        }
      }  
      }, 100);
    },

    // Translation function
    translateText: async function() {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translateBtn = document.getElementById('translate-btn');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    const isMonolingual = translationModeToggle?.checked || false;
    
    if (!targetText || !targetLang || !translateBtn) {
      console.error('Required elements not found');
      return;
    }
    
    let text, fromLang, toLang;
    
    if (isMonolingual) {
      // In monolingual mode, we only need target text and language
      text = targetText.value.trim();
      fromLang = await window.AutoMQM.Utils.detectLanguage(text) || '';
      toLang = targetLang.value;
      
      if (!text) {
        window.AutoMQM.Utils.showNotification('Please enter text to translate', 'error');
        return;
      }
      
      if (!fromLang) {
        window.AutoMQM.Utils.showNotification('Could not detect source language', 'error');
        return;
      }
    } else {
      // In bilingual mode, we need both source and target
      text = sourceText.value.trim();
      fromLang = sourceLang.value;
      toLang = targetLang.value;
      
      if (!text) {
        window.AutoMQM.Utils.showNotification('Please enter text to translate', 'error');
        return;
      }
      
      if (!fromLang) {
        window.AutoMQM.Utils.showNotification('Please select source language', 'error');
        return;
      }
    }
    
    if (!toLang) {
      window.AutoMQM.Utils.showNotification('Please select target language', 'error');
      return;
    }
    
    try {
      translateBtn.disabled = true;
      translateBtn.textContent = 'Translating...';
      
      const translatedText = await window.AutoMQM.Utils.translate(text, fromLang, toLang);
      if (translatedText) {
        if (!isMonolingual) {
          targetText.value = translatedText;
        }
        window.AutoMQM.Core.updateWordCountDisplay();
      }
    } catch (error) {
      console.error('Translation failed:', error);
      window.AutoMQM.Utils.showNotification('Translation failed: ' + error.message, 'error');
    } finally {
      translateBtn.disabled = false;
      translateBtn.textContent = 'Translate';
    }
    },

    // Analysis function
    runAnalysis: async function() {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('analysis-loading-indicator');
    
    if (!analyzeBtn || !resultsContainer || !loadingIndicator) {
      console.error('Required elements not found');
      return;
    }
    
    try {
      analyzeBtn.disabled = true;
      loadingIndicator.style.display = 'block';
      resultsContainer.style.display = 'none';
      
      const data = {
        sourceText: sourceText?.value || '',
        targetText: targetText?.value || '',
        sourceLang: sourceLang?.value || '',
        targetLang: targetLang?.value || '',
        isMonolingual: document.getElementById('translation-mode-toggle')?.checked || false
      };
      
      const results = await window.AutoMQM.Utils.analyze(data);
      if (results) {
        window.AutoMQM.Utils.displayResults(results);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      window.AutoMQM.Utils.showNotification('Analysis failed: ' + error.message, 'error');
    } finally {
      analyzeBtn.disabled = false;
      loadingIndicator.style.display = 'none';
    }
    },

    // Language and translation mode handlers
    initLanguageHandlers: function() {
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    
    // RTL language codes
    const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
    
    function isRTL(langCode) {
      if (!langCode) return false;
      return rtlLanguages.some(rtlCode => langCode.startsWith(rtlCode));
    }
    
    function updateTextDirection() {
      if (sourceText && sourceLang) {
        sourceText.style.textAlign = isRTL(sourceLang.value) ? 'right' : 'left';
      }
      if (targetText && targetLang) {
        targetText.style.textAlign = isRTL(targetLang.value) ? 'right' : 'left';
      }
    }
    
    function toggleSourceTextVisibility(isMonolingual) {
      const sourceTextContainer = document.getElementById('source-text-container');
      const targetTextContainer = document.getElementById('target-text-container');
      const textAreasContainer = document.getElementById('text-areas-container');
      const translateBtn = document.getElementById('translate-btn');
      
      if (isMonolingual) {
        textAreasContainer?.classList.add('monolingual-mode');
        if (translateBtn) translateBtn.style.display = 'none';
      } else {
        textAreasContainer?.classList.remove('monolingual-mode');
        if (translateBtn) translateBtn.style.display = 'block';
      }
      
      // Update button states
      window.AutoMQM.Core.updateButtonStates?.();
      
      // Notify other components
      document.dispatchEvent(new CustomEvent('translation-mode-changed', { 
        detail: { mode: isMonolingual ? 'monolingual' : 'bilingual' } 
      }));
    }
    
    // Source language change handler
    if (sourceLang) {
      sourceLang.addEventListener('change', function() {
        this.removeAttribute('data-autodetected');
        updateTextDirection();
      });
    }
    
    // Target language change handler
    if (targetLang) {
      targetLang.addEventListener('change', function() {
        this.removeAttribute('data-autodetected');
        updateTextDirection();
        
        // Update language bubble
        const targetLangBubble = document.getElementById('target-lang-bubble');
        if (targetLangBubble) {
          targetLangBubble.style.display = this.value ? 'none' : 'block';
        }
      });
    }
    
    // Translation mode toggle handler
    if (translationModeToggle) {
      translationModeToggle.addEventListener('change', function() {
        toggleSourceTextVisibility(this.checked);
      });
    }
    
    // Initialize text direction
    updateTextDirection();
  },
  
  // Analysis functions
  updateAnalyzeButton: function() {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const analyzeBtn = document.getElementById('analyze-btn');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    
    if (!analyzeBtn) return;
    
    const isMonolingual = translationModeToggle?.checked || false;
    
    // Get account type and word count limits
    const accountType = document.querySelector('.account-type')?.textContent?.trim() || 'Anonymous';
    const limits = {
      'Anonymous': 500,
      'Premium': 1000,
      'Professional': 2000,
      'Enterprise': 5000,
      'Admin': 10000
    };
    const limit = limits[accountType] || 500;
    
    // Check word counts
    const sourceWords = sourceText?.value?.trim().split(/\s+/) || [];
    const targetWords = targetText?.value?.trim().split(/\s+/) || [];
    const sourceWordCount = sourceWords.length > 0 && sourceWords[0] !== '' ? sourceWords.length : 0;
    const targetWordCount = targetWords.length > 0 && targetWords[0] !== '' ? targetWords.length : 0;
    
    // Check if word counts exceed limits
    const withinLimits = sourceWordCount <= limit && targetWordCount <= limit;
    
    // Check all conditions for enabling analyze button
    let canAnalyze = true;
    
    // In monolingual mode, only check target text
    if (isMonolingual) {
      canAnalyze = targetText?.value?.trim() && targetLang?.value && withinLimits;
    } else {
      // In bilingual mode, check both source and target
      canAnalyze = sourceText?.value?.trim() && sourceLang?.value &&
                   targetText?.value?.trim() && targetLang?.value && withinLimits;
    }
    
    analyzeBtn.disabled = !canAnalyze;
  },

  displayResults: function(results) {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer || !results) return;
    
    // Clear previous results
    resultsContainer.innerHTML = '';
    
    // Create results table
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Add headers
    const headers = ['Category', 'Score', 'Details'];
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
    
    // Add results
    Object.entries(results).forEach(([category, data]) => {
      const row = document.createElement('tr');
      
      // Category
      const categoryCell = document.createElement('td');
      categoryCell.textContent = category;
      row.appendChild(categoryCell);
      
      // Score
      const scoreCell = document.createElement('td');
      scoreCell.textContent = typeof data.score === 'number' ? data.score.toFixed(2) : data.score;
      row.appendChild(scoreCell);
      
      // Details
      const detailsCell = document.createElement('td');
      if (data.details) {
        detailsCell.innerHTML = Array.isArray(data.details) 
          ? data.details.join('<br>') 
          : data.details;
      }
      row.appendChild(detailsCell);
      
      table.appendChild(row);
    });
    
    resultsContainer.appendChild(table);
    resultsContainer.style.display = 'block';
    },

    runAnalysis: async function() {
      const sourceText = document.getElementById('source-text');
      const targetText = document.getElementById('target-text');
      const sourceLang = document.getElementById('source-lang');
      const targetLang = document.getElementById('target-lang');
      const analyzeBtn = document.getElementById('analyze-btn');
      const resultsContainer = document.getElementById('results-container');
      
      if (!analyzeBtn || !resultsContainer) {
        console.error('Required elements not found');
        return;
      }
      
      try {
        analyzeBtn.disabled = true;
        window.AutoMQM.Utils.showLoading();
        resultsContainer.style.display = 'none';
        
        const data = {
          sourceText: sourceText?.value || '',
          targetText: targetText?.value || '',
          sourceLang: sourceLang?.value || '',
          targetLang: targetLang?.value || '',
          isMonolingual: document.getElementById('translation-mode-toggle')?.checked || false
        };
        
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
        
        if (!response.ok) {
          throw new Error('Analysis failed');
        }
        
        const results = await response.json();
        window.AutoMQM.Core.displayResults(results);
      } catch (error) {
        console.error('Analysis failed:', error);
        window.AutoMQM.Utils.showNotification('Analysis failed: ' + error.message, 'error');
      } finally {
        analyzeBtn.disabled = false;
        window.AutoMQM.Utils.hideLoading();
      }
    },

    updateAnalyzeButton: function() {
      const sourceText = document.getElementById('source-text');
      const targetText = document.getElementById('target-text');
      const sourceLang = document.getElementById('source-lang');
      const targetLang = document.getElementById('target-lang');
      const analyzeBtn = document.getElementById('analyze-btn');
      const translationModeToggle = document.getElementById('translation-mode-toggle');
      const isMonolingual = translationModeToggle?.checked || false;

      if (!analyzeBtn) return;

      let canAnalyze = true;

      if (!isMonolingual && (!sourceText?.value || !sourceLang?.value)) {
        canAnalyze = false;
      }

      if (!targetText?.value || !targetLang?.value) {
        canAnalyze = false;
      }

      analyzeBtn.disabled = !canAnalyze;
    }
  };

  // Export core functions to global namespace
  Object.assign(window.AutoMQM.Core, CoreFunctions);
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.AutoMQM.Core.init();
  console.log('Core functions initialized');
});
