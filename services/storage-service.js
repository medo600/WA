// services/storage-service.js
class StorageService {
  static async get(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        resolve(result);
      });
    });
  }

  static async set(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => {
        resolve();
      });
    });
  }

  static async remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, () => {
        resolve();
      });
    });
  }

  static async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }

  // Auto Response Management
  static async saveAutoResponses(responses) {
    await this.set({ [STORAGE_KEYS.AUTO_RESPONSES]: responses });
    Helpers.logAction('Auto responses saved', { count: responses.length });
  }

  static async getAutoResponses() {
    const result = await this.get([STORAGE_KEYS.AUTO_RESPONSES]);
    return result[STORAGE_KEYS.AUTO_RESPONSES] || [];
  }

  static async addAutoResponse(keyword, response) {
    const responses = await this.getAutoResponses();
    const newResponse = {
      id: Date.now(),
      keyword,
      response,
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    responses.push(newResponse);
    await this.saveAutoResponses(responses);
    return newResponse;
  }

  static async updateAutoResponse(id, updates) {
    const responses = await this.getAutoResponses();
    const index = responses.findIndex(r => r.id === id);
    
    if (index !== -1) {
      responses[index] = { ...responses[index], ...updates };
      await this.saveAutoResponses(responses);
      return responses[index];
    }
    
    return null;
  }

  static async deleteAutoResponse(id) {
    const responses = await this.getAutoResponses();
    const filtered = responses.filter(r => r.id !== id);
    await this.saveAutoResponses(filtered);
  }

  // Contact List Management
  static async saveContactList(name, contacts) {
    const lists = await this.getContactLists();
    const newList = {
      id: Date.now(),
      name,
      contacts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    lists.push(newList);
    await this.set({ [STORAGE_KEYS.CONTACT_LISTS]: lists });
    
    Helpers.logAction('Contact list saved', { name, contactCount: contacts.length });
    return newList;
  }

  static async getContactLists() {
    const result = await this.get([STORAGE_KEYS.CONTACT_LISTS]);
    return result[STORAGE_KEYS.CONTACT_LISTS] || [];
  }

  static async getContactList(id) {
    const lists = await this.getContactLists();
    return lists.find(list => list.id === id);
  }

  static async updateContactList(id, updates) {
    const lists = await this.getContactLists();
    const index = lists.findIndex(list => list.id === id);
    
    if (index !== -1) {
      lists[index] = { 
        ...lists[index], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      await this.set({ [STORAGE_KEYS.CONTACT_LISTS]: lists });
      return lists[index];
    }
    
    return null;
  }

  static async deleteContactList(id) {
    const lists = await this.getContactLists();
    const filtered = lists.filter(list => list.id !== id);
    await this.set({ [STORAGE_KEYS.CONTACT_LISTS]: filtered });
  }

  // Bulk Message Templates
  static async saveBulkMessageTemplate(name, message, settings = {}) {
    const templates = await this.getBulkMessageTemplates();
    const newTemplate = {
      id: Date.now(),
      name,
      message,
      settings,
      createdAt: new Date().toISOString(),
      usageCount: 0
    };
    
    templates.push(newTemplate);
    await this.set({ [STORAGE_KEYS.BULK_MESSAGES]: templates });
    
    Helpers.logAction('Bulk message template saved', { name });
    return newTemplate;
  }

  static async getBulkMessageTemplates() {
    const result = await this.get([STORAGE_KEYS.BULK_MESSAGES]);
    return result[STORAGE_KEYS.BULK_MESSAGES] || [];
  }

  static async incrementTemplateUsage(id) {
    const templates = await this.getBulkMessageTemplates();
    const template = templates.find(t => t.id === id);
    
    if (template) {
      template.usageCount = (template.usageCount || 0) + 1;
      template.lastUsed = new Date().toISOString();
      await this.set({ [STORAGE_KEYS.BULK_MESSAGES]: templates });
    }
  }

  // Settings Management
  static async getSettings() {
    const result = await this.get([STORAGE_KEYS.SETTINGS]);
    return {
      minDelay: MESSAGE_DELAYS.MIN_DELAY,
      maxDelay: MESSAGE_DELAYS.MAX_DELAY,
      autoResponseEnabled: false,
      bulkMessageBatchSize: 50,
      exportFormat: 'csv',
      ...result[STORAGE_KEYS.SETTINGS]
    };
  }

  static async updateSettings(settings) {
    const currentSettings = await this.getSettings();
    const newSettings = { ...currentSettings, ...settings };
    await this.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
    
    Helpers.logAction('Settings updated', settings);
    return newSettings;
  }

  // Message History
  static async saveMessageHistory(entry) {
    const history = await this.getMessageHistory();
    history.push({
      ...entry,
      id: Date.now(),
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    await this.set({ [STORAGE_KEYS.MESSAGE_HISTORY]: history });
  }

  static async getMessageHistory(limit = 100) {
    const result = await this.get([STORAGE_KEYS.MESSAGE_HISTORY]);
    const history = result[STORAGE_KEYS.MESSAGE_HISTORY] || [];
    
    return history
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  static async clearMessageHistory() {
    await this.set({ [STORAGE_KEYS.MESSAGE_HISTORY]: [] });
    Helpers.logAction('Message history cleared');
  }

  // Export/Import functionality
  static async exportAllData() {
    const data = await this.get([
      STORAGE_KEYS.AUTO_RESPONSES,
      STORAGE_KEYS.BULK_MESSAGES,
      STORAGE_KEYS.CONTACT_LISTS,
      STORAGE_KEYS.SETTINGS,
      STORAGE_KEYS.MESSAGE_HISTORY
    ]);
    
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      data
    };
  }

  static async importData(importData) {
    try {
      if (importData.data) {
        await this.set(importData.data);
        Helpers.logAction('Data imported successfully');
        return true;
      }
      return false;
    } catch (error) {
      Helpers.logAction('Data import failed', { error: error.message });
      throw error;
    }
  }
}