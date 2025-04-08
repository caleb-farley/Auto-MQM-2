/**
 * Translation and Language Detection Fix for Auto-MQM
 * This script ensures translation and language detection work correctly
 */

// Execute immediately to ensure functionality works
(function() {
  console.log('Translation and language detection fix loaded');
  
  // Wait for DOM to be fully loaded
  function initTranslationFunctions() {
    console.log('Initializing translation functions');
    
    // Get DOM elements
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const translateBtn = document.getElementById('translate-btn');
    const translationEngineInfo = document.getElementById('translation-engine-info');
    const sourceLangDetected = document.getElementById('source-lang-detected');
    
    if (!sourceText || !targetText || !sourceLang || !targetLang || !translateBtn) {
      console.error('Some translation elements not found');
      return;
    }
    
    // Language detection function
    function detectLanguage(text) {
      // Simple language detection based on character patterns
      // In a real app, you would use a proper language detection API
      
      // English detection
      const englishWords = ['the', 'and', 'is', 'in', 'to', 'it', 'that', 'was', 'for', 'on'];
      const words = text.toLowerCase().split(/\s+/);
      const englishWordCount = words.filter(word => englishWords.includes(word)).length;
      if (englishWordCount > 0) return 'en';
      
      // Spanish detection
      const spanishWords = ['el', 'la', 'los', 'las', 'y', 'es', 'son', 'por', 'para', 'con'];
      const spanishWordCount = words.filter(word => spanishWords.includes(word)).length;
      if (spanishWordCount > 0) return 'es';
      
      // French detection
      const frenchWords = ['le', 'la', 'les', 'et', 'est', 'sont', 'pour', 'avec', 'dans', 'ce'];
      const frenchWordCount = words.filter(word => frenchWords.includes(word)).length;
      if (frenchWordCount > 0) return 'fr';
      
      // German detection
      const germanWords = ['der', 'die', 'das', 'und', 'ist', 'sind', 'für', 'mit', 'in', 'auf'];
      const germanWordCount = words.filter(word => germanWords.includes(word)).length;
      if (germanWordCount > 0) return 'de';
      
      // Default to empty if we can't detect
      return '';
    }
    
    // Handle source language detection
    function handleSourceLanguageDetection() {
      const text = sourceText.value.trim();
      
      if (text.length > 20 && sourceLangDetected) {
        const detectedLang = detectLanguage(text);
        if (detectedLang) {
          sourceLangDetected.textContent = `Detected: ${detectedLang.toUpperCase()}`;
          sourceLangDetected.style.display = 'block';
          
          // Auto-select the detected language if none is selected
          if (!sourceLang.value) {
            sourceLang.value = detectedLang;
          }
        }
      }
    }
    
    // Get translation engine based on language pair
    function getTranslationEngine(sourceLang, targetLang) {
      // This is a simplified approach
      const commonLanguages = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja'];
      
      if (commonLanguages.includes(sourceLang) && commonLanguages.includes(targetLang)) {
        return 'DeepL';
      }
      
      return 'Claude';
    }
    
    // Show target language error
    function showTargetLangError(message) {
      // Remove any existing error
      const existingError = document.getElementById('target-lang-error');
      if (existingError) {
        existingError.remove();
      }
      
      // Create new error element
      const errorElement = document.createElement('div');
      errorElement.id = 'target-lang-error';
      errorElement.className = 'error-message';
      errorElement.style.color = '#d9534f'; // Bootstrap danger color
      errorElement.style.fontSize = '12px';
      errorElement.style.marginTop = '5px';
      errorElement.textContent = message;
      
      // Find the target language container and append the error
      const targetLangContainer = targetLang.parentElement;
      if (targetLangContainer) {
        targetLangContainer.appendChild(errorElement);
      }
      
      // Highlight the dropdown
      targetLang.style.borderColor = '#d9534f';
      
      // Remove the error after 5 seconds
      setTimeout(() => {
        if (errorElement.parentNode) {
          errorElement.parentNode.removeChild(errorElement);
          targetLang.style.borderColor = '';
        }
      }, 5000);
    }
    
    // Update translation engine info
    function updateTranslationEngineInfo() {
      if (!translationEngineInfo) return;
      
      const engine = getTranslationEngine(sourceLang.value, targetLang.value);
      translationEngineInfo.textContent = `Using ${engine}`;
      translationEngineInfo.style.display = 'block';
      
      // Hide after 3 seconds
      setTimeout(() => {
        translationEngineInfo.style.display = 'none';
      }, 3000);
    }
    
    // Translate text function
    async function translateText() {
      // Clear any previous error messages
      const targetLangError = document.getElementById('target-lang-error');
      if (targetLangError) targetLangError.remove();
      
      // Validate inputs
      if (!sourceText.value.trim()) {
        alert('Please enter source text');
        return;
      }
      
      if (!sourceLang.value) {
        alert('Please select source language');
        return;
      }
      
      if (!targetLang.value) {
        showTargetLangError('Please select target language');
        return;
      }
      
      // Check if source and target languages are the same
      if (sourceLang.value === targetLang.value) {
        showTargetLangError('Source and target languages cannot be the same');
        return;
      }
      
      // Disable translate button and show loading state
      translateBtn.disabled = true;
      const originalBtnText = translateBtn.innerHTML;
      translateBtn.innerHTML = '<span style="display: inline-block; width: 12px; height: 12px; border: 2px solid #fff; border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite;"></span> Translating...';
      
      try {
        // For development/testing without backend
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          // Simulate API call with a delay
          setTimeout(() => {
            targetText.value = `[Translated from ${sourceLang.value} to ${targetLang.value}] ${sourceText.value}`;
            translateBtn.disabled = false;
            translateBtn.innerHTML = originalBtnText;
            
            // Update word count
            if (typeof updateWordCountDisplay === 'function') {
              updateWordCountDisplay();
            }
            
            // Show translation engine info
            updateTranslationEngineInfo();
          }, 1000);
          return;
        }
        
        // Prepare request data
        const requestData = {
          text: sourceText.value,
          sourceLang: sourceLang.value,
          targetLang: targetLang.value
        };
        
        // Make API request
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
        
        // Check if response is ok
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Translation failed');
        }
        
        // Parse response
        const result = await response.json();
        
        // Update target text
        targetText.value = result.translatedText;
        
        // Show translation engine info
        updateTranslationEngineInfo();
        
        // Update word count
        if (typeof updateWordCountDisplay === 'function') {
          updateWordCountDisplay();
        }
      } catch (error) {
        console.error('Translation error:', error);
        alert(`Error: ${error.message}`);
      } finally {
        // Reset translate button
        translateBtn.disabled = false;
        translateBtn.innerHTML = originalBtnText;
      }
    }
    
    // Add event listeners
    // 1. Source text input for language detection
    sourceText.addEventListener('input', function() {
      console.log('Source text input detected, checking for language');
      handleSourceLanguageDetection();
    });
    
    // 2. Translate button
    // Now handled by button-fix.js
    
    // 3. Language selection changes
    sourceLang.addEventListener('change', function() {
      console.log('Source language changed to:', this.value);
    });
    
    targetLang.addEventListener('change', function() {
      console.log('Target language changed to:', this.value);
    });
    
    // 4. Handle monolingual/bilingual mode changes
    document.addEventListener('translation-mode-changed', function(event) {
      if (event.detail && event.detail.isMonolingual) {
        console.log('Switched to monolingual mode, hiding translate button');
        if (translateBtn) translateBtn.style.display = 'none';
      } else {
        console.log('Switched to bilingual mode, showing translate button');
        if (translateBtn) translateBtn.style.display = 'block';
      }
    });
    
    // Add CSS for spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    
    console.log('Translation functions initialized successfully');
  }
  
  // Initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslationFunctions);
  } else {
    // DOM already loaded, run immediately
    initTranslationFunctions();
  }
  
  // Also run after a short delay to ensure everything is loaded
  setTimeout(initTranslationFunctions, 500);
})();
