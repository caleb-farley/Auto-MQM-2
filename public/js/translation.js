/**
 * Auto-MQM Translation Functionality
 * Handles machine translation requests
 */

// DOM Elements
const sourceText = document.getElementById('source-text');
const targetText = document.getElementById('target-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const translateBtn = document.getElementById('translate-btn');
const translationEngineInfo = document.getElementById('translation-engine-info');

/**
 * Detect language using browser API or fallback
 */
async function detectLanguage(text) {
  // Check if browser supports language detection API
  if (navigator.language && window.Intl && window.Intl.Locale) {
    try {
      // This is a simplified approach - in a real app, you'd use a proper language detection API
      const locale = new Intl.Locale(navigator.language);
      return locale.language;
    } catch (error) {
      console.error('Language detection error:', error);
      return simulateLanguageDetection(text);
    }
  } else {
    return simulateLanguageDetection(text);
  }
}

/**
 * Simulate language detection for testing or fallback
 */
function simulateLanguageDetection(text) {
  // This is just a simple simulation based on character frequency
  // In a real app, you'd use a proper language detection API
  
  // Check for common English words
  const englishWords = ['the', 'and', 'is', 'in', 'to', 'it', 'that', 'was', 'for', 'on'];
  const words = text.toLowerCase().split(/\s+/);
  
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  
  if (englishWordCount > 0) {
    return 'en';
  }
  
  // Default to empty if we can't detect
  return '';
}

/**
 * Update source language detection
 */
function handleSourceLanguageDetection() {
  const text = sourceText.value.trim();
  const sourceDetected = document.getElementById('source-lang-detected');
  
  if (text.length > 20 && sourceDetected) {
    detectLanguage(text).then(lang => {
      if (lang) {
        sourceDetected.textContent = `Detected: ${lang.toUpperCase()}`;
        sourceDetected.style.display = 'block';
      }
    });
  }
}

/**
 * Update target language detection
 */
function handleTargetLanguageDetection() {
  const text = targetText.value.trim();
  const targetDetected = document.getElementById('target-lang-detected');
  
  if (text.length > 20 && targetDetected) {
    detectLanguage(text).then(lang => {
      if (lang) {
        targetDetected.textContent = `Detected: ${lang.toUpperCase()}`;
        targetDetected.style.display = 'block';
      }
    });
  }
}

/**
 * Determine which translation engine will be used based on selected languages
 */
function getTranslationEngine(sourceLang, targetLang) {
  // This is a simplified approach - in a real app, you'd have more complex logic
  // based on available engines and language pair support
  
  // Common language pairs might use DeepL
  const commonLanguages = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'zh', 'ja'];
  
  if (commonLanguages.includes(sourceLang) && commonLanguages.includes(targetLang)) {
    return 'DeepL';
  }
  
  // For less common language pairs, use Claude
  return 'Claude';
}

/**
 * Show target language error
 */
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
  errorElement.style.color = 'var(--severity-critical)';
  errorElement.style.fontSize = '12px';
  errorElement.style.marginTop = '5px';
  errorElement.textContent = message;
  
  // Find the target language container and append the error
  const targetLangContainer = targetLang.parentElement;
  if (targetLangContainer) {
    targetLangContainer.appendChild(errorElement);
  }
  
  // Highlight the dropdown
  targetLang.style.borderColor = 'var(--severity-critical)';
  
  // Remove the error after 5 seconds
  setTimeout(() => {
    if (errorElement.parentNode) {
      errorElement.parentNode.removeChild(errorElement);
      targetLang.style.borderColor = '';
    }
  }, 5000);
}

/**
 * Update translation engine info based on selected languages
 */
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

/**
 * Translate text using the API
 */
async function translateText() {
  // Clear any previous error messages
  const targetLangError = document.getElementById('target-lang-error');
  if (targetLangError) targetLangError.style.display = 'none';
  
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
  
  // Disable translate button and show loading state
  translateBtn.disabled = true;
  translateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Translating...';
  
  try {
    // For development/testing without backend
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Simulate API call with a delay
      setTimeout(() => {
        targetText.value = `[Translated] ${sourceText.value}`;
        translateBtn.disabled = false;
        translateBtn.innerHTML = 'Translate';
        window.AutoMQM.Core.updateWordCountDisplay();
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
    window.AutoMQM.Core.updateWordCountDisplay();
  } catch (error) {
    console.error('Translation error:', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Reset translate button
    translateBtn.disabled = false;
    translateBtn.innerHTML = 'Translate';
  }
}

/**
 * Initialize translation functionality
 */
function init() {
  // Add event listener for translate button
  if (translateBtn) {
    translateBtn.addEventListener('click', translateText);
  }
  
  // Add event listeners for text inputs
  if (sourceText) {
    sourceText.addEventListener('input', handleSourceLanguageDetection);
  }
  
  if (targetText) {
    targetText.addEventListener('input', handleTargetLanguageDetection);
  }
  
  // Hide translate button in monolingual mode
  document.addEventListener('translation-mode-changed', (event) => {
    if (event.detail && event.detail.mode === 'monolingual' && translateBtn) {
      translateBtn.style.display = 'none';
    } else if (event.detail && event.detail.mode === 'bilingual' && translateBtn) {
      translateBtn.style.display = 'block';
    }
  });
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for use in other modules
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Translation = {
  detectLanguage,
  simulateLanguageDetection,
  handleSourceLanguageDetection,
  handleTargetLanguageDetection,
  getTranslationEngine,
  showTargetLangError,
  updateTranslationEngineInfo,
  translateText,
  init
};
