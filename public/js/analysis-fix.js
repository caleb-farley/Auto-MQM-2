/**
 * Analysis Functionality Fix for Auto-MQM
 * Fixes issues with the analysis results display and correction functionality
 */

(function() {
  console.log('Analysis fix loaded');
  
  // Wait for DOM to be fully loaded
  function initAnalysisFix() {
    console.log('Initializing analysis fix');
    
    // Get DOM elements
    const analyzeBtn = document.getElementById('analyze-btn');
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const llmModelSelect = document.getElementById('llm-model');
    const resultsContainer = document.getElementById('results-container');
    const loadingIndicator = document.getElementById('analysis-loading-indicator');
    const translationModeToggle = document.getElementById('translation-mode-toggle');
    const correctedTextContainer = document.getElementById('corrected-text-container');
    const correctedTextArea = document.getElementById('corrected-text');
    
    // Store original text and corrections
    let originalText = '';
    let corrections = [];
    let currentResults = null;
    
    // Check if elements exist
    if (!analyzeBtn || !targetText) {
      console.error('Analysis elements not found');
      return;
    }
    
    // Override the runAnalysis function
    if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.runAnalysis) {
      // Store the original function
      const originalRunAnalysis = window.AutoMQM.Analysis.runAnalysis;
      
      // Override with our fixed version
      window.AutoMQM.Analysis.runAnalysis = function() {
        console.log('Running fixed analysis');
        return originalRunAnalysis.apply(this, arguments);
      };
    }
    
    // Override the displayResults function
    if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.displayResults) {
      // Store the original function
      const originalDisplayResults = window.AutoMQM.Analysis.displayResults;
      
      // Override with our fixed version
      window.AutoMQM.Analysis.displayResults = function(results) {
        console.log('Displaying fixed analysis results');
        
        // Store current results for later use
        currentResults = results;
        
        // Store original text for corrections
        originalText = targetText.value;
        corrections = [];
        
        // Show results container
        resultsContainer.style.display = 'block';
        
        // Create results HTML
        let html = `
          <div class="results-header">
            <h2 class="results-title gothic-title">MQM Analysis Results</h2>
            <div class="score-container">
              <div class="score-label">Overall Score</div>
              <div class="score-value">${results.overallScore.toFixed(2)}</div>
            </div>
          </div>
          
          <div class="summary">
            <p>${results.summary}</p>
          </div>
        `;
        
        // Add categories section if available
        if (results.categories && Object.keys(results.categories).length > 0) {
          html += '<div class="categories">';
          
          for (const [category, stats] of Object.entries(results.categories)) {
            html += `
              <div class="category">
                <h3 class="category-title">${category}</h3>
                <div class="category-stats">
            `;
            
            for (const [subcategory, count] of Object.entries(stats)) {
              html += `
                <div class="stat-item">
                  <div class="stat-label">${subcategory}</div>
                  <div class="stat-value">${count}</div>
                </div>
              `;
            }
            
            html += '</div></div>';
          }
          
          html += '</div>';
        }
        
        // Add issues section if available
        if (results.mqmIssues && results.mqmIssues.length > 0) {
          html += `
            <div class="issues-header" style="display: flex; justify-content: space-between; align-items: center; margin: 20px 0 15px;">
              <h3 class="gothic-title" style="margin: 0; font-size: 18px;">Issues Found (${results.mqmIssues.length})</h3>
              <div class="issues-actions" style="display: flex; gap: 10px;">
                <button id="apply-all-btn" class="btn btn-primary">Apply All Fixes</button>
                <button id="undo-btn" class="btn btn-secondary">Undo Changes</button>
              </div>
            </div>
            <div class="issues-list">
          `;
          
          // Add each issue
          results.mqmIssues.forEach((issue, index) => {
            // Assign an ID to each issue
            issue.id = index;
            
            html += `
              <div class="issue" data-issue-id="${index}">
                <div class="issue-header">
                  <h4 class="issue-title">${issue.category}: ${issue.subcategory}</h4>
                  <span class="issue-severity ${issue.severity.toLowerCase()}">${issue.severity}</span>
                </div>
                <div class="issue-content">
                  <div class="issue-segment">${issue.segment}</div>
                  <div class="issue-explanation">${issue.explanation}</div>
                  ${issue.suggestion ? `<div class="issue-suggestion">Suggestion: ${issue.suggestion}</div>` : ''}
                </div>
                <div class="issue-actions">
                  ${issue.suggestion ? `<button class="btn btn-primary action-btn apply-fix-btn" data-issue-id="${index}">Apply Fix</button>` : ''}
                  <button class="btn btn-secondary action-btn ignore-btn" data-issue-id="${index}">Ignore</button>
                </div>
              </div>
            `;
          });
          
          html += '</div>';
          
          // Show apply all button and undo button if there are issues
          const applyAllBtn = document.getElementById('apply-all-btn');
          const undoBtn = document.getElementById('undo-btn');
          if (applyAllBtn) applyAllBtn.style.display = 'block';
          if (undoBtn) undoBtn.style.display = 'block';
        } else {
          html += `
            <div class="no-issues" style="margin-top: 20px; padding: 15px; background-color: var(--bg-success); border-radius: 8px; color: var(--text-primary);">
              <p style="margin: 0;">No issues found! The text appears to be of good quality.</p>
            </div>
          `;
          
          // Hide apply all button and undo button if there are no issues
          const applyAllBtn = document.getElementById('apply-all-btn');
          const undoBtn = document.getElementById('undo-btn');
          if (applyAllBtn) applyAllBtn.style.display = 'none';
          if (undoBtn) undoBtn.style.display = 'none';
        }
        
        // Set results HTML
        resultsContainer.innerHTML = html;
        
        // Add event listeners for issue actions
        document.querySelectorAll('.apply-fix-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const issueId = parseInt(this.getAttribute('data-issue-id'));
            applyFix(results.mqmIssues[issueId]);
          });
        });
        
        document.querySelectorAll('.ignore-btn').forEach(btn => {
          btn.addEventListener('click', function() {
            const issueId = parseInt(this.getAttribute('data-issue-id'));
            ignoreIssue(issueId);
          });
        });
        
        // Add event listener for apply all button
        const applyAllButton = document.getElementById('apply-all-btn');
        if (applyAllButton) {
          applyAllButton.addEventListener('click', function() {
            applyAllFixes(results.mqmIssues);
          });
        }
        
        // Add event listener for undo button
        const undoButton = document.getElementById('undo-btn');
        if (undoButton) {
          undoButton.addEventListener('click', function() {
            undoChanges();
          });
        }
        
        // Scroll to results
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
      };
    }
    
    // Apply fix for a single issue
    function applyFix(issue) {
      if (!issue || !issue.suggestion) return;
      
      console.log('Applying fix for issue:', issue);
      
      // Store original text if this is the first correction
      if (corrections.length === 0) {
        originalText = targetText.value;
      }
      
      // Add to corrections array
      corrections.push({
        segment: issue.segment,
        suggestion: issue.suggestion
      });
      
      // Apply the fix
      const escapedSegment = escapeRegExp(issue.segment);
      const regex = new RegExp(escapedSegment, 'g');
      targetText.value = targetText.value.replace(regex, issue.suggestion);
      
      // Show corrected text container
      if (correctedTextContainer) correctedTextContainer.style.display = 'block';
      if (correctedTextArea) correctedTextArea.value = targetText.value;
      
      // Update word count
      if (window.AutoMQM && window.AutoMQM.Core && window.AutoMQM.Core.updateWordCountDisplay) {
        window.AutoMQM.Core.updateWordCountDisplay();
      }
      
      // Highlight the issue as fixed
      const issueElement = document.querySelector(`.issue[data-issue-id="${issue.id}"]`);
      if (issueElement) {
        issueElement.classList.add('fixed');
        const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
        if (applyFixBtn) applyFixBtn.disabled = true;
      }
    }
    
    // Apply all fixes
    function applyAllFixes(issues) {
      if (!issues || !issues.length) return;
      
      console.log('Applying all fixes');
      
      // Store original text if this is the first correction
      if (corrections.length === 0) {
        originalText = targetText.value;
      }
      
      // Clear corrections array
      corrections = [];
      
      // Apply all fixes
      let updatedText = targetText.value;
      
      issues.forEach(issue => {
        if (issue.suggestion) {
          // Add to corrections array
          corrections.push({
            segment: issue.segment,
            suggestion: issue.suggestion
          });
          
          // Apply the fix
          const escapedSegment = escapeRegExp(issue.segment);
          const regex = new RegExp(escapedSegment, 'g');
          updatedText = updatedText.replace(regex, issue.suggestion);
        }
      });
      
      // Update target text
      targetText.value = updatedText;
      
      // Show corrected text container
      if (correctedTextContainer) correctedTextContainer.style.display = 'block';
      if (correctedTextArea) correctedTextArea.value = targetText.value;
      
      // Update word count
      if (window.AutoMQM && window.AutoMQM.Core && window.AutoMQM.Core.updateWordCountDisplay) {
        window.AutoMQM.Core.updateWordCountDisplay();
      }
      
      // Highlight all issues as fixed
      document.querySelectorAll('.issue').forEach(issueElement => {
        issueElement.classList.add('fixed');
        const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
        if (applyFixBtn) {
          applyFixBtn.disabled = true;
        }
      });
    }
    
    // Ignore an issue
    function ignoreIssue(issueId) {
      console.log('Ignoring issue:', issueId);
      
      const issueElement = document.querySelector(`.issue[data-issue-id="${issueId}"]`);
      if (issueElement) {
        issueElement.classList.add('ignored');
        issueElement.style.opacity = '0.5';
        
        const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
        if (applyFixBtn) {
          applyFixBtn.disabled = true;
        }
        
        const ignoreBtn = issueElement.querySelector('.ignore-btn');
        if (ignoreBtn) {
          ignoreBtn.disabled = true;
        }
      }
    }
    
    // Undo all changes
    function undoChanges() {
      console.log('Undoing all changes');
      
      if (originalText) {
        targetText.value = originalText;
        if (correctedTextArea) correctedTextArea.value = originalText;
        
        // Update word count
        if (window.AutoMQM && window.AutoMQM.Core && window.AutoMQM.Core.updateWordCountDisplay) {
          window.AutoMQM.Core.updateWordCountDisplay();
        }
        
        // Reset corrections
        corrections = [];
        
        // Reset issue elements
        document.querySelectorAll('.issue').forEach(issueElement => {
          issueElement.classList.remove('fixed', 'ignored');
          issueElement.style.opacity = '1';
          
          const applyFixBtn = issueElement.querySelector('.apply-fix-btn');
          if (applyFixBtn) {
            applyFixBtn.disabled = false;
          }
          
          const ignoreBtn = issueElement.querySelector('.ignore-btn');
          if (ignoreBtn) {
            ignoreBtn.disabled = false;
          }
        });
      }
    }
    
    // Escape special characters in regular expressions
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    // Add event listener for analyze button
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', function() {
        console.log('Analyze button clicked');
        if (window.AutoMQM && window.AutoMQM.Analysis && window.AutoMQM.Analysis.runAnalysis) {
          window.AutoMQM.Analysis.runAnalysis();
        }
      });
    }
    
    console.log('Analysis fix initialized successfully');
  }
  
  // Initialize immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalysisFix);
  } else {
    // DOM already loaded, run immediately
    initAnalysisFix();
  }
  
  // Also run after a short delay to ensure everything is loaded
  setTimeout(initAnalysisFix, 500);
})();
