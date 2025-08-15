// background.js
class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Handle messages from content script or popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates to inject content script when needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Handle alarm for periodic tasks
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });

    // Set up periodic cleanup alarm
    chrome.alarms.create('cleanup', { 
      delayInMinutes: 60, // Run every hour
      periodInMinutes: 60 
    });

    this.logAction('Background service initialized');
  }

  async handleInstallation(details) {
    this.logAction('Extension installed', { 
      reason: details.reason,
      version: chrome.runtime.getManifest().version
    });

    if (details.reason === 'install') {
      // First time installation
      await this.initializeDefaultSettings();
      await this.showWelcomeNotification();
    } else if (details.reason === 'update') {
      // Extension updated
      const manifest = chrome.runtime.getManifest();
      this.logAction('Extension updated', { 
        version: manifest.version,
        previousVersion: details.previousVersion
      });
    }
  }

  async handleStartup() {
    this.logAction('Extension startup');
    
    // Check for any cleanup needed
    await this.performStartupCleanup();
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'log':
          this.logAction(message.type, message.data);
          sendResponse({ success: true });
          break;

        case 'getVersion':
          const manifest = chrome.runtime.getManifest();
          sendResponse({ 
            success: true, 
            version: manifest.version,
            name: manifest.name
          });
          break;

        case 'checkPermissions':
          const hasPermissions = await this.checkRequiredPermissions();
          sendResponse({ success: true, hasPermissions });
          break;

        case 'requestPermissions':
          const granted = await this.requestAdditionalPermissions();
          sendResponse({ success: true, granted });
          break;

        case 'clearStorage':
          await this.clearAllStorage();
          sendResponse({ success: true });
          break;

        case 'exportLogs':
          const logs = await this.exportLogs();
          sendResponse({ success: true, logs });
          break;

        case 'getStats':
          const stats = await this.getExtensionStats();
          sendResponse({ success: true, stats });
          break;

        default:
          sendResponse({ 
            success: false, 
            error: 'Unknown action: ' + message.action 
          });
      }
    } catch (error) {
      this.logAction('Background message handler error', {
        action: message.action,
        error: error.message
      });
      
      sendResponse({ 
        success: false, 
        error: error.message 
      });
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only handle WhatsApp Web tabs
    if (!tab.url || !tab.url.includes('web.whatsapp.com')) {
      return;
    }

    // When WhatsApp Web is fully loaded, ensure content script is ready
    if (changeInfo.status === 'complete') {
      try {
        // Ping content script to see if it's ready
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        
        if (!response) {
          // Content script not ready, log for debugging
          this.logAction('Content script not responding on WhatsApp Web tab', {
            tabId,
            url: tab.url
          });
        }
      } catch (error) {
        // Content script not injected or not ready
        this.logAction('Content script injection may have failed', {
          tabId,
          error: error.message
        });
      }
    }
  }

  async handleAlarm(alarm) {
    switch (alarm.name) {
      case 'cleanup':
        await this.performPeriodicCleanup();
        break;
        
      case 'statsUpdate':
        await this.updateUsageStats();
        break;
        
      default:
        this.logAction('Unknown alarm triggered', { name: alarm.name });
    }
  }

  async initializeDefaultSettings() {
    const defaultSettings = {
      minDelay: 2000,
      maxDelay: 5000,
      autoResponseEnabled: false,
      bulkMessageBatchSize: 50,
      exportFormat: 'csv',
      notifications: true,
      debugMode: false
    };

    const defaultData = {
      settings: defaultSettings,
      autoResponses: [],
      bulkMessages: [],
      contactLists: [],
      messageHistory: [],
      installDate: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };

    await this.setStorageData(defaultData);
    
    this.logAction('Default settings initialized', defaultSettings);
  }

  async showWelcomeNotification() {
    try {
      await chrome.notifications.create('welcome', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'WhatsApp Marketing Manager',
        message: 'Extension installed successfully! Navigate to WhatsApp Web to get started.'
      });
    } catch (error) {
      // Notifications permission not granted, that's okay
      this.logAction('Welcome notification skipped', { error: error.message });
    }
  }

  async performStartupCleanup() {
    try {
      // Clean up old logs (keep only last 100)
      const storage = await this.getStorageData(['actionLogs']);
      const logs = storage.actionLogs || [];
      
      if (logs.length > 100) {
        const trimmedLogs = logs.slice(-100);
        await this.setStorageData({ actionLogs: trimmedLogs });
        
        this.logAction('Old logs cleaned up', { 
          removed: logs.length - 100,
          remaining: 100
        });
      }

      // Clean up old message history (keep only last 500)
      const messageHistory = await this.getStorageData(['messageHistory']);
      const history = messageHistory.messageHistory || [];
      
      if (history.length > 500) {
        const trimmedHistory = history.slice(-500);
        await this.setStorageData({ messageHistory: trimmedHistory });
        
        this.logAction('Old message history cleaned up', {
          removed: history.length - 500,
          remaining: 500
        });
      }

    } catch (error) {
      this.logAction('Startup cleanup failed', { error: error.message });
    }
  }

  async performPeriodicCleanup() {
    await this.performStartupCleanup();
    
    // Update usage statistics
    const stats = await this.getExtensionStats();
    await this.setStorageData({ 
      lastCleanup: new Date().toISOString(),
      usageStats: stats
    });
    
    this.logAction('Periodic cleanup completed', stats);
  }

  async checkRequiredPermissions() {
    const requiredPermissions = {
      permissions: ['activeTab', 'storage', 'scripting'],
      origins: ['https://web.whatsapp.com/*']
    };

    return new Promise((resolve) => {
      chrome.permissions.contains(requiredPermissions, (result) => {
        resolve(result);
      });
    });
  }

  async requestAdditionalPermissions() {
    const optionalPermissions = {
      permissions: ['notifications'],
      origins: []
    };

    return new Promise((resolve) => {
      chrome.permissions.request(optionalPermissions, (granted) => {
        resolve(granted);
      });
    });
  }

  async clearAllStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        this.logAction('All storage cleared');
        resolve();
      });
    });
  }

  async exportLogs() {
    const storage = await this.getStorageData(['actionLogs']);
    return storage.actionLogs || [];
  }

  async getExtensionStats() {
    const storage = await this.getStorageData([
      'autoResponses',
      'bulkMessages', 
      'contactLists',
      'messageHistory',
      'installDate'
    ]);

    const stats = {
      installDate: storage.installDate,
      version: chrome.runtime.getManifest().version,
      autoResponseRules: (storage.autoResponses || []).length,
      messageTemplates: (storage.bulkMessages || []).length,
      contactLists: (storage.contactLists || []).length,
      totalContacts: (storage.contactLists || []).reduce((sum, list) => sum + list.contacts.length, 0),
      messageHistoryEntries: (storage.messageHistory || []).length,
      lastUsed: new Date().toISOString()
    };

    return stats;
  }

  async updateUsageStats() {
    const stats = await this.getExtensionStats();
    await this.setStorageData({ usageStats: stats });
  }

  async getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  async setStorageData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  logAction(action, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      source: 'background'
    };

    console.log('[WhatsApp Marketing Manager - Background]', logEntry);

    // Store in chrome storage for debugging
    chrome.storage.local.get(['actionLogs'], (result) => {
      const logs = result.actionLogs || [];
      logs.push(logEntry);

      // Keep only last 100 logs
      if (logs.length > 100) {
        logs.splice(0, logs.length - 100);
      }

      chrome.storage.local.set({ actionLogs: logs });
    });
  }
}

// Initialize background service
new BackgroundService();