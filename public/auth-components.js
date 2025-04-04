// auth-components.js - Authentication and user management system

document.addEventListener('DOMContentLoaded', () => {
  // Initialize authentication UI elements
  initAuthUIElements();
  
  // Check for existing auth token
  checkAuthStatus();

  // Set up event listeners for authentication actions
  setupAuthEventListeners();
});

// Get all the UI elements we need to manipulate
function initAuthUIElements() {
  // Modal elements
  window.loginModal = document.getElementById('login-modal');
  window.registerModal = document.getElementById('register-modal');
  window.accountModal = document.getElementById('account-modal');
  window.dashboardModal = document.getElementById('dashboard-modal');
  window.subscriptionModal = document.getElementById('subscription-modal');
  window.adminModal = document.getElementById('admin-modal');

  // Auth buttons
  window.loginBtn = document.getElementById('login-btn');
  window.registerBtn = document.getElementById('register-btn');
  window.logoutLink = document.getElementById('logout-link');
  window.accountLink = document.getElementById('account-link');
  window.dashboardLink = document.getElementById('dashboard-link');
  window.adminLink = document.getElementById('admin-link');

  // Usage info
  window.usageInfo = document.getElementById('usage-info');
  window.usageProgress = document.getElementById('usage-progress');
  
  // Auth containers
  window.authButtons = document.getElementById('auth-buttons');
  window.userInfo = document.getElementById('user-info');
  window.userAvatar = document.getElementById('user-avatar');
  window.userName = document.getElementById('user-name');
}

// Setup event listeners for auth-related actions
function setupAuthEventListeners() {
  // Modal open buttons
  if (loginBtn) loginBtn.addEventListener('click', () => showModal(loginModal));
  if (registerBtn) registerBtn.addEventListener('click', () => showModal(registerModal));
  if (accountLink) accountLink.addEventListener('click', (e) => {
    e.preventDefault();
    showAccountModal();
  });
  if (dashboardLink) dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    showDashboardModal();
  });
  if (adminLink) adminLink.addEventListener('click', (e) => {
    e.preventDefault();
    showAdminModal();
  });
  if (logoutLink) logoutLink.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });

  // Modal close buttons
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) hideModal(modal);
    });
  });

  // Form submissions
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('register-form');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const subscriptionForm = document.getElementById('subscription-form');
  if (subscriptionForm) subscriptionForm.addEventListener('submit', handleSubscription);

  // Plan selection in subscription modal
  document.querySelectorAll('.plan-option').forEach(plan => {
    plan.addEventListener('click', () => {
      // First deselect all plans
      document.querySelectorAll('.plan-option').forEach(p => {
        p.classList.remove('selected');
      });
      
      // Select the clicked plan
      plan.classList.add('selected');
      
      // Set the radio button
      const radio = plan.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      
      // Show card section if premium plan is selected
      const cardSection = document.getElementById('card-section');
      if (cardSection) {
        cardSection.style.display = radio.value === 'premium' ? 'block' : 'none';
      }
    });
  });

  // Dashboard tabs
  document.querySelectorAll('.dashboard-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      document.querySelectorAll('.dashboard-tab').forEach(t => {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      
      // Load appropriate content
      const tabType = tab.getAttribute('data-tab');
      if (tabType === 'saved') {
        loadSavedAssessments();
      } else if (tabType === 'recent') {
        loadRecentActivity();
      }
    });
  });
}

// Check if user is already authenticated
function checkAuthStatus() {
  const token = localStorage.getItem('authToken');
  
  if (token) {
    // Validate token with server
    fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.valid) {
        // Token is valid
        window.authState = {
          isAuthenticated: true,
          user: data.user,
          token: token,
          accountType: data.user.accountType,
          runsUsed: data.runsUsed || 0,
          runLimit: getRunLimit(data.user.accountType)
        };
      } else {
        // Token is invalid, reset auth state
        resetAuthState();
        localStorage.removeItem('authToken');
      }
      updateAuthUI();
    })
    .catch(error => {
      console.error('Error verifying auth token:', error);
      resetAuthState();
      localStorage.removeItem('authToken');
      updateAuthUI();
    });
  } else {
    // No token, user is not authenticated
    resetAuthState();
    updateAuthUI();
  }
}

// Reset authentication state
function resetAuthState() {
  window.authState = {
    isAuthenticated: false,
    user: null,
    token: null,
    accountType: 'anonymous',
    runsUsed: 0,
    runLimit: 5 // Default for anonymous users
  };
}

// Initialize authState if not already defined
if (!window.authState) {
  resetAuthState();
}

// Get run limit based on account type
function getRunLimit(accountType) {
  switch (accountType) {
    case 'free':
      return 25;
    case 'paid':
    case 'admin':
      return Infinity;
    default:
      return 5; // Anonymous users
  }
}

// Update UI based on authentication state
function updateAuthUI() {
  if (!authButtons || !userInfo || !usageInfo) return;
  
  if (window.authState.isAuthenticated) {
    // User is authenticated - show user info
    authButtons.style.display = 'none';
    userInfo.style.display = 'flex';
    
    // Update user info
    if (userName && userAvatar) {
      userName.textContent = window.authState.user.email;
      userAvatar.textContent = window.authState.user.email.charAt(0).toUpperCase();
    }
    
    // Show admin link if user is admin
    if (adminLink) {
      adminLink.style.display = window.authState.accountType === 'admin' ? 'inline' : 'none';
    }
  } else {
    // User is not authenticated - show login/register buttons
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
  }
  
  // Update usage info
  const accountTypeEl = usageInfo.querySelector('.account-type');
  const usageCountEl = usageInfo.querySelector('.usage-count');
  
  if (accountTypeEl) {
    if (window.authState.isAuthenticated) {
      const accountTypeText = window.authState.accountType.charAt(0).toUpperCase() + window.authState.accountType.slice(1);
      accountTypeEl.textContent = `${accountTypeText} Account`;
    } else {
      accountTypeEl.textContent = 'Anonymous User';
    }
  }
  
  if (usageCountEl) {
    if (window.authState.accountType === 'admin' || window.authState.accountType === 'paid') {
      usageCountEl.textContent = `${window.authState.runsUsed} runs (Unlimited)`;
    } else {
      usageCountEl.textContent = `${window.authState.runsUsed} of ${window.authState.runLimit} runs used`;
    }
  }
  
  // Update progress bar
  if (usageProgress) {
    if (window.authState.accountType === 'admin' || window.authState.accountType === 'paid') {
      usageProgress.style.width = '100%';
      usageProgress.style.backgroundColor = 'var(--severity-success)';
    } else {
      const percentage = Math.min(100, (window.authState.runsUsed / window.authState.runLimit) * 100);
      usageProgress.style.width = `${percentage}%`;
      
      // Color based on usage
      if (percentage > 90) {
        usageProgress.style.backgroundColor = 'var(--severity-critical)';
      } else if (percentage > 70) {
        usageProgress.style.backgroundColor = 'var(--severity-major)';
      } else {
        usageProgress.style.backgroundColor = 'var(--brand-teal)';
      }
    }
  }
  
  // Update save button display (if it exists and we have a current run)
  const saveRunBtn = document.getElementById('save-run-btn');
  if (saveRunBtn && window.currentRunId) {
    saveRunBtn.style.display = window.authState.isAuthenticated ? 'block' : 'none';
  }
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const errorEl = document.getElementById('login-error');
  
  // Validate inputs
  if (!emailInput.value || !passwordInput.value) {
    errorEl.textContent = 'Please enter both email and password';
    return;
  }
  
  // Clear previous errors
  errorEl.textContent = '';
  
  // Show loading state
  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner">⟳</span> Logging in...';
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store token in localStorage
      localStorage.setItem('authToken', data.token);
      
      // Update auth state
      window.authState = {
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        accountType: data.user.accountType,
        runsUsed: data.runsUsed || 0,
        runLimit: getRunLimit(data.user.accountType)
      };
      
      // Update UI
      updateAuthUI();
      
      // Hide login modal
      hideModal(loginModal);
      
      // Reset form
      event.target.reset();
    } else {
      // Login failed
      errorEl.textContent = data.message || 'Login failed. Please check your credentials.';
    }
  } catch (error) {
    console.error('Login error:', error);
    errorEl.textContent = 'An error occurred. Please try again.';
  } finally {
    // Reset button state
    submitButton.disabled = false;
    submitButton.textContent = 'Log In';
  }
}

// Handle registration form submission
async function handleRegister(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const confirmInput = document.getElementById('register-confirm-password');
  const errorEl = document.getElementById('register-error');
  
  // Validate inputs
  if (!emailInput.value || !passwordInput.value || !confirmInput.value) {
    errorEl.textContent = 'Please fill in all fields';
    return;
  }
  
  if (passwordInput.value !== confirmInput.value) {
    errorEl.textContent = 'Passwords do not match';
    return;
  }
  
  // Clear previous errors
  errorEl.textContent = '';
  
  // Show loading state
  const submitButton = event.target.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="spinner">⟳</span> Registering...';
  
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: emailInput.value,
        password: passwordInput.value
      })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Store token in localStorage
      localStorage.setItem('authToken', data.token);
      
      // Update auth state
      window.authState = {
        isAuthenticated: true,
        user: data.user,
        token: data.token,
        accountType: 'free', // New users start with free account
        runsUsed: 0,
        runLimit: 25 // Free users get 25 runs
      };
      
      // Update UI
      updateAuthUI();
      
      // Hide register modal
      hideModal(registerModal);
      
      // Reset form
      event.target.reset();
      
      // Show welcome message
      alert('Registration successful! Welcome to MQM Analysis Tool.');
    } else {
      // Registration failed
      errorEl.textContent = data.message || 'Registration failed. Please try again.';
    }
  } catch (error) {
    console.error('Registration error:', error);
    errorEl.textContent = 'An error occurred. Please try again.';
  } finally {
    // Reset button state
    submitButton.disabled = false;
    submitButton.textContent = 'Register';
  }
}

// Handle subscription form submission
async function handleSubscription(event) {
  event.preventDefault();
  
  if (!window.authState.isAuthenticated) {
    showModal(loginModal);
    return;
  }
  
  const planRadios = document.getElementsByName('subscription-plan');
  let selectedPlan = null;
  
  for (const radio of planRadios) {
    if (radio.checked) {
      selectedPlan = radio.value;
      break;
    }
  }
  
  if (!selectedPlan) {
    return; // No plan selected
  }
  
  if (selectedPlan === 'free') {
    // Downgrading to free plan - just update account
    try {
      const response = await fetch('/api/subscriptions/downgrade', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${window.authState.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to downgrade subscription');
      }
      
      // Update auth state
      window.authState.accountType = 'free';
      window.authState.runLimit = 25;
      
      // Update UI
      updateAuthUI();
      
      // Hide modal
      hideModal(subscriptionModal);
      
      alert('Your account has been updated to the Free plan.');
    } catch (error) {
      console.error('Downgrade error:', error);
      alert('Failed to update subscription. Please try again.');
    }
    
    return;
  }
  
  // For premium plan, use Stripe
  const stripePublicKey = document.querySelector('meta[name="stripe-public-key"]').content;
  if (!stripePublicKey) {
    alert('Stripe configuration is missing. Please contact support.');
    return;
  }
  
  try {
    const stripe = Stripe(stripePublicKey);
    
    // If we don't have card element yet, create it
    if (!window.cardElement) {
      const elements = stripe.elements();
      const cardElement = elements.create('card');
      cardElement.mount('#card-element');
      window.cardElement = cardElement;
    }
    
    // Show card section
    document.getElementById('card-section').style.display = 'block';
    
    // Disable submit button during processing
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    
    // Create payment method
    const {error, paymentMethod} = await stripe.createPaymentMethod({
      type: 'card',
      card: window.cardElement
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Send payment method to server
    const response = await fetch('/api/subscriptions/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentMethodId: paymentMethod.id,
        plan: selectedPlan
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Subscription failed');
    }
    
    const data = await response.json();
    
    // Update auth state
    window.authState.accountType = 'paid';
    window.authState.runLimit = Infinity;
    
    // Update UI
    updateAuthUI();
    
    // Hide modal
    hideModal(subscriptionModal);
    
    alert('Subscription successful! You now have unlimited access.');
  } catch (error) {
    console.error('Subscription error:', error);
    const errorEl = document.getElementById('subscription-error');
    errorEl.textContent = error.message || 'Subscription failed. Please try again.';
  } finally {
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = 'Subscribe';
  }
}

// Log out user
function logout() {
  // Clear auth token
  localStorage.removeItem('authToken');
  
  // Reset auth state
  resetAuthState();
  
  // Update UI
  updateAuthUI();
  
  // Hide any open modals
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    hideModal(modal);
  });
}

// Show login modal
function showLoginModal() {
  showModal(loginModal);
  
  // Focus on email input
  const emailInput = document.getElementById('login-email');
  if (emailInput) emailInput.focus();
}

// Show register modal
function showRegisterModal() {
  showModal(registerModal);
  
  // Focus on email input
  const emailInput = document.getElementById('register-email');
  if (emailInput) emailInput.focus();
}

// Show account modal
function showAccountModal() {
  if (!window.authState.isAuthenticated) {
    showLoginModal();
    return;
  }
  
  // Update account info with latest data
  document.getElementById('account-email').textContent = window.authState.user.email;
  document.getElementById('account-type').textContent = window.authState.accountType.charAt(0).toUpperCase() + window.authState.accountType.slice(1);
  
  if (window.authState.accountType === 'admin' || window.authState.accountType === 'paid') {
    document.getElementById('account-usage').textContent = `${window.authState.runsUsed} runs (Unlimited)`;
  } else {
    document.getElementById('account-usage').textContent = `${window.authState.runsUsed} of ${window.authState.runLimit} runs`;
  }
  
  // Show/hide upgrade button
  const upgradeBtn = document.getElementById('upgrade-btn');
  if (upgradeBtn) {
    upgradeBtn.style.display = (window.authState.accountType === 'paid' || window.authState.accountType === 'admin') ? 'none' : 'block';
  }
  
  showModal(accountModal);
}

// Show dashboard modal
function showDashboardModal() {
  if (!window.authState.isAuthenticated) {
    showLoginModal();
    return;
  }
  
  showModal(dashboardModal);
  
  // Load saved assessments by default
  loadSavedAssessments();
}

// Show admin modal
function showAdminModal() {
  if (!window.authState.isAuthenticated || window.authState.accountType !== 'admin') {
    return;
  }
  
  showModal(adminModal);
  
  // Load admin data
  loadAdminData();
}

// Show modal and hide others
function showModal(modal) {
  if (!modal) return;
  
  // Hide all other modals
  document.querySelectorAll('.modal-overlay').forEach(m => {
    if (m !== modal) {
      m.style.display = 'none';
    }
  });
  
  // Show selected modal
  modal.style.display = 'flex';
}

// Hide modal
function hideModal(modal) {
  if (!modal) return;
  modal.style.display = 'none';
}

// Load saved assessments for dashboard
async function loadSavedAssessments() {
  if (!window.authState.isAuthenticated) return;
  
  const container = document.getElementById('saved-runs-container');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<p class="text-center mt-4">Loading your assessments...</p>';
  
  try {
    const response = await fetch('/api/runs/saved', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load saved assessments');
    }
    
    const data = await response.json();
    const runs = data.runs || [];
    
    if (runs.length === 0) {
      container.innerHTML = '<div class="run-list-empty">You haven\'t saved any assessments yet.</div>';
      return;
    }
    
    // Build HTML for saved runs
    let html = '';
    
    runs.forEach(run => {
      const date = new Date(run.timestamp).toLocaleDateString();
      const time = new Date(run.timestamp).toLocaleTimeString();
      const languages = `${run.sourceLang || '?'} → ${run.targetLang || '?'}`;
      const wordCount = run.wordCount || 0;
      
      html += `
        <div class="run-item" data-run-id="${run._id}">
          <div class="run-header">
            <div class="run-title">${languages} (${wordCount} words)</div>
            <div class="run-date">${date} ${time}</div>
          </div>
          <div class="run-details">
            <div class="run-score">
              Score: <strong>${run.mqmScore.toFixed(1)}</strong>
            </div>
            <div class="run-actions">
              <button class="run-action-btn" onclick="viewRun('${run._id}')">View</button>
              <button class="run-action-btn" onclick="deleteRun('${run._id}')">Delete</button>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading saved assessments:', error);
    container.innerHTML = '<div class="run-list-empty">Error loading assessments. Please try again.</div>';
  }
}

// Load recent activity for dashboard
async function loadRecentActivity() {
  if (!window.authState.isAuthenticated) return;
  
  const container = document.getElementById('saved-runs-container');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<p class="text-center mt-4">Loading recent activity...</p>';
  
  try {
    const response = await fetch('/api/runs/recent', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load recent activity');
    }
    
    const data = await response.json();
    const runs = data.runs || [];
    
    if (runs.length === 0) {
      container.innerHTML = '<div class="run-list-empty">No recent activity found.</div>';
      return;
    }
    
    // Build HTML for recent runs
    let html = '';
    
    runs.forEach(run => {
      const date = new Date(run.timestamp).toLocaleDateString();
      const time = new Date(run.timestamp).toLocaleTimeString();
      const languages = `${run.sourceLang || '?'} → ${run.targetLang || '?'}`;
      const wordCount = run.wordCount || 0;
      const saved = run.saved ? '(Saved)' : '';
      
      html += `
        <div class="run-item" data-run-id="${run._id}">
          <div class="run-header">
            <div class="run-title">${languages} (${wordCount} words) ${saved}</div>
            <div class="run-date">${date} ${time}</div>
          </div>
          <div class="run-details">
            <div class="run-score">
              Score: <strong>${run.mqmScore.toFixed(1)}</strong>
            </div>
            <div class="run-actions">
              <button class="run-action-btn" onclick="viewRun('${run._id}')">View</button>
              ${!run.saved ? `<button class="run-action-btn" onclick="saveRun('${run._id}')">Save</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading recent activity:', error);
    container.innerHTML = '<div class="run-list-empty">Error loading activity. Please try again.</div>';
  }
}

// Save the current run
async function saveCurrentRun(runId) {
  if (!window.authState.isAuthenticated || !runId) {
    showLoginModal();
    return;
  }
  
  const saveBtn = document.getElementById('save-run-btn');
  try {
    // Show loading state
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }
    
    const response = await fetch(`/api/runs/${runId}/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to save assessment');
    }
    
    // Update button state
    if (saveBtn) {
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = 'Save Assessment';
        saveBtn.disabled = false;
      }, 2000);
    }
  } catch (error) {
    console.error('Error saving assessment:', error);
    
    // Update button state
    if (saveBtn) {
      saveBtn.textContent = 'Save Failed';
      setTimeout(() => {
        saveBtn.textContent = 'Save Assessment';
        saveBtn.disabled = false;
      }, 2000);
    }
  }
}

// Delete a saved run
async function deleteRun(runId) {
  if (!window.authState.isAuthenticated || !runId) {
    return;
  }
  
  // Confirm deletion
  if (!confirm('Are you sure you want to delete this assessment?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/runs/${runId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete assessment');
    }
    
    // Refresh the dashboard
    loadSavedAssessments();
  } catch (error) {
    console.error('Error deleting assessment:', error);
    alert('Failed to delete assessment. Please try again.');
  }
}

// View a run from dashboard
async function viewRun(runId) {
  if (!window.authState.isAuthenticated || !runId) {
    return;
  }
  
  try {
    const response = await fetch(`/api/runs/${runId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load assessment');
    }
    
    const run = await response.json();
    
    // Populate form with run data
    const sourceText = document.getElementById('source-text');
    const targetText = document.getElementById('target-text');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    
    if (sourceText) sourceText.value = run.sourceText || '';
    if (targetText) targetText.value = run.targetText || '';
    
    if (sourceLang && run.sourceLang) {
      sourceLang.value = run.sourceLang;
      
      // Update language detection display
      const sourceLangDetected = document.getElementById('source-lang-detected');
      if (sourceLangDetected) {
        const flag = getLanguageFlag(run.sourceLang);
        const name = getLanguageName(run.sourceLang);
        sourceLangDetected.textContent = `Selected: ${flag} ${name}`;
      }
    }
    
    if (targetLang && run.targetLang) {
      targetLang.value = run.targetLang;
      
      // Update language detection display
      const targetLangDetected = document.getElementById('target-lang-detected');
      if (targetLangDetected) {
        const flag = getLanguageFlag(run.targetLang);
        const name = getLanguageName(run.targetLang);
        targetLangDetected.textContent = `Selected: ${flag} ${name}`;
      }
    }
    
    // Update word count
    const updateWordCount = window.updateWordCountDisplay;
    if (typeof updateWordCount === 'function') {
      updateWordCount();
    }
    
    // Display results
    const displayResults = window.displayResults;
    if (typeof displayResults === 'function') {
      displayResults({
        mqmIssues: run.issues || [],
        categories: run.categories || {},
        wordCount: run.wordCount || 0,
        overallScore: run.mqmScore || 100,
        summary: run.summary || 'Assessment loaded from saved run.',
        _id: run._id
      });
    }
    
    // Highlight issues in text
    const highlightIssues = window.highlightIssuesInText;
    if (typeof highlightIssues === 'function' && run.targetText && run.issues) {
      highlightIssues(run.targetText, run.issues);
    }
    
    // Store current run data
    window.currentIssues = run.issues || [];
    window.currentTargetText = run.targetText || '';
    window.currentRunId = run._id;
    
    // Show apply all button and undo button if there are issues
    const applyAllBtn = document.getElementById('apply-all-btn');
    const undoBtn = document.getElementById('undo-btn');
    
    if (applyAllBtn && undoBtn && run.issues && run.issues.length > 0) {
      applyAllBtn.style.display = 'block';
      undoBtn.style.display = 'block';
      undoBtn.disabled = true; // Initially disabled until changes are made
    }
    
    // Hide the dashboard modal
    hideModal(dashboardModal);
    
    // Scroll to results
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (error) {
    console.error('Error loading assessment:', error);
    alert('Failed to load assessment. Please try again.');
  }
}

// Save a run from the recent list
async function saveRun(runId) {
  if (!window.authState.isAuthenticated || !runId) {
    return;
  }
  
  try {
    const response = await fetch(`/api/runs/${runId}/save`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to save assessment');
    }
    
    // Refresh the dashboard
    const activeTab = document.querySelector('.dashboard-tab.active');
    if (activeTab) {
      const tabType = activeTab.getAttribute('data-tab');
      if (tabType === 'recent') {
        loadRecentActivity();
      } else {
        loadSavedAssessments();
      }
    }
  } catch (error) {
    console.error('Error saving assessment:', error);
    alert('Failed to save assessment. Please try again.');
  }
}

// Load admin dashboard data
async function loadAdminData() {
  if (!window.authState.isAuthenticated || window.authState.accountType !== 'admin') {
    return;
  }
  
  const container = document.getElementById('admin-user-list');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<p class="text-center mt-4">Loading users...</p>';
  
  try {
    const response = await fetch('/api/admin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load user data');
    }
    
    const data = await response.json();
    const users = data.users || [];
    
    if (users.length === 0) {
      container.innerHTML = '<div class="run-list-empty">No users found.</div>';
      return;
    }
    
    // Build HTML for users
    let html = '<table style="width: 100%; border-collapse: collapse;">';
    html += '<tr style="border-bottom: 1px solid var(--border-light); font-weight: 500;">';
    html += '<th style="text-align: left; padding: 10px;">Email</th>';
    html += '<th style="text-align: left; padding: 10px;">Account Type</th>';
    html += '<th style="text-align: left; padding: 10px;">Runs Used</th>';
    html += '<th style="text-align: left; padding: 10px;">Actions</th>';
    html += '</tr>';
    
    users.forEach(user => {
      html += '<tr style="border-bottom: 1px solid var(--border-light);">';
      html += `<td style="padding: 10px;">${user.email}</td>`;
      html += `<td style="padding: 10px;">${user.accountType}</td>`;
      html += `<td style="padding: 10px;">${user.runsUsed || 0}</td>`;
      html += '<td style="padding: 10px;">';
      html += `<button class="run-action-btn" onclick="changeUserType('${user._id}', 'free')">Set Free</button>`;
      html += `<button class="run-action-btn" onclick="changeUserType('${user._id}', 'paid')">Set Paid</button>`;
      html += `<button class="run-action-btn" onclick="changeUserType('${user._id}', 'admin')">Set Admin</button>`;
      html += '</td>';
      html += '</tr>';
    });
    
    html += '</table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('Error loading admin data:', error);
    container.innerHTML = '<div class="run-list-empty">Error loading user data. Please try again.</div>';
  }
}

// Change user account type (admin function)
async function changeUserType(userId, accountType) {
  if (!window.authState.isAuthenticated || window.authState.accountType !== 'admin') {
    return;
  }
  
  try {
    const response = await fetch(`/api/admin/users/${userId}/account-type`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${window.authState.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accountType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user account type');
    }
    
    // Refresh admin data
    loadAdminData();
  } catch (error) {
    console.error('Error updating user account type:', error);
    alert('Failed to update user account type. Please try again.');
  }
}

// Helper functions for language display
function getLanguageFlag(code) {
  // Extract main language code for regional variants
  const mainCode = code.split('-')[0];
  
  // Define flags for all language codes
  const flags = {
    en: '🇬🇧', // Default English flag
    'en-US': '🇺🇸',
    'en-GB': '🇬🇧',
    'en-CA': '🇨🇦',
    'en-AU': '🇦🇺',
    
    es: '🇪🇸',
    'es-ES': '🇪🇸',
    'es-MX': '🇲🇽',
    'es-CO': '🇨🇴',
    'es-AR': '🇦🇷',
    
    fr: '🇫🇷',
    'fr-FR': '🇫🇷',
    'fr-CA': '🇨🇦',
    'fr-BE': '🇧🇪',
    'fr-CH': '🇨🇭',
    
    pt: '🇵🇹',
    'pt-PT': '🇵🇹',
    'pt-BR': '🇧🇷',
    
    zh: '🇨🇳',
    'zh-CN': '🇨🇳',
    'zh-TW': '🇹🇼',
    'zh-HK': '🇭🇰',
    'zh-SG': '🇸🇬',
    
    ar: '🇸🇦',
    'ar-SA': '🇸🇦',
    'ar-EG': '🇪🇬',
    'ar-AE': '🇦🇪',
    'ar-MA': '🇲🇦',
    
    de: '🇩🇪',
    'de-DE': '🇩🇪',
    'de-AT': '🇦🇹',
    'de-CH': '🇨🇭',
    
    it: '🇮🇹',
    ja: '🇯🇵',
    ko: '🇰🇷',
    ru: '🇷🇺',
    hi: '🇮🇳',
    bn: '🇧🇩',
    tr: '🇹🇷',
    vi: '🇻🇳',
    pl: '🇵🇱',
    uk: '🇺🇦',
    fa: '🇮🇷',
    nl: '🇳🇱',
    ta: '🇮🇳',
    ur: '🇵🇰',
    th: '🇹🇭',
    ms: '🇲🇾',
    sw: '🇰🇪',
    tl: '🇵🇭',
    he: '🇮🇱',
    ro: '🇷🇴',
    hu: '🇭🇺',
    el: '🇬🇷',
    cs: '🇨🇿',
    sv: '🇸🇪',
    da: '🇩🇰',
    fi: '🇫🇮',
    no: '🇳🇴',
    id: '🇮🇩',
    sr: '🇷🇸',
    sk: '🇸🇰',
    bg: '🇧🇬',
    hr: '🇭🇷',
    sl: '🇸🇮',
    et: '🇪🇪',
    lv: '🇱🇻',
    lt: '🇱🇹'
  };
  
  return flags[code] || flags[mainCode] || '🏳️';
}

function getLanguageName(code) {
  // Fallback language names
  const names = {
    en: 'English',
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'en-CA': 'English (Canada)',
    'en-AU': 'English (Australia)',
    
    es: 'Spanish',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'es-CO': 'Spanish (Colombia)',
    'es-AR': 'Spanish (Argentina)',
    
    fr: 'French',
    'fr-FR': 'French (France)',
    'fr-CA': 'French (Canada)',
    'fr-BE': 'French (Belgium)',
    'fr-CH': 'French (Switzerland)',
    
    pt: 'Portuguese',
    'pt-PT': 'Portuguese (Portugal)',
    'pt-BR': 'Portuguese (Brazil)',
    
    zh: 'Chinese',
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional, Taiwan)',
    'zh-HK': 'Chinese (Hong Kong)',
    'zh-SG': 'Chinese (Singapore)',
    
    ar: 'Arabic',
    'ar-SA': 'Arabic (Saudi Arabia)',
    'ar-EG': 'Arabic (Egypt)',
    'ar-AE': 'Arabic (UAE)',
    'ar-MA': 'Arabic (Morocco)',
    
    de: 'German',
    'de-DE': 'German (Germany)',
    'de-AT': 'German (Austria)',
    'de-CH': 'German (Switzerland)',
    
    it: 'Italian',
    ja: 'Japanese',
    ko: 'Korean',
    ru: 'Russian',
    hi: 'Hindi',
    bn: 'Bengali',
    tr: 'Turkish',
    vi: 'Vietnamese',
    pl: 'Polish',
    uk: 'Ukrainian',
    fa: 'Persian',
    nl: 'Dutch',
    ta: 'Tamil',
    ur: 'Urdu',
    th: 'Thai',
    ms: 'Malay',
    sw: 'Swahili',
    tl: 'Tagalog',
    he: 'Hebrew',
    ro: 'Romanian',
    hu: 'Hungarian',
    el: 'Greek',
    cs: 'Czech',
    sv: 'Swedish',
    da: 'Danish',
    fi: 'Finnish',
    no: 'Norwegian',
    id: 'Indonesian',
    sr: 'Serbian',
    sk: 'Slovak',
    bg: 'Bulgarian',
    hr: 'Croatian',
    sl: 'Slovenian',
    et: 'Estonian',
    lv: 'Latvian',
    lt: 'Lithuanian'
  };
  
  // Extract main language code for regional variants
  const mainCode = code.split('-')[0];
  
  return names[code] || names[mainCode] || 'Unknown';
}

// Expose global functions
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.showAccountModal = showAccountModal;
window.showDashboardModal = showDashboardModal;
window.showSubscriptionModal = showSubscriptionModal;
window.showAdminModal = showAdminModal;
window.hideModal = hideModal;
window.logout = logout;
window.saveCurrentRun = saveCurrentRun;
window.saveRun = saveRun;
window.viewRun = viewRun;
window.deleteRun = deleteRun;
window.changeUserType = changeUserType;