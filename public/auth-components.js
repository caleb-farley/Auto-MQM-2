// auth-components.js
// Contains functions for authentication, account management, and assessment history

// Global state
const authState = {
  isAuthenticated: false,
  user: null,
  usageCount: 0,
  usageLimit: 5, // Default for anonymous users
  anonymousSessionId: null,
  savedRuns: []
};

// DOM Elements - to be initialized after page load
let loginModal;
let registerModal;
let accountModal;
let dashboardModal;
let subscriptionModal;
let adminModal;

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  checkAuthStatus();

  // Initialize modal references
  loginModal = document.getElementById('login-modal');
  registerModal = document.getElementById('register-modal');
  accountModal = document.getElementById('account-modal');
  dashboardModal = document.getElementById('dashboard-modal');
  subscriptionModal = document.getElementById('subscription-modal');
  adminModal = document.getElementById('admin-modal');

  // Initialize anonymous session if not already set
  initAnonymousSession();

  // Add event listeners for auth buttons
  const loginBtn = document.getElementById('login-btn');
  const registerBtn = document.getElementById('register-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const accountBtn = document.getElementById('account-btn');
  const dashboardBtn = document.getElementById('dashboard-btn');
  const closeModalBtns = document.querySelectorAll('.close-modal');

  if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
  if (registerBtn) registerBtn.addEventListener('click', showRegisterModal);
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (accountBtn) accountBtn.addEventListener('click', showAccountModal);
  if (dashboardBtn) dashboardBtn.addEventListener('click', showDashboardModal);

  // Setup modal close buttons
  closeModalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) hideModal(modal);
    });
  });

  // Setup form submission handlers
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const subscriptionForm = document.getElementById('subscription-form');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);
  if (subscriptionForm) subscriptionForm.addEventListener('submit', handleSubscription);

  // Initialize Stripe if the element exists
  const stripeElements = document.getElementById('stripe-elements');
  if (stripeElements) initializeStripe();

  // Update UI based on auth state
  updateAuthUI();
});

// Check if user is already logged in
async function checkAuthStatus() {
  try {
    const response = await fetch('/api/auth/status', {
      method: 'GET',
      credentials: 'include' // Important for cookies
    });

    if (response.ok) {
      const data = await response.json();
      if (data.isAuthenticated) {
        authState.isAuthenticated = true;
        authState.user = data.user;
        authState.usageCount = data.usageCount || 0;
        authState.usageLimit = getUserLimit(data.user.accountType);
        fetchSavedRuns();
      } else {
        authState.isAuthenticated = false;
        authState.user = null;
      }
    }
  } catch (error) {
    console.error('Error checking authentication status:', error);
  }

  updateAuthUI();
}

// Initialize anonymous session for tracking usage
function initAnonymousSession() {
  let sessionId = localStorage.getItem('anonymousSessionId');
  if (!sessionId) {
    // Generate a random session ID
    sessionId = 'anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('anonymousSessionId', sessionId);
  }
  authState.anonymousSessionId = sessionId;

  // Set a cookie for the backend to identify anonymous users
  document.cookie = `anonymousSessionId=${sessionId}; path=/; max-age=2592000`; // 30 days
}

// Determine usage limit based on account type
function getUserLimit(accountType) {
  switch (accountType) {
    case 'free':
      return 25;
    case 'paid':
    case 'admin':
      return Infinity;
    default:
      return 5; // Anonymous
  }
}

// Update UI based on authentication state
function updateAuthUI() {
  const authButtonsContainer = document.getElementById('auth-buttons');
  const userInfoContainer = document.getElementById('user-info');
  const usageContainer = document.getElementById('usage-info');
  
  if (!authButtonsContainer || !userInfoContainer || !usageContainer) return;

  if (authState.isAuthenticated && authState.user) {
    // User is logged in
    authButtonsContainer.style.display = 'none';
    userInfoContainer.style.display = 'flex';
    
    // Update user info
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
      userNameElement.textContent = authState.user.email;
    }
    
    // Show admin link if user is admin
    const adminLinkElement = document.getElementById('admin-link');
    if (adminLinkElement) {
      adminLinkElement.style.display = authState.user.accountType === 'admin' ? 'block' : 'none';
    }
  } else {
    // User is not logged in
    authButtonsContainer.style.display = 'flex';
    userInfoContainer.style.display = 'none';
  }
  
  // Update usage info
  updateUsageDisplay();
}

// Update usage display
function updateUsageDisplay() {
  const usageInfoElement = document.getElementById('usage-info');
  if (!usageInfoElement) return;
  
  const limit = authState.usageLimit;
  const used = authState.usageCount;
  
  // Create appropriate message based on account type
  let usageMessage = '';
  let accountTypeLabel = '';
  
  if (authState.isAuthenticated && authState.user) {
    switch (authState.user.accountType) {
      case 'free':
        accountTypeLabel = 'Free Account';
        usageMessage = `${used} of ${limit} runs used`;
        break;
      case 'paid':
        accountTypeLabel = 'Paid Account';
        usageMessage = 'Unlimited runs';
        break;
      case 'admin':
        accountTypeLabel = 'Admin Account';
        usageMessage = 'Unlimited runs';
        break;
    }
  } else {
    accountTypeLabel = 'Anonymous User';
    usageMessage = `${used} of ${limit} runs used`;
  }
  
  // Update the display
  usageInfoElement.innerHTML = `
    <div class="account-type">${accountTypeLabel}</div>
    <div class="usage-count">${usageMessage}</div>
  `;
  
  // Update progress bar if it exists
  const progressBar = document.getElementById('usage-progress');
  if (progressBar && limit !== Infinity) {
    const percentage = Math.min(100, (used / limit) * 100);
    progressBar.style.width = `${percentage}%`;
    
    // Change color based on usage level
    if (percentage > 90) {
      progressBar.style.backgroundColor = '#dc3545'; // Red
    } else if (percentage > 70) {
      progressBar.style.backgroundColor = '#ffc107'; // Yellow
    } else {
      progressBar.style.backgroundColor = '#28a745'; // Green
    }
  }
}

// Show login modal
function showLoginModal() {
  if (loginModal) {
    loginModal.style.display = 'flex';
    // Focus on email input
    const emailInput = document.getElementById('login-email');
    if (emailInput) emailInput.focus();
  }
}

// Show register modal
function showRegisterModal() {
  if (registerModal) {
    registerModal.style.display = 'flex';
    // Focus on email input
    const emailInput = document.getElementById('register-email');
    if (emailInput) emailInput.focus();
  }
}

// Show account modal
function showAccountModal() {
  if (accountModal) {
    // Update account info with latest user data
    const accountTypeElement = document.getElementById('account-type');
    const emailElement = document.getElementById('account-email');
    
    if (accountTypeElement && emailElement && authState.user) {
      accountTypeElement.textContent = authState.user.accountType.charAt(0).toUpperCase() + authState.user.accountType.slice(1);
      emailElement.textContent = authState.user.email;
    }
    
    accountModal.style.display = 'flex';
  }
}

// Show dashboard modal
function showDashboardModal() {
  if (dashboardModal) {
    // Refresh saved runs before showing
    fetchSavedRuns().then(() => {
      dashboardModal.style.display = 'flex';
    });
  }
}

// Hide a modal
function hideModal(modal) {
  if (modal) modal.style.display = 'none';
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  // Get form data
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  // Reset error message
  const errorElement = document.getElementById('login-error');
  if (errorElement) errorElement.textContent = '';
  
  try {
    // Show loading state
    const submitButton = document.querySelector('#login-form button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="animate-spin">⟳</span> Logging in...';
    
    // Call API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include' // Important for cookies
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Login successful
      authState.isAuthenticated = true;
      authState.user = data.user;
      authState.usageCount = data.usageCount || 0;
      authState.usageLimit = getUserLimit(data.user.accountType);
      
      // Hide modal
      hideModal(loginModal);
      
      // Update UI
      updateAuthUI();
      
      // Fetch saved runs
      fetchSavedRuns();
    } else {
      // Login failed
      if (errorElement) errorElement.textContent = data.error || 'Login failed';
    }
  } catch (error) {
    console.error('Login error:', error);
    if (errorElement) errorElement.textContent = 'An error occurred. Please try again.';
  } finally {
    // Reset button state
    const submitButton = document.querySelector('#login-form button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = 'Log In';
  }
}

// Handle registration form submission
async function handleRegister(e) {
  e.preventDefault();
  
  // Get form data
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  // Reset error message
  const errorElement = document.getElementById('register-error');
  if (errorElement) errorElement.textContent = '';
  
  // Validate passwords match
  if (password !== confirmPassword) {
    if (errorElement) errorElement.textContent = 'Passwords do not match';
    return;
  }
  
  try {
    // Show loading state
    const submitButton = document.querySelector('#register-form button[type="submit"]');
    const originalButtonText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="animate-spin">⟳</span> Registering...';
    
    // Call API
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include' // Important for cookies
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Registration successful
      authState.isAuthenticated = true;
      authState.user = data.user;
      authState.usageLimit = getUserLimit(data.user.accountType);
      
      // Hide modal
      hideModal(registerModal);
      
      // Show subscription modal for new users
      showSubscriptionModal();
      
      // Update UI
      updateAuthUI();
    } else {
      // Registration failed
      if (errorElement) errorElement.textContent = data.error || 'Registration failed';
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (errorElement) errorElement.textContent = 'An error occurred. Please try again.';
  } finally {
    // Reset button state
    const submitButton = document.querySelector('#register-form button[type="submit"]');
    submitButton.disabled = false;
    submitButton.textContent = 'Register';
  }
}

// Show subscription options modal
function showSubscriptionModal() {
  if (subscriptionModal) {
    subscriptionModal.style.display = 'flex';
  }
}

// Initialize Stripe elements
let stripe;
let card;
function initializeStripe() {
  try {
    // Get Stripe public key from meta tag
    const stripeKey = document.querySelector('meta[name="stripe-public-key"]').getAttribute('content');
    if (!stripeKey) {
      console.error('Stripe public key not found');
      return;
    }
    
    // Initialize Stripe
    stripe = Stripe(stripeKey);
    
    // Create card element
    const elements = stripe.elements();
    card = elements.create('card', {
      style: {
        base: {
          color: '#32325d',
          fontFamily: '"Inter", sans-serif',
          fontSmoothing: 'antialiased',
          fontSize: '16px',
          '::placeholder': {
            color: '#aab7c4'
          }
        },
        invalid: {
          color: '#dc3545',
          iconColor: '#dc3545'
        }
      }
    });
    
    // Mount card element
    const cardElement = document.getElementById('card-element');
    if (cardElement) card.mount('#card-element');
    
    // Handle card validation errors
    card.addEventListener('change', event => {
      const displayError = document.getElementById('card-errors');
      if (displayError) {
        displayError.textContent = event.error ? event.error.message : '';
      }
    });
  } catch (error) {
    console.error('Error initializing Stripe:', error);
  }
}

// Handle subscription form submission
async function handleSubscription(e) {
  e.preventDefault();
  
  if (!stripe || !card) {
    console.error('Stripe not initialized');
    return;
  }
  
  // Get selected plan
  const selectedPlan = document.querySelector('input[name="subscription-plan"]:checked');
  if (!selectedPlan) {
    const errorElement = document.getElementById('subscription-error');
    if (errorElement) errorElement.textContent = 'Please select a plan';
    return;
  }
  
  const planId = selectedPlan.value;
  
  // Show loading state
  const submitButton = document.querySelector('#subscription-form button[type="submit"]');
  submitButton.disabled = true;
  submitButton.innerHTML = '<span class="animate-spin">⟳</span> Processing...';
  
  try {
    // Create payment method
    const result = await stripe.createPaymentMethod({
      type: 'card',
      card: card
    });
    
    if (result.error) {
      // Show error
      const errorElement = document.getElementById('card-errors');
      if (errorElement) errorElement.textContent = result.error.message;
      return;
    }
    
    // Send to server
    const response = await fetch('/api/stripe/create-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        paymentMethodId: result.paymentMethod.id,
        planId: planId
      }),
      credentials: 'include'
    });
    
    const subscription = await response.json();
    
    if (response.ok) {
      // Subscription created successfully
      // Hide modal
      hideModal(subscriptionModal);
      
      // Update user info
      authState.user.accountType = 'paid';
      authState.usageLimit = Infinity;
      
      // Update UI
      updateAuthUI();
      
      // Show success message
      alert('Subscription created successfully! You now have unlimited access.');
    } else {
      // Show error
      const errorElement = document.getElementById('subscription-error');
      if (errorElement) errorElement.textContent = subscription.error || 'Subscription failed';
    }
  } catch (error) {
    console.error('Subscription error:', error);
    const errorElement = document.getElementById('subscription-error');
    if (errorElement) errorElement.textContent = 'An error occurred. Please try again.';
  } finally {
    // Reset button state
    submitButton.disabled = false;
    submitButton.textContent = 'Subscribe';
  }
}

// Log out
async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    // Clear auth state
    authState.isAuthenticated = false;
    authState.user = null;
    authState.usageLimit = 5; // Reset to anonymous limit
    
    // Update UI
    updateAuthUI();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Fetch saved runs for the user
async function fetchSavedRuns() {
  if (!authState.isAuthenticated) return;
  
  try {
    const response = await fetch('/api/runs/saved', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      authState.savedRuns = data.runs || [];
      
      // Update saved runs display
      updateSavedRunsDisplay();
    }
  } catch (error) {
    console.error('Error fetching saved runs:', error);
  }
}

// Update saved runs display
function updateSavedRunsDisplay() {
  const savedRunsContainer = document.getElementById('saved-runs-container');
  if (!savedRunsContainer) return;
  
  if (authState.savedRuns.length === 0) {
    savedRunsContainer.innerHTML = '<p class="text-center mt-4">No saved assessments yet.</p>';
    return;
  }
  
  // Create HTML for saved runs
  let html = '<div class="divide-y">';
  
  authState.savedRuns.forEach(run => {
    const date = new Date(run.createdAt).toLocaleDateString();
    const time = new Date(run.createdAt).toLocaleTimeString();
    
    html += `
      <div class="p-4 result-item">
        <div class="flex flex-col w-full">
          <div class="flex justify-between">
            <h3 class="font-medium">${run.sourceLang} → ${run.targetLang}</h3>
            <span class="text-sm">${date} ${time}</span>
          </div>
          <div class="mt-2 flex justify-between">
            <div>
              <p class="text-sm">Score: <span class="font-semibold">${run.mqmScore.toFixed(1)}</span></p>
              <p class="text-sm">Issues: ${run.issues?.length || 0}</p>
            </div>
            <div>
              <button class="btn-secondary text-sm" onclick="viewRun('${run._id}')">View</button>
              <button class="btn-secondary text-sm ml-2" onclick="downloadReport('${run._id}', 'excel')">Excel</button>
              <button class="btn-secondary text-sm ml-2" onclick="downloadReport('${run._id}', 'pdf')">PDF</button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  savedRunsContainer.innerHTML = html;
}

// View a saved run
function viewRun(runId) {
  // Navigate to the run page or load the run data
  window.location.href = `/run/${runId}`;
}

// Download a report
function downloadReport(runId, format) {
  window.open(`/api/download-report/${runId}/${format}`, '_blank');
}

// Save the current run
async function saveCurrentRun(runId) {
  if (!authState.isAuthenticated) {
    showLoginModal();
    return;
  }
  
  try {
    const response = await fetch(`/api/runs/save/${runId}`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Add to saved runs
      fetchSavedRuns();
      
      // Show success message
      alert('Assessment saved successfully!');
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to save assessment');
    }
  } catch (error) {
    console.error('Error saving run:', error);
    alert('An error occurred. Please try again.');
  }
}

// Initialize admin functionality if user is admin
function initAdminPanel() {
  if (!authState.isAuthenticated || authState.user?.accountType !== 'admin') return;
  
  // Fetch users for admin panel
  fetchUsers();
  
  // Add event listeners for admin actions
  const userListElement = document.getElementById('admin-user-list');
  if (userListElement) {
    userListElement.addEventListener('click', handleAdminAction);
  }
}

// Fetch users for admin panel
async function fetchUsers() {
  if (!authState.isAuthenticated || authState.user?.accountType !== 'admin') return;
  
  try {
    const response = await fetch('/api/auth/users', {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Update users display
      updateUsersDisplay(data.users);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

// Update users display in admin panel
function updateUsersDisplay(users) {
  const userListElement = document.getElementById('admin-user-list');
  if (!userListElement) return;
  
  if (!users || users.length === 0) {
    userListElement.innerHTML = '<p class="text-center mt-4">No users found.</p>';
    return;
  }
  
  // Create HTML for users
  let html = '<div class="divide-y">';
  
  users.forEach(user => {
    const createdDate = new Date(user.createdAt).toLocaleDateString();
    
    html += `
      <div class="p-4 flex justify-between items-center" data-user-id="${user._id}">
        <div>
          <p class="font-medium">${user.email}</p>
          <p class="text-sm">Account: ${user.accountType}</p>
          <p class="text-sm">Created: ${createdDate}</p>
        </div>
        <div>
          <button class="btn-secondary text-sm" data-action="edit">Edit</button>
          ${user.accountType !== 'admin' ? `<button class="btn-secondary text-sm ml-2" data-action="delete">Delete</button>` : ''}
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  userListElement.innerHTML = html;
}

// Handle admin actions
function handleAdminAction(e) {
  const target = e.target;
  if (!target.matches('button[data-action]')) return;
  
  const action = target.getAttribute('data-action');
  const userElement = target.closest('[data-user-id]');
  const userId = userElement?.getAttribute('data-user-id');
  
  if (!userId) return;
  
  if (action === 'edit') {
    showEditUserModal(userId);
  } else if (action === 'delete') {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteUser(userId);
    }
  }
}

// Show edit user modal
function showEditUserModal(userId) {
  // Implement user editing logic
  console.log('Edit user:', userId);
}

// Delete a user (admin only)
async function deleteUser(userId) {
  if (!authState.isAuthenticated || authState.user?.accountType !== 'admin') return;
  
  try {
    const response = await fetch(`/api/auth/users/${userId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (response.ok) {
      // Refresh users list
      fetchUsers();
    } else {
      const data = await response.json();
      alert(data.error || 'Failed to delete user');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    alert('An error occurred. Please try again.');
  }
}

// Export functions for use in other scripts
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.showAccountModal = showAccountModal;
window.showDashboardModal = showDashboardModal;
window.showSubscriptionModal = showSubscriptionModal;
window.hideModal = hideModal;
window.saveCurrentRun = saveCurrentRun;
window.viewRun = viewRun;
window.downloadReport = downloadReport;