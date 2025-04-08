/**
 * File Upload Functionality for Auto-MQM
 * Handles TMX, XLIFF, and Excel file uploads
 */

(function() {
  console.log('File upload fix loaded');
  
  // Wait for DOM to be fully loaded
  function initFileUpload() {
    console.log('Initializing file upload functionality');
    
    // Get DOM elements
    const fileInput = document.getElementById('excel-file-input');
    const fileSelectBtn = document.getElementById('excel-file-select-btn');
    const fileUploadForm = document.getElementById('excel-upload-form');
    const fileNameDisplay = document.getElementById('selected-file-name');
    const uploadBtn = document.getElementById('excel-upload-btn');
    const downloadTemplateBtn = document.getElementById('download-template-btn');
    
    // Check if elements exist
    if (!fileInput || !fileSelectBtn) {
      console.error('File upload elements not found');
      return;
    }
    
    // Handle file select button click
    fileSelectBtn.addEventListener('click', function() {
      fileInput.click();
    });
    
    // Handle file selection
    fileInput.addEventListener('change', function() {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        console.log('File selected:', file.name);
        
        // Display selected file name
        if (fileNameDisplay) {
          fileNameDisplay.textContent = file.name;
          fileNameDisplay.style.display = 'inline-block';
        } else {
          // Create file name display if it doesn't exist
          const newFileNameDisplay = document.createElement('span');
          newFileNameDisplay.id = 'selected-file-name';
          newFileNameDisplay.className = 'selected-file';
          newFileNameDisplay.textContent = file.name;
          fileSelectBtn.insertAdjacentElement('afterend', newFileNameDisplay);
        }
        
        // Enable upload button if it exists
        if (uploadBtn) {
          uploadBtn.disabled = false;
        }
      }
    });
    
    // Handle form submission
    if (fileUploadForm) {
      fileUploadForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!fileInput.files || fileInput.files.length === 0) {
          showNotification('Please select a file first', 'error');
          return;
        }
        
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        
        // Show loading state
        if (uploadBtn) {
          const originalBtnText = uploadBtn.innerHTML;
          uploadBtn.disabled = true;
          uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Uploading...';
        }
        
        try {
          // For development/testing without backend
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Simulate API call with a delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Parse file based on type
            if (file.name.endsWith('.xlsx')) {
              parseExcelFile(file);
            } else if (file.name.endsWith('.tmx')) {
              parseTMXFile(file);
            } else if (file.name.endsWith('.xliff') || file.name.endsWith('.xlf')) {
              parseXLIFFFile(file);
            } else {
              showNotification('Unsupported file format', 'error');
            }
            
            return;
          }
          
          // Make API request
          const response = await fetch('/api/upload-translation-file', {
            method: 'POST',
            body: formData
          });
          
          // Check if response is ok
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to upload file');
          }
          
          // Parse response
          const result = await response.json();
          
          // Handle successful upload
          if (result.success) {
            showNotification('File uploaded successfully', 'success');
            
            // If the response contains translation data, populate the text areas
            if (result.data && result.data.translations && result.data.translations.length > 0) {
              populateTranslations(result.data.translations);
            }
          } else {
            throw new Error(result.error || 'Failed to process file');
          }
        } catch (error) {
          console.error('File upload error:', error);
          showNotification(`Error: ${error.message}`, 'error');
        } finally {
          // Reset upload button
          if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = 'Upload';
          }
        }
      });
    }
    
    // Handle template download
    if (downloadTemplateBtn) {
      downloadTemplateBtn.addEventListener('click', function() {
        // For development/testing without backend
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          showNotification('Template download not available in development mode', 'info');
          return;
        }
        
        // Download template from server
        window.open('/api/download-template', '_blank');
      });
    }
    
    console.log('File upload functionality initialized successfully');
  }
  
  /**
   * Show notification
   */
  function showNotification(message, type = 'info') {
    if (window.AutoMQM && window.AutoMQM.Utils && window.AutoMQM.Utils.showNotification) {
      window.AutoMQM.Utils.showNotification(message, type);
    } else {
      alert(message);
    }
  }
  
  /**
   * Parse Excel file and populate text areas
   */
  function parseExcelFile(file) {
    // In a real implementation, this would use a library like SheetJS
    // For this demo, we'll simulate parsing
    
    const reader = new FileReader();
    reader.onload = function(e) {
      // Simulate finding translations in the Excel file
      const translations = [
        { source: 'This is a sample source text', target: 'This is a sample target text', sourceLang: 'en', targetLang: 'fr' }
      ];
      
      populateTranslations(translations);
      showNotification('Excel file parsed successfully', 'success');
    };
    
    reader.onerror = function() {
      showNotification('Failed to read Excel file', 'error');
    };
    
    reader.readAsArrayBuffer(file);
  }
  
  /**
   * Parse TMX file and populate text areas
   */
  function parseTMXFile(file) {
    // In a real implementation, this would use XML parsing
    // For this demo, we'll simulate parsing
    
    const reader = new FileReader();
    reader.onload = function(e) {
      // Simulate finding translations in the TMX file
      const translations = [
        { source: 'This is a sample TMX source text', target: 'This is a sample TMX target text', sourceLang: 'en', targetLang: 'de' }
      ];
      
      populateTranslations(translations);
      showNotification('TMX file parsed successfully', 'success');
    };
    
    reader.onerror = function() {
      showNotification('Failed to read TMX file', 'error');
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Parse XLIFF file and populate text areas
   */
  function parseXLIFFFile(file) {
    // In a real implementation, this would use XML parsing
    // For this demo, we'll simulate parsing
    
    const reader = new FileReader();
    reader.onload = function(e) {
      // Simulate finding translations in the XLIFF file
      const translations = [
        { source: 'This is a sample XLIFF source text', target: 'This is a sample XLIFF target text', sourceLang: 'en', targetLang: 'es' }
      ];
      
      populateTranslations(translations);
      showNotification('XLIFF file parsed successfully', 'success');
    };
    
    reader.onerror = function() {
      showNotification('Failed to read XLIFF file', 'error');
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Populate text areas with translations
   */
  function populateTranslations(translations) {
    if (!translations || translations.length === 0) return;
    
    // Get DOM elements
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    
    // Use the first translation
    const translation = translations[0];
    
    // Populate text areas and language dropdowns
    if (sourceText && translation.source) sourceText.value = translation.source;
    if (targetText && translation.target) targetText.value = translation.target;
    if (sourceLang && translation.sourceLang) sourceLang.value = translation.sourceLang;
    if (targetLang && translation.targetLang) targetLang.value = translation.targetLang;
    
    // Update word counts
    if (window.AutoMQM && window.AutoMQM.Core && window.AutoMQM.Core.updateWordCountDisplay) {
      window.AutoMQM.Core.updateWordCountDisplay();
    }
    
    // Update text direction
    if (window.AutoMQM && window.AutoMQM.Core && window.AutoMQM.Core.updateTextDirection) {
      window.AutoMQM.Core.updateTextDirection();
    }
  }
  
  // Initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFileUpload);
  } else {
    // DOM already loaded, run immediately
    initFileUpload();
  }
  
  // Also run after a short delay to ensure everything is loaded
  setTimeout(initFileUpload, 500);
})();
