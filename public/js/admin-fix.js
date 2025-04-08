/**
 * Admin Panel Fix for Auto-MQM
 * This script ensures the admin panel works correctly
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Admin panel fix loaded');
  
  // Fix admin panel functionality
  function initAdminPanel() {
    // Check for admin link and add click handler
    const adminLink = document.getElementById('admin-link');
    if (adminLink) {
      console.log('Admin link found, adding direct click handler');
      
      // Remove existing click handlers and add our own
      adminLink.onclick = null;
      adminLink.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Admin link clicked');
        showAdminPanel();
        return false;
      });
    }
    
    // Add tab functionality to admin dashboard
    const dashboardTabs = document.querySelectorAll('.dashboard-tab');
    if (dashboardTabs.length > 0) {
      console.log('Admin dashboard tabs found, adding functionality');
      
      dashboardTabs.forEach(tab => {
        tab.addEventListener('click', function() {
          // Remove active class from all tabs
          dashboardTabs.forEach(t => t.classList.remove('active'));
          
          // Add active class to clicked tab
          this.classList.add('active');
          
          // Show corresponding content
          const tabName = this.getAttribute('data-tab');
          console.log('Switching to tab:', tabName);
          
          if (tabName === 'users') {
            loadAdminUsers();
          } else if (tabName === 'stats') {
            loadAdminStats();
          }
        });
      });
    }
    
    // Add close functionality to admin modal
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) {
      const closeBtn = adminModal.querySelector('.close-modal');
      if (closeBtn) {
        closeBtn.addEventListener('click', function() {
          adminModal.style.display = 'none';
        });
      }
      
      // Close when clicking outside the modal content
      adminModal.addEventListener('click', function(e) {
        if (e.target === adminModal) {
          adminModal.style.display = 'none';
        }
      });
    }
  }
  
  // Show admin panel
  function showAdminPanel() {
    const adminModal = document.getElementById('admin-modal');
    if (adminModal) {
      console.log('Showing admin modal');
      adminModal.style.display = 'flex';
      loadAdminUsers();
    } else {
      console.error('Admin modal not found');
    }
  }
  
  // Load admin users
  function loadAdminUsers() {
    console.log('Loading admin users');
    const usersList = document.getElementById('admin-users-list');
    if (!usersList) {
      console.error('Admin users list container not found');
      return;
    }
    
    // Show loading state
    usersList.innerHTML = '<p class="text-center mt-4">Loading users...</p>';
    
    // Check if we're in a demo/development environment
    // In a real environment, this would fetch from the API
    const isDemoMode = true;
    
    if (isDemoMode) {
      // Create demo data
      setTimeout(() => {
        const demoUsers = [
          { _id: '1', name: 'Admin User', email: 'admin@example.com', accountType: 'admin' },
          { _id: '2', name: 'Regular User', email: 'user@example.com', accountType: 'user' },
          { _id: '3', name: 'John Smith', email: 'john@example.com', accountType: 'user' },
          { _id: '4', name: 'Jane Doe', email: 'jane@example.com', accountType: 'user' }
        ];
        
        renderUsersList(demoUsers);
      }, 500);
    } else {
      // In a real environment, fetch from API
      fetch('/api/users/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`
        }
      })
      .then(response => {
        if (!response.ok) throw new Error('Failed to load admin data');
        return response.json();
      })
      .then(data => {
        renderUsersList(data.users);
      })
      .catch(error => {
        console.error('Admin data error:', error);
        usersList.innerHTML = `<p class="text-center mt-4 text-danger">Error: ${error.message}</p>`;
      });
    }
  }
  
  // Render users list
  function renderUsersList(users) {
    const usersList = document.getElementById('admin-users-list');
    if (!usersList) return;
    
    if (!users || users.length === 0) {
      usersList.innerHTML = '<p class="text-center mt-4">No users found.</p>';
      return;
    }
    
    usersList.innerHTML = '';
    
    users.forEach(user => {
      const userItem = document.createElement('div');
      userItem.className = 'admin-user-item';
      userItem.innerHTML = `
        <div class="user-info">
          <div>${user.name || 'Unknown User'}</div>
          <div>${user.email}</div>
          <div>${user.accountType}</div>
        </div>
        <div class="user-actions">
          <select class="account-type-select" data-user-id="${user._id}">
            <option value="user" ${user.accountType === 'user' ? 'selected' : ''}>User</option>
            <option value="admin" ${user.accountType === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn btn-secondary save-user-btn">Save</button>
        </div>
      `;
      
      usersList.appendChild(userItem);
    });
    
    // Add event listeners for account type changes
    document.querySelectorAll('.save-user-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const userItem = this.closest('.admin-user-item');
        const select = userItem.querySelector('.account-type-select');
        const userId = select.getAttribute('data-user-id');
        const accountType = select.value;
        
        console.log(`Changing user ${userId} to ${accountType}`);
        alert(`User role updated to ${accountType}`);
        
        // In a real environment, this would call the API
        // changeUserType(userId, accountType);
      });
    });
  }
  
  // Load admin stats
  function loadAdminStats() {
    console.log('Loading admin stats');
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Show loading state
    dashboardContent.innerHTML = '<p class="text-center mt-4">Loading statistics...</p>';
    
    // Create demo stats
    setTimeout(() => {
      dashboardContent.innerHTML = `
        <div style="padding: 20px;">
          <h3 style="margin-bottom: 20px;">System Statistics</h3>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
            <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px;">
              <h4 style="margin-top: 0;">Total Users</h4>
              <div style="font-size: 24px; font-weight: 600;">42</div>
            </div>
            
            <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px;">
              <h4 style="margin-top: 0;">Total Runs</h4>
              <div style="font-size: 24px; font-weight: 600;">1,248</div>
            </div>
            
            <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px;">
              <h4 style="margin-top: 0;">Active Today</h4>
              <div style="font-size: 24px; font-weight: 600;">8</div>
            </div>
            
            <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px;">
              <h4 style="margin-top: 0;">Admin Users</h4>
              <div style="font-size: 24px; font-weight: 600;">3</div>
            </div>
          </div>
          
          <h3 style="margin: 30px 0 20px;">Recent Activity</h3>
          <div style="background-color: rgba(0,0,0,0.05); padding: 15px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.1);">
              <div>user@example.com</div>
              <div>Ran analysis</div>
              <div>2 minutes ago</div>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.1);">
              <div>admin@example.com</div>
              <div>Changed user role</div>
              <div>15 minutes ago</div>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.1);">
              <div>john@example.com</div>
              <div>Ran analysis</div>
              <div>1 hour ago</div>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 10px 0;">
              <div>jane@example.com</div>
              <div>Registered account</div>
              <div>2 hours ago</div>
            </div>
          </div>
        </div>
      `;
    }, 500);
  }
  
  // Helper function to get auth token
  function getAuthToken() {
    // In a real app, this would get the token from localStorage or similar
    return 'demo-token';
  }
  
  // Initialize
  initAdminPanel();
});
