/**
 * Auto-MQM Authentication Functionality
 * Handles user authentication, registration, and account management
 */

// DOM Elements
const authButtons = document.getElementById('auth-buttons');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const adminLink = document.getElementById('admin-link');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutLink = document.getElementById('logout-link');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const accountModal = document.getElementById('account-modal');
const adminModal = document.getElementById('admin-modal');
const usageInfo = document.getElementById('usage-info');
const usageProgress = document.getElementById('usage-progress');

// Current user state
let currentUser = null;

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!currentUser;
}

/**
 * Show login modal
 */
function showLoginModal() {
  hideAllModals();
  showModal(loginModal);
}

/**
 * Show register modal
 */
function showRegisterModal() {
  hideAllModals();
  showModal(registerModal);
}

/**
 * Show account modal
 */
function showAccountModal() {
  hideAllModals();
  showModal(accountModal);
}

/**
 * Show admin modal
 */
function showAdminModal() {
  if (!isAuthenticated() || currentUser.accountType !== 'admin') {
    return;
  }
  
  hideAllModals();
  showModal(adminModal);
  loadAdminData();
}

/**
 * Load admin dashboard data
 */
async function loadAdminData() {
  if (!isAuthenticated() || currentUser.accountType !== 'admin') {
    return;
  }
  
  try {
    const response = await fetch('/api/users/admin/dashboard', {
      headers: {
        'Authorization': `Bearer ${getToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to load admin data');
    }
    
    const data = await response.json();
    
    // Update admin dashboard UI
    const usersList = document.getElementById('admin-users-list');
    if (usersList) {
      usersList.innerHTML = '';
      
      data.users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'admin-user-item';
        userItem.innerHTML = `
          <div class="user-info">
            <div>${user.name}</div>
            <div>${user.email}</div>
            <div>${user.accountType}</div>
          </div>
          <div class="user-actions">
            <select class="account-type-select" data-user-id="${user._id}">
              <option value="user" ${user.accountType === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${user.accountType === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
            <button class="btn btn-secondary">Save</button>
          </div>
        `;
        
        usersList.appendChild(userItem);
      });
      
      // Add event listeners for account type changes
      document.querySelectorAll('.account-type-select').forEach(select => {
        select.addEventListener('change', function() {
          const userId = this.getAttribute('data-user-id');
          const accountType = this.value;
          changeUserType(userId, accountType);
        });
      });
    }
  } catch (error) {
    console.error('Admin data error:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Change user account type (admin function)
 */
async function changeUserType(userId, accountType) {
  if (!isAuthenticated() || currentUser.accountType !== 'admin') {
    return;
  }
  
  try {
    const response = await fetch(`/api/users/admin/user/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ accountType })
    });
    
    if (!response.ok) {
      throw new Error('Failed to update user');
    }
    
    alert('User updated successfully');
    loadAdminData();
  } catch (error) {
    console.error('Change user type error:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * Show modal helper
 */
function showModal(modal) {
  if (!modal) return;
  
  // Hide all other modals first
  hideAllModals();
  
  // Show the modal
  modal.style.display = 'block';
  
  // Add event listener to close button
  const closeBtn = modal.querySelector('.close-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => hideModal(modal));
  }
}

/**
 * Hide modal helper
 */
function hideModal(modal) {
  if (modal) modal.style.display = 'none';
}

/**
 * Hide all modals
 */
function hideAllModals() {
  const modals = document.querySelectorAll('.modal-overlay');
  modals.forEach(modal => {
    modal.style.display = 'none';
  });
}

/**
 * Check if user can run assessment
 */
function canRunAssessment() {
  // If not authenticated, anonymous users get limited runs
  if (!isAuthenticated()) {
    return true; // For now, allow anonymous users to run assessments
  }
  
  // Check user's subscription tier and usage
  return true; // For now, allow all authenticated users to run assessments
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    const response = await fetch('/api/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }
    
    const data = await response.json();
    
    // Store token and user data
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    
    // Update UI
    updateAuthUI();
    
    // Hide login modal
    hideModal(loginModal);
    
    return true;
  } catch (error) {
    console.error('Login error:', error);
    alert(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Register user
 */
async function register(name, email, password) {
  try {
    const response = await fetch('/api/users/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, password })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Registration failed');
    }
    
    const data = await response.json();
    
    // Store token and user data
    localStorage.setItem('token', data.token);
    currentUser = data.user;
    
    // Update UI
    updateAuthUI();
    
    // Hide register modal
    hideModal(registerModal);
    
    return true;
  } catch (error) {
    console.error('Registration error:', error);
    alert(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Logout user
 */
async function logout() {
  try {
    // Clear token and user data
    localStorage.removeItem('token');
    currentUser = null;
    
    // Update UI
    updateAuthUI();
    
    // Redirect to home page if needed
    // window.location.href = '/';
    
    return true;
  } catch (error) {
    console.error('Logout error:', error);
    alert(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Update authentication UI based on current user state
 */
function updateAuthUI() {
  if (isAuthenticated()) {
    // Show user info
    authButtons.style.display = 'none';
    userInfo.style.display = 'flex';
    
    // Update user avatar and name
    userAvatar.textContent = currentUser.name.charAt(0).toUpperCase();
    userName.textContent = currentUser.email;
    
    // Show admin link if user is admin
    if (currentUser.accountType === 'admin') {
      adminLink.style.display = 'inline';
    } else {
      adminLink.style.display = 'none';
    }
    
    // Update usage info
    updateUsageInfo();
  } else {
    // Show auth buttons
    authButtons.style.display = 'flex';
    userInfo.style.display = 'none';
    
    // Reset usage info
    resetUsageInfo();
  }
}

/**
 * Update usage info based on current user state
 */
function updateUsageInfo() {
  if (!usageInfo) return;
  
  if (isAuthenticated()) {
    // Show usage info for authenticated users
    usageInfo.style.display = 'block';
    
    // Update account type
    const accountTypeElement = usageInfo.querySelector('.account-type');
    if (accountTypeElement) {
      accountTypeElement.textContent = `${currentUser.accountType.charAt(0).toUpperCase() + currentUser.accountType.slice(1)} Account`;
    }
    
    // Update usage count (this would come from the API in a real app)
    const usageCountElement = usageInfo.querySelector('.usage-count');
    if (usageCountElement) {
      let limit = 5; // Default free tier
      
      if (currentUser.subscription && currentUser.subscription.tier) {
        switch (currentUser.subscription.tier) {
          case 'pro':
            limit = 50;
            break;
          case 'enterprise':
            limit = 1000;
            break;
          default:
            limit = 5;
        }
      }
      
      // This would be fetched from the API in a real app
      const used = 0;
      
      usageCountElement.textContent = `${used} of ${limit} runs used`;
      
      // Update progress bar
      if (usageProgress) {
        const percentage = (used / limit) * 100;
        usageProgress.style.width = `${percentage}%`;
      }
    }
  } else {
    // Show usage info for anonymous users
    usageInfo.style.display = 'block';
    
    // Update account type
    const accountTypeElement = usageInfo.querySelector('.account-type');
    if (accountTypeElement) {
      accountTypeElement.textContent = 'Anonymous User';
    }
    
    // Update usage count (this would come from the API in a real app)
    const usageCountElement = usageInfo.querySelector('.usage-count');
    if (usageCountElement) {
      const limit = 3; // Anonymous users get 3 free runs
      const used = 0; // This would be fetched from the API in a real app
      
      usageCountElement.textContent = `${used} of ${limit} runs used`;
      
      // Update progress bar
      if (usageProgress) {
        const percentage = (used / limit) * 100;
        usageProgress.style.width = `${percentage}%`;
      }
    }
  }
}

/**
 * Reset usage info
 */
function resetUsageInfo() {
  if (!usageInfo) return;
  
  // Hide usage info
  usageInfo.style.display = 'none';
  
  // Reset progress bar
  if (usageProgress) {
    usageProgress.style.width = '0%';
  }
}

/**
 * Get token from localStorage
 */
function getToken() {
  return localStorage.getItem('token');
}

/**
 * Check token and load user data
 */
async function checkAuth() {
  const token = getToken();
  
  if (!token) {
    currentUser = null;
    updateAuthUI();
    return;
  }
  
  try {
    const response = await fetch('/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Invalid token');
    }
    
    const data = await response.json();
    currentUser = data.user;
    updateAuthUI();
  } catch (error) {
    console.error('Auth check error:', error);
    localStorage.removeItem('token');
    currentUser = null;
    updateAuthUI();
  }
}

/**
 * Initialize authentication functionality
 */
function init() {
  // Check if user is already authenticated
  checkAuth();
  
  // Add event listeners for auth buttons
  if (loginBtn) {
    loginBtn.addEventListener('click', showLoginModal);
  }
  
  if (registerBtn) {
    registerBtn.addEventListener('click', showRegisterModal);
  }
  
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  }
  
  // Add event listeners for modal forms
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      await login(email, password);
    });
  }
  
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('register-name').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      await register(name, email, password);
    });
  }
  
  // Add event listeners for modal close buttons
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function() {
      const modal = this.closest('.modal-overlay');
      hideModal(modal);
    });
  });
  
  // Close modals when clicking outside
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        hideModal(this);
      }
    });
  });
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for use in other modules
window.AutoMQM = window.AutoMQM || {};
window.AutoMQM.Auth = {
  isAuthenticated,
  showLoginModal,
  showRegisterModal,
  showAccountModal,
  showAdminModal,
  login,
  register,
  logout,
  updateAuthUI,
  getToken,
  checkAuth
};

// Also expose the functions globally for inline event handlers
window.showLoginModal = showLoginModal;
window.showRegisterModal = showRegisterModal;
window.showAccountModal = showAccountModal;
window.showAdminModal = showAdminModal;
window.logout = logout;
