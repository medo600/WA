// popup/popup.js
class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadStatus();
    await this.loadStats();
    this.setupEventListeners();
    
    // Refresh status every 5 seconds
    setInterval(() => this.loadStatus(), 5000);
  }

  async loadStatus() {
    try {
      // Check if we're on WhatsApp Web
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isWhatsAppTab = tab.url && tab.url.includes('web.whatsapp.com');
      
      if (!isWhatsAppTab) {
        this.updateStatus('whatsappStatus', 'Not on WhatsApp Web', 'status-error');
        this.updateStatus('extensionStatus', 'Inactive', 'status-error');
        this.disableActions(true);
        return;
      }

      // Get extension status from content script
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
        
        if (response && response.initialized) {
          this.updateStatus('extensionStatus', 'Active', 'status-value');
          this.updateStatus('whatsappStatus', 'Connected', 'status-value');
          this.updateStatus('activeOps', response.activeOperations || 0, 'status-value');
          this.disableActions(false);
        } else {
          this.updateStatus('extensionStatus', 'Initializing...', 'status-value');
          this.updateStatus('whatsappStatus', 'Loading...', 'status-value');
          this.disableActions(true);
        }
      } catch (error) {
        this.updateStatus('extensionStatus', 'Not Loaded', 'status-error');
        this.updateStatus('whatsappStatus', 'Connected', 'status-value');
        this.disableActions(true);
      }
    } catch (error) {
      this.updateStatus('extensionStatus', 'Error', 'status-error');
      this.updateStatus('whatsappStatus', 'Error', 'status-error');
      this.disableActions(true);
    }
  }

  async loadStats() {
    try {
      const data = await this.getStorageData([
        'contactLists',
        'autoResponses', 
        'bulkMessages'
      ]);
      
      const contactLists = data.contactLists || [];
      const autoResponses = data.autoResponses || [];
      const templates = data.bulkMessages || [];
      
      this.updateStatus('contactListsCount', contactLists.length, 'status-value');
      this.updateStatus('autoRulesCount', autoResponses.length, 'status-value');
      this.updateStatus('templatesCount', templates.length, 'status-value');
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  updateStatus(elementId, text, className = 'status-value') {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = text;
      element.className = className;
    }
  }

  disableActions(disabled) {
    const buttons = document.querySelectorAll('.button, .quick-action');
    buttons.forEach(button => {
      button.disabled = disabled;
      if (disabled) {
        button.style.opacity = '0.5';
        button.style.cursor = 'not-allowed';
      } else {
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    });
  }

  setupEventListeners() {
    // Open control panel
    document.getElementById('openPanel').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('web.whatsapp.com')) {
          this.showNotification('Please navigate to WhatsApp Web first', 'error');
          return;
        }
        
        // Focus the tab and close popup
        await chrome.tabs.update(tab.id, { active: true });
        window.close();
      } catch (error) {
        this.showNotification('Error opening control panel', 'error');
      }
    });

    // Export data
    document.getElementById('exportData').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('web.whatsapp.com')) {
          const data = await this.exportAllData();
          this.downloadJSON(data, 'whatsapp-marketing-data.json');
          this.showNotification('Data exported successfully', 'success');
        } else {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'exportData' });
          
          if (response.success) {
            this.downloadJSON(response.data, 'whatsapp-marketing-data.json');
            this.showNotification('Data exported successfully', 'success');
          } else {
            throw new Error(response.error);
          }
        }
      } catch (error) {
        this.showNotification('Export failed: ' + error.message, 'error');
      }
    });

    // Import data
    document.getElementById('importData').addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const data = await this.readJSONFile(file);
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url.includes('web.whatsapp.com')) {
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'importData', 
            data 
          });
          
          if (response.success) {
            this.showNotification('Data imported successfully', 'success');
            await this.loadStats();
          } else {
            throw new Error(response.error);
          }
        } else {
          await this.importAllData(data);
          this.showNotification('Data imported successfully', 'success');
          await this.loadStats();
        }
      } catch (error) {
        this.showNotification('Import failed: ' + error.message, 'error');
      }
    });

    // View logs
    document.getElementById('viewLogs').addEventListener('click', async () => {
      try {
        const logs = await this.getStorageData(['actionLogs']);
        const logData = logs.actionLogs || [];
        
        const logWindow = window.open('', '_blank', 'width=800,height=600');
        logWindow.document.write(`
          <html>
            <head>
              <title>Extension Logs</title>
              <style>
                body { font-family: monospace; padding: 20px; background: #1a1a1a; color: #fff; }
                .log-entry { margin-bottom: 10px; padding: 8px; background: #333; border-radius: 4px; }
                .timestamp { color: #888; }
                .action { color: #4ade80; font-weight: bold; }
                .details { color: #fbbf24; }
                .search { width: 100%; padding: 10px; margin-bottom: 20px; background: #333; color: white; border: 1px solid #555; }
              </style>
            </head>
            <body>
              <h1>WhatsApp Marketing Manager - Logs</h1>
              <input type="text" class="search" placeholder="Search logs..." onkeyup="filterLogs(this.value)">
              <div id="logs">
                ${logData.map(log => `
                  <div class="log-entry">
                    <span class="timestamp">[${new Date(log.timestamp).toLocaleString()}]</span>
                    <span class="action">${log.action}</span>
                    ${log.details ? `<div class="details">${JSON.stringify(log.details, null, 2)}</div>` : ''}
                  </div>
                `).join('')}
              </div>
              <script>
                function filterLogs(query) {
                  const entries = document.querySelectorAll('.log-entry');
                  entries.forEach(entry => {
                    const text = entry.textContent.toLowerCase();
                    entry.style.display = text.includes(query.toLowerCase()) ? 'block' : 'none';
                  });
                }
              </script>
            </body>
          </html>
        `);
      } catch (error) {
        this.showNotification('Error viewing logs: ' + error.message, 'error');
      }
    });

    // Pause operations
    document.getElementById('pauseOps').addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab.url.includes('web.whatsapp.com')) {
          await chrome.tabs.sendMessage(tab.id, { action: 'pauseOperations' });
          this.showNotification('Operations paused', 'success');
        } else {
          this.showNotification('Please navigate to WhatsApp Web', 'error');
        }
      } catch (error) {
        this.showNotification('Error pausing operations', 'error');
      }
    });
  }

  async getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  async exportAllData() {
    const data = await this.getStorageData([
      'autoResponses',
      'bulkMessages', 
      'contactLists',
      'settings',
      'messageHistory'
    ]);
    
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      data
    };
  }

  async importAllData(importData) {
    return new Promise((resolve, reject) => {
      if (importData.data) {
        chrome.storage.local.set(importData.data, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      } else {
        reject(new Error('Invalid import data format'));
      }
    });
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  readJSONFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error reading file'));
      };
      
      reader.readAsText(file);
    });
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.classList.remove('hidden');
    
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});