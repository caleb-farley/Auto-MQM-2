// Traffic Analytics Functionality

// DOM Elements - Traffic Tab
const usersChart = document.getElementById('users-chart');
const geoChart = document.getElementById('geo-chart');
const actionsChart = document.getElementById('actions-chart');
const languageChart = document.getElementById('language-chart');
const totalUsersEl = document.getElementById('total-users');
const activeUsersEl = document.getElementById('active-users');
const newUsersEl = document.getElementById('new-users');
const totalTranslationsEl = document.getElementById('total-translations');
const totalAnalysesEl = document.getElementById('total-analyses');
const countriesList = document.getElementById('countries-list');
const languagesList = document.getElementById('languages-list');
const exportTrafficCsvBtn = document.getElementById('export-traffic-csv-btn');

// Global variables - Traffic Tab
let trafficData = null;
let userChartInstance = null;
let geoChartInstance = null;
let actionsChartInstance = null;
let languageChartInstance = null;

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  if (exportTrafficCsvBtn) {
    exportTrafficCsvBtn.addEventListener('click', exportTrafficToCsv);
  }
  
  // Only fetch traffic data if the traffic tab is active initially
  if (document.getElementById('traffic-tab').classList.contains('active')) {
    fetchTrafficData();
  }
});

// Fetch traffic analytics data
async function fetchTrafficData() {
  try {
    showTrafficLoading();
    
    // Get date range for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const response = await fetch(`/api/admin/traffic?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    trafficData = await response.json();
    
    // Update UI with traffic data
    updateTrafficUI(trafficData);
    hideTrafficLoading();
  } catch (error) {
    console.error('Error fetching traffic data:', error);
    showTrafficError('Failed to load traffic data. Please try again.');
  }
}

// Update UI with traffic data
function updateTrafficUI(data) {
  if (!data) return;
  
  // Update summary statistics
  totalUsersEl.textContent = data.totalUsers || 0;
  activeUsersEl.textContent = data.activeUsers || 0;
  newUsersEl.textContent = data.newUsers || 0;
  totalTranslationsEl.textContent = data.totalTranslations || 0;
  totalAnalysesEl.textContent = data.totalAnalyses || 0;
  
  // Render charts
  renderUsersChart(data.userActivity || []);
  renderGeoChart(data.geoDistribution || []);
  renderActionsChart(data.actionsByType || {});
  renderLanguageChart(data.topLanguagePairs || []);
  
  // Render top countries list
  renderCountriesList(data.geoDistribution || []);
  
  // Render top language pairs list
  renderLanguagesList(data.topLanguagePairs || []);
}

// Render users chart
function renderUsersChart(userData) {
  const ctx = usersChart.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (userChartInstance) {
    userChartInstance.destroy();
  }
  
  // Prepare data for chart
  const labels = userData.map(item => new Date(item.date).toLocaleDateString());
  const activeUsers = userData.map(item => item.activeUsers);
  const newUsers = userData.map(item => item.newUsers);
  
  userChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Active Users',
          data: activeUsers,
          borderColor: 'rgba(75, 192, 192, 1)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
        },
        {
          label: 'New Users',
          data: newUsers,
          borderColor: 'rgba(153, 102, 255, 1)',
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          tension: 0.1,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Users'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Date'
          }
        }
      }
    }
  });
}

// Render geographic distribution chart
function renderGeoChart(geoData) {
  const ctx = geoChart.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (geoChartInstance) {
    geoChartInstance.destroy();
  }
  
  // Sort and limit to top 10 countries
  const topCountries = [...geoData]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Prepare data for chart
  const labels = topCountries.map(item => item.country);
  const counts = topCountries.map(item => item.count);
  const backgroundColors = [
    'rgba(255, 99, 132, 0.5)',
    'rgba(54, 162, 235, 0.5)',
    'rgba(255, 206, 86, 0.5)',
    'rgba(75, 192, 192, 0.5)',
    'rgba(153, 102, 255, 0.5)',
    'rgba(255, 159, 64, 0.5)',
    'rgba(199, 199, 199, 0.5)',
    'rgba(83, 102, 255, 0.5)',
    'rgba(78, 205, 196, 0.5)',
    'rgba(255, 99, 132, 0.5)'
  ];
  
  geoChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: counts,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 15
          }
        },
        title: {
          display: true,
          text: 'User Distribution by Country'
        }
      }
    }
  });
}

// Render actions chart
function renderActionsChart(actionsData) {
  const ctx = actionsChart.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (actionsChartInstance) {
    actionsChartInstance.destroy();
  }
  
  // Prepare data for chart
  const labels = Object.keys(actionsData);
  const data = Object.values(actionsData);
  
  actionsChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
      datasets: [{
        data: data,
        backgroundColor: [
          'rgba(54, 162, 235, 0.7)',
          'rgba(255, 99, 132, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(75, 192, 192, 0.7)'
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 15
          }
        }
      }
    }
  });
}

// Render language pairs chart
function renderLanguageChart(languageData) {
  const ctx = languageChart.getContext('2d');
  
  // Destroy previous chart instance if it exists
  if (languageChartInstance) {
    languageChartInstance.destroy();
  }
  
  // Sort and limit to top 10 language pairs
  const topPairs = [...languageData]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Prepare data for chart
  const labels = topPairs.map(item => `${item.sourceLang} → ${item.targetLang}`);
  const counts = topPairs.map(item => item.count);
  
  languageChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Usage Count',
        data: counts,
        backgroundColor: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Translations'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// Render top countries list
function renderCountriesList(geoData) {
  // Clear the list
  countriesList.innerHTML = '';
  
  // Sort and limit to top 10 countries
  const topCountries = [...geoData]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Add each country to the list
  topCountries.forEach(country => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="country-name">${country.country}</span><span class="country-count">${country.count}</span>`;
    countriesList.appendChild(li);
  });
  
  // If no data, show a message
  if (topCountries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No data available';
    countriesList.appendChild(li);
  }
}

// Render top language pairs list
function renderLanguagesList(languageData) {
  // Clear the list
  languagesList.innerHTML = '';
  
  // Sort and limit to top 10 language pairs
  const topPairs = [...languageData]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  // Add each language pair to the list
  topPairs.forEach(pair => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lang-pair">${pair.sourceLang} → ${pair.targetLang}</span><span class="lang-count">${pair.count}</span>`;
    languagesList.appendChild(li);
  });
  
  // If no data, show a message
  if (topPairs.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No data available';
    languagesList.appendChild(li);
  }
}

// Export traffic data to CSV
function exportTrafficToCsv() {
  if (!trafficData) {
    showTrafficError('No data to export');
    return;
  }
  
  try {
    // Create CSV content for user activity
    let csvContent = 'data:text/csv;charset=utf-8,Date,Active Users,New Users\n';
    
    trafficData.userActivity.forEach(day => {
      const date = new Date(day.date).toLocaleDateString();
      csvContent += `${date},${day.activeUsers},${day.newUsers}\n`;
    });
    
    // Add geographic distribution
    csvContent += '\nCountry,Users\n';
    trafficData.geoDistribution.forEach(country => {
      csvContent += `${country.country},${country.count}\n`;
    });
    
    // Add language pairs
    csvContent += '\nSource Language,Target Language,Count\n';
    trafficData.topLanguagePairs.forEach(pair => {
      csvContent += `${pair.sourceLang},${pair.targetLang},${pair.count}\n`;
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `traffic_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting traffic data:', error);
    showTrafficError('Failed to export data');
  }
}

// Show loading state
function showTrafficLoading() {
  // Add loading indicators to chart containers
  document.querySelectorAll('.analytics-chart-container').forEach(container => {
    container.innerHTML = '<div class="loading">Loading data...</div>';
  });
}

// Hide loading state
function hideTrafficLoading() {
  // Remove loading indicators
  document.querySelectorAll('.loading').forEach(el => el.remove());
}

// Show error message
function showTrafficError(message) {
  // Create error message element if it doesn't exist
  let errorEl = document.getElementById('traffic-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'traffic-error';
    errorEl.className = 'error-message';
    document.querySelector('#traffic-tab .header').appendChild(errorEl);
  }
  
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  
  // Hide error after 5 seconds
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 5000);
}
