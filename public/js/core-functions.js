/**
 * Core Functions for Auto-MQM
 * Centralizes common functionality to prevent conflicts
 */

// Initialize AutoMQM namespace
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Core = window.AutoMQM.Core || {};

(function() {
  // Word count display function
  window.AutoMQM.Core.updateWordCountDisplay = function() {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceWordCount = document.getElementById('source-word-count');
    const targetWordCount = document.getElementById('target-word-count');
    
    if (sourceText && sourceWordCount) {
      const words = sourceText.value.trim().split(/\s+/);
      const count = words.length > 0 && words[0] !== '' ? words.length : 0;
      sourceWordCount.textContent = `${count} words`;
      
      // Get user's account type and corresponding limit
      const accountType = document.querySelector('.account-type')?.textContent || 'Anonymous';
      const limits = {
        'Anonymous': 500,
        'Premium': 1000,
        'Professional': 2000,
        'Enterprise': 5000,
        'Admin': 10000
      };
      const limit = limits[accountType] || 500;
      
      sourceWordCount.textContent = `${count} / ${limit} words`;
      if (count > limit) {
        sourceWordCount.classList.add('text-warning');
      } else {
        sourceWordCount.classList.remove('text-warning');
      }
    }
    
    if (targetText && targetWordCount) {
      const words = targetText.value.trim().split(/\s+/);
      const count = words.length > 0 && words[0] !== '' ? words.length : 0;
      targetWordCount.textContent = `${count} words`;
      
      // Get user's account type and corresponding limit
      const accountType = document.querySelector('.account-type')?.textContent || 'Anonymous';
      const limits = {
        'Anonymous': 500,
        'Premium': 1000,
        'Professional': 2000,
        'Enterprise': 5000,
        'Admin': 10000
      };
      const limit = limits[accountType] || 500;
      
      targetWordCount.textContent = `${count} / ${limit} words`;
      if (count > limit) {
        targetWordCount.classList.add('text-warning');
      } else {
        targetWordCount.classList.remove('text-warning');
      }
    }
  };

  // Language detection functions
  window.AutoMQM.Core.handleSourceLanguageDetection = async function() {
    const sourceText = document.getElementById('source-text');
    const sourceLang = document.getElementById('source-lang');
    
    if (sourceText && sourceLang && !sourceLang.value) {
      const text = sourceText.value.trim();
      
      // Only attempt detection if we have enough text (lowered threshold to 5 characters)
      if (text.length >= 5) {
        try {
          const detectedLang = await window.AutoMQM.Utils.detectLanguage(text);
          if (detectedLang) {
            sourceLang.value = detectedLang;
            sourceLang.setAttribute('data-autodetected', 'true');
            console.log('Source language auto-detected:', detectedLang);
          }
        } catch (error) {
          console.error('Language detection failed:', error);
        }
      }
    }
  };

  window.AutoMQM.Core.handleTargetLanguageDetection = async function() {
    const targetText = document.getElementById('target-text');
    const targetLang = document.getElementById('target-lang');
    
    if (targetText && targetLang && !targetLang.value) {
      const text = targetText.value.trim();
      
      // Only attempt detection if we have enough text (lowered threshold to 5 characters)
      if (text.length >= 5) {
        try {
          const detectedLang = await window.AutoMQM.Utils.detectLanguage(text);
          if (detectedLang) {
            targetLang.value = detectedLang;
            targetLang.setAttribute('data-autodetected', 'true');
            console.log('Target language auto-detected:', detectedLang);
          }
        } catch (error) {
          console.error('Language detection failed:', error);
        }
      }
    }
  };

  // Translation function
  window.AutoMQM.Core.translateText = async function() {
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
  };

  // Analysis function
  window.AutoMQM.Core.runAnalysis = async function() {
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
  };

  // Language and translation mode handlers
  window.AutoMQM.Core.initLanguageHandlers = function() {
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
  };
  
  // Analysis functions
  window.AutoMQM.Core.updateAnalyzeButton = function() {
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const analyzeBtn = document.getElementById('analyze-btn');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    
    if (!analyzeBtn) return;
    
    const isMonolingual = translationModeToggle?.checked || false;
    const sourceWords = sourceText?.value?.trim().split(/\s+/) || [];
    const targetWords = targetText?.value?.trim().split(/\s+/) || [];
    const sourceWordCount = sourceWords.length > 0 && sourceWords[0] !== '' ? sourceWords.length : 0;
    const targetWordCount = targetWords.length > 0 && targetWords[0] !== '' ? targetWords.length : 0;
    
    // Get account type limits
    const accountType = document.querySelector('.account-type')?.textContent || 'Anonymous';
    const limits = {
      'Anonymous': 500,
      'Premium': 1000,
      'Professional': 2000,
      'Enterprise': 5000,
      'Admin': 10000
    };
    const limit = limits[accountType] || 500;
    
    // Check conditions for enabling analyze button
    const hasSourceText = sourceText && sourceText.value.trim().length > 0;
    const hasSourceLang = sourceLang && sourceLang.value;
    const hasTargetText = targetText && targetText.value.trim().length > 0;
    const hasTargetLang = targetLang && targetLang.value;
    const withinLimit = sourceWordCount <= limit && (!hasTargetText || targetWordCount <= limit);
    
    // In monolingual mode, we only need target text and language
    const canAnalyze = isMonolingual ?
      (hasTargetText && hasTargetLang && withinLimit) :
      (hasSourceText && hasSourceLang && hasTargetText && hasTargetLang && withinLimit);
    
    analyzeBtn.disabled = !canAnalyze;
  };

  window.AutoMQM.Core.displayResults = function(results) {
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
  };

  window.AutoMQM.Core.runAnalysis = async function() {
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
  };

  // Initialize all core functionality
  window.addEventListener('DOMContentLoaded', function() {
    window.AutoMQM.Core.initLanguageHandlers();
  });
  
  console.log('Core functions initialized');
})();
