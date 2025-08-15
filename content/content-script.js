// content/content-script.js
class WhatsAppMarketingManager {
  constructor() {
    this.whatsappService = new WhatsAppService();
    this.isInitialized = false;
    this.activeOperations = new Map();
    this.init();
  }

  async init() {
    try {
      // Wait for WhatsApp Web to load
      await this.waitForWhatsAppLoad();
      
      // Initialize services
      await this.whatsappService.initialize();
      
      // Create UI components
      this.createFloatingPanel();
      this.setupEventListeners();
      
      // Load saved settings
      await this.loadSettings();
      
      this.isInitialized = true;
      Helpers.logAction('WhatsApp Marketing Manager initialized');
      Helpers.showNotification('WhatsApp Marketing Manager is ready!', 'success');
      
    } catch (error) {
      Helpers.logAction('Initialization failed', { error: error.message });
      Helpers.showNotification('Failed to initialize extension', 'error');
    }
  }

  async waitForWhatsAppLoad() {
    return new Promise((resolve, reject) => {
      const checkLoaded = () => {
        const chatList = document.querySelector(WHATSAPP_SELECTORS.CHAT_LIST);
        const searchInput = document.querySelector(WHATSAPP_SELECTORS.SEARCH_INPUT);
        
        if (chatList && searchInput) {
          resolve();
        } else {
          setTimeout(checkLoaded, 1000);
        }
      };
      
      checkLoaded();
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('WhatsApp Web failed to load within 30 seconds'));
      }, 30000);
    });
  }

  createFloatingPanel() {
    const panel = document.createElement('div');
    panel.id = 'wam-floating-panel';
    panel.className = 'wam-floating-panel';
    
    panel.innerHTML = `
      <div class="wam-panel-header">
        <h3>WhatsApp Marketing Manager</h3>
        <button class="wam-toggle-btn" id="wamToggleBtn">−</button>
      </div>
      <div class="wam-panel-content" id="wamPanelContent">
        <div class="wam-tabs">
          <button class="wam-tab active" data-tab="bulk">Bulk Messages</button>
          <button class="wam-tab" data-tab="auto">Auto Response</button>
          <button class="wam-tab" data-tab="contacts">Contacts</button>
          <button class="wam-tab" data-tab="settings">Settings</button>
        </div>
        
        <div class="wam-tab-content active" id="wam-bulk-tab">
          <div class="wam-form-group">
            <label>Message Template:</label>
            <textarea id="wamBulkMessage" placeholder="Enter your message here..." rows="4"></textarea>
          </div>
          <div class="wam-form-group">
            <label>Contact List:</label>
            <select id="wamContactList">
              <option value="">Select a contact list...</option>
            </select>
          </div>
          <div class="wam-form-row">
            <button class="wam-btn wam-btn-primary" id="wamSendBulk">Send Messages</button>
            <button class="wam-btn wam-btn-secondary" id="wamPreviewBulk">Preview</button>
          </div>
          <div class="wam-progress-container" id="wamBulkProgress" style="display: none;">
            <div class="wam-progress-bar">
              <div class="wam-progress-fill"></div>
            </div>
            <div class="wam-progress-text">Ready to send...</div>
          </div>
        </div>
        
        <div class="wam-tab-content" id="wam-auto-tab">
          <div class="wam-form-group">
            <label>Keywords (comma separated):</label>
            <input type="text" id="wamAutoKeywords" placeholder="hello, hi, info, price">
          </div>
          <div class="wam-form-group">
            <label>Auto Response:</label>
            <textarea id="wamAutoResponse" placeholder="Thank you for your message..." rows="3"></textarea>
          </div>
          <div class="wam-form-row">
            <button class="wam-btn wam-btn-primary" id="wamSaveAutoResponse">Save Rule</button>
            <label class="wam-checkbox">
              <input type="checkbox" id="wamAutoEnabled">
              <span>Enable Auto Response</span>
            </label>
          </div>
          <div class="wam-auto-rules" id="wamAutoRulesList"></div>
        </div>
        
        <div class="wam-tab-content" id="wam-contacts-tab">
          <div class="wam-form-group">
            <label>Import Contacts:</label>
            <input type="file" id="wamImportCSV" accept=".csv" style="display: none;">
            <button class="wam-btn wam-btn-secondary" onclick="document.getElementById('wamImportCSV').click()">
              Import CSV
            </button>
            <input type="text" id="wamListName" placeholder="Contact list name" style="margin-left: 10px;">
          </div>
          <div class="wam-form-row">
            <button class="wam-btn wam-btn-primary" id="wamExtractGroup">Extract Group Contacts</button>
            <button class="wam-btn wam-btn-secondary" id="wamValidateContacts">Validate Numbers</button>
          </div>
          <div class="wam-contact-lists" id="wamContactLists"></div>
        </div>
        
        <div class="wam-tab-content" id="wam-settings-tab">
          <div class="wam-form-group">
            <label>Message Delay (seconds):</label>
            <div class="wam-form-row">
              <input type="number" id="wamMinDelay" min="1" max="60" value="2">
              <span>to</span>
              <input type="number" id="wamMaxDelay" min="1" max="60" value="5">
            </div>
          </div>
          <div class="wam-form-group">
            <label>Batch Size:</label>
            <input type="number" id="wamBatchSize" min="1" max="100" value="50">
          </div>
          <div class="wam-form-row">
            <button class="wam-btn wam-btn-primary" id="wamSaveSettings">Save Settings</button>
            <button class="wam-btn wam-btn-danger" id="wamClearData">Clear All Data</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(panel);
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.wam-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Panel toggle
    document.getElementById('wamToggleBtn').addEventListener('click', this.togglePanel);

    // Bulk messaging
    document.getElementById('wamSendBulk').addEventListener('click', () => this.sendBulkMessages());
    document.getElementById('wamPreviewBulk').addEventListener('click', () => this.previewBulkMessages());

    // Auto response
    document.getElementById('wamSaveAutoResponse').addEventListener('click', () => this.saveAutoResponse());
    document.getElementById('wamAutoEnabled').addEventListener('change', (e) => this.toggleAutoResponse(e.target.checked));

    // Contacts
    document.getElementById('wamImportCSV').addEventListener('change', (e) => this.importCSV(e.target.files[0]));
    document.getElementById('wamExtractGroup').addEventListener('click', () => this.extractGroupContacts());
    document.getElementById('wamValidateContacts').addEventListener('click', () => this.validateContacts());

    // Settings
    document.getElementById('wamSaveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('wamClearData').addEventListener('click', () => this.clearAllData());

    // Make panel draggable
    this.makeDraggable();
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.wam-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.wam-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`wam-${tabName}-tab`).classList.add('active');

    // Load tab-specific data
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case 'bulk':
        await this.loadContactLists();
        break;
      case 'auto':
        await this.loadAutoResponseRules();
        break;
      case 'contacts':
        await this.loadContactListsView();
        break;
      case 'settings':
        await this.loadCurrentSettings();
        break;
    }
  }

  async loadContactLists() {
    const lists = await StorageService.getContactLists();
    const select = document.getElementById('wamContactList');
    
    select.innerHTML = '<option value="">Select a contact list...</option>';
    lists.forEach(list => {
      const option = document.createElement('option');
      option.value = list.id;
      option.textContent = `${list.name} (${list.contacts.length} contacts)`;
      select.appendChild(option);
    });
  }

  async sendBulkMessages() {
    const message = document.getElementById('wamBulkMessage').value.trim();
    const listId = document.getElementById('wamContactList').value;
    
    if (!message) {
      Helpers.showNotification('Please enter a message', 'error');
      return;
    }
    
    if (!listId) {
      Helpers.showNotification('Please select a contact list', 'error');
      return;
    }
    
    try {
      const contactList = await StorageService.getContactList(listId);
      if (!contactList) {
        Helpers.showNotification('Contact list not found', 'error');
        return;
      }
      
      const progressContainer = document.getElementById('wamBulkProgress');
      const progressFill = progressContainer.querySelector('.wam-progress-fill');
      const progressText = progressContainer.querySelector('.wam-progress-text');
      
      progressContainer.style.display = 'block';
      
      // Validate contacts exist on WhatsApp first
      const validContacts = [];
      for (let i = 0; i < contactList.contacts.length; i++) {
        const contact = contactList.contacts[i];
        const result = await this.whatsappService.checkContactExists(contact.phone);
        
        if (result.exists) {
          validContacts.push({
            ...contact,
            element: result.contact
          });
        }
        
        const progress = ((i + 1) / contactList.contacts.length) * 50; // 50% for validation
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `Validating ${i + 1}/${contactList.contacts.length}`;
      }
      
      if (validContacts.length === 0) {
        Helpers.showNotification('No valid contacts found on WhatsApp', 'error');
        progressContainer.style.display = 'none';
        return;
      }
      
      // Send messages
      const results = await this.whatsappService.sendBulkMessages(
        validContacts,
        message,
        (progress, text) => {
          const totalProgress = 50 + (progress * 0.5); // 50% + remaining 50%
          progressFill.style.width = `${totalProgress}%`;
          progressText.textContent = text;
        }
      );
      
      progressContainer.style.display = 'none';
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      Helpers.showNotification(
        `Messages sent: ${successful} successful, ${failed} failed`,
        successful > 0 ? 'success' : 'error'
      );
      
      // Save to message history
      await StorageService.saveMessageHistory({
        type: 'bulk',
        message,
        contactListId: listId,
        totalContacts: contactList.contacts.length,
        validContacts: validContacts.length,
        successful,
        failed,
        results
      });
      
    } catch (error) {
      Helpers.showNotification('Failed to send bulk messages: ' + error.message, 'error');
      document.getElementById('wamBulkProgress').style.display = 'none';
    }
  }

  async saveAutoResponse() {
    const keywords = document.getElementById('wamAutoKeywords').value.split(',').map(k => k.trim()).filter(k => k);
    const response = document.getElementById('wamAutoResponse').value.trim();
    
    if (keywords.length === 0 || !response) {
      Helpers.showNotification('Please enter keywords and response', 'error');
      return;
    }
    
    try {
      await StorageService.addAutoResponse(keywords.join(', '), response);
      
      // Clear form
      document.getElementById('wamAutoKeywords').value = '';
      document.getElementById('wamAutoResponse').value = '';
      
      // Reload rules list
      await this.loadAutoResponseRules();
      
      Helpers.showNotification('Auto response rule saved', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to save auto response: ' + error.message, 'error');
    }
  }

  async loadAutoResponseRules() {
    const rules = await StorageService.getAutoResponses();
    const container = document.getElementById('wamAutoRulesList');
    
    container.innerHTML = '';
    
    rules.forEach(rule => {
      const ruleElement = document.createElement('div');
      ruleElement.className = 'wam-auto-rule';
      ruleElement.innerHTML = `
        <div class="wam-rule-content">
          <strong>Keywords:</strong> ${rule.keyword}<br>
          <strong>Response:</strong> ${rule.response.substring(0, 100)}${rule.response.length > 100 ? '...' : ''}
        </div>
        <div class="wam-rule-actions">
          <label class="wam-checkbox">
            <input type="checkbox" ${rule.isActive ? 'checked' : ''} 
                   onchange="wamManager.toggleAutoResponseRule(${rule.id}, this.checked)">
            <span>Active</span>
          </label>
          <button class="wam-btn-small wam-btn-danger" onclick="wamManager.deleteAutoResponseRule(${rule.id})">Delete</button>
        </div>
      `;
      container.appendChild(ruleElement);
    });
  }

  async importCSV(file) {
    if (!file) return;
    
    const listName = document.getElementById('wamListName').value.trim() || 
                     `Imported ${new Date().toLocaleDateString()}`;
    
    try {
      const result = await CSVService.importBulkContacts(file, listName);
      
      Helpers.showNotification(
        `Successfully imported ${result.importedCount} contacts`,
        'success'
      );
      
      // Clear form
      document.getElementById('wamImportCSV').value = '';
      document.getElementById('wamListName').value = '';
      
      // Reload contact lists
      await this.loadContactListsView();
      
    } catch (error) {
      Helpers.showNotification('Import failed: ' + error.message, 'error');
    }
  }

  async extractGroupContacts() {
    try {
      const contacts = await this.whatsappService.extractGroupContacts();
      
      if (contacts.length === 0) {
        Helpers.showNotification('No contacts found in the group', 'warning');
        return;
      }
      
      // Export to CSV
      const groupName = prompt('Enter group name for the export:', 'WhatsApp Group') || 'WhatsApp Group';
      await CSVService.exportGroupContacts(contacts, groupName);
      
      // Also save as contact list
      const saveToList = confirm('Would you like to save these contacts as a contact list?');
      if (saveToList) {
        await StorageService.saveContactList(`${groupName} Contacts`, contacts);
        await this.loadContactListsView();
      }
      
      Helpers.showNotification(`Extracted ${contacts.length} contacts from group`, 'success');
      
    } catch (error) {
      Helpers.showNotification('Failed to extract group contacts: ' + error.message, 'error');
    }
  }

  async validateContacts() {
    const lists = await StorageService.getContactLists();
    
    if (lists.length === 0) {
      Helpers.showNotification('No contact lists available for validation', 'warning');
      return;
    }
    
    // Simple list selection for demo - in production, you'd want a proper modal
    const listNames = lists.map((list, index) => `${index}: ${list.name} (${list.contacts.length} contacts)`);
    const selection = prompt(`Select a list to validate:\n${listNames.join('\n')}\n\nEnter the number:`);
    
    const selectedIndex = parseInt(selection);
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= lists.length) {
      Helpers.showNotification('Invalid selection', 'error');
      return;
    }
    
    const selectedList = lists[selectedIndex];
    const phoneNumbers = selectedList.contacts.map(c => c.phone);
    
    try {
      const results = await this.whatsappService.bulkCheckContacts(phoneNumbers, (progress, text) => {
        // You could show a progress indicator here
        console.log(`Validation progress: ${progress}% - ${text}`);
      });
      
      await CSVService.exportContactValidation(results);
      
      const validCount = results.filter(r => r.exists).length;
      Helpers.showNotification(
        `Validation complete: ${validCount}/${results.length} contacts exist on WhatsApp`,
        'success'
      );
      
    } catch (error) {
      Helpers.showNotification('Validation failed: ' + error.message, 'error');
    }
  }

  async loadContactListsView() {
    const lists = await StorageService.getContactLists();
    const container = document.getElementById('wamContactLists');
    
    container.innerHTML = '';
    
    lists.forEach(list => {
      const listElement = document.createElement('div');
      listElement.className = 'wam-contact-list';
      listElement.innerHTML = `
        <div class="wam-list-info">
          <h4>${list.name}</h4>
          <p>${list.contacts.length} contacts • Created: ${new Date(list.createdAt).toLocaleDateString()}</p>
        </div>
        <div class="wam-list-actions">
          <button class="wam-btn-small" onclick="wamManager.exportContactList(${list.id})">Export</button>
          <button class="wam-btn-small wam-btn-danger" onclick="wamManager.deleteContactList(${list.id})">Delete</button>
        </div>
      `;
      container.appendChild(listElement);
    });
  }

  async saveSettings() {
    const minDelay = parseInt(document.getElementById('wamMinDelay').value) * 1000;
    const maxDelay = parseInt(document.getElementById('wamMaxDelay').value) * 1000;
    const batchSize = parseInt(document.getElementById('wamBatchSize').value);
    
    try {
      await StorageService.updateSettings({
        minDelay,
        maxDelay,
        bulkMessageBatchSize: batchSize
      });
      
      Helpers.showNotification('Settings saved', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to save settings: ' + error.message, 'error');
    }
  }

  async loadSettings() {
    const settings = await StorageService.getSettings();
    
    document.getElementById('wamMinDelay').value = settings.minDelay / 1000;
    document.getElementById('wamMaxDelay').value = settings.maxDelay / 1000;
    document.getElementById('wamBatchSize').value = settings.bulkMessageBatchSize;
    document.getElementById('wamAutoEnabled').checked = settings.autoResponseEnabled;
    
    if (settings.autoResponseEnabled) {
      await this.setupAutoResponse();
    }
  }

  async setupAutoResponse() {
    const responses = await StorageService.getAutoResponses();
    const activeRules = responses.filter(r => r.isActive);
    
    if (activeRules.length > 0) {
      const keywords = activeRules.map(r => r.keyword.split(', ')).flat();
      const responseTexts = activeRules.map(r => r.response);
      
      await this.whatsappService.setupAutoResponse(keywords, responseTexts);
    }
  }

  togglePanel() {
    const content = document.getElementById('wamPanelContent');
    const toggleBtn = document.getElementById('wamToggleBtn');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      toggleBtn.textContent = '−';
    } else {
      content.style.display = 'none';
      toggleBtn.textContent = '+';
    }
  }

  makeDraggable() {
    const panel = document.getElementById('wam-floating-panel');
    const header = panel.querySelector('.wam-panel-header');
    
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;
    
    header.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);
    
    function dragStart(e) {
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      
      if (e.target === header || header.contains(e.target)) {
        isDragging = true;
      }
    }
    
    function drag(e) {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        
        panel.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }
    }
    
    function dragEnd(e) {
      initialX = currentX;
      initialY = currentY;
      isDragging = false;
    }
  }

  // Utility methods for UI interactions
  async toggleAutoResponseRule(id, isActive) {
    try {
      await StorageService.updateAutoResponse(id, { isActive });
      
      if (document.getElementById('wamAutoEnabled').checked) {
        await this.setupAutoResponse();
      }
      
      Helpers.showNotification('Auto response rule updated', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to update rule: ' + error.message, 'error');
    }
  }

  async deleteAutoResponseRule(id) {
    if (!confirm('Are you sure you want to delete this auto response rule?')) {
      return;
    }
    
    try {
      await StorageService.deleteAutoResponse(id);
      await this.loadAutoResponseRules();
      
      Helpers.showNotification('Auto response rule deleted', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to delete rule: ' + error.message, 'error');
    }
  }

  async exportContactList(id) {
    try {
      const list = await StorageService.getContactList(id);
      if (!list) {
        Helpers.showNotification('Contact list not found', 'error');
        return;
      }
      
      const csvData = list.contacts.map((contact, index) => ({
        'Index': index + 1,
        'Name': contact.name,
        'Phone': contact.phone,
        'Added': contact.importedAt || contact.extractedAt || '',
        'Original Data': JSON.stringify(contact.originalData || {})
      }));
      
      const csv = Helpers.generateCSV(csvData);
      const filename = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      
      Helpers.downloadCSV(csv, filename);
      
      Helpers.showNotification('Contact list exported successfully', 'success');
    } catch (error) {
      Helpers.showNotification('Export failed: ' + error.message, 'error');
    }
  }

  async deleteContactList(id) {
    if (!confirm('Are you sure you want to delete this contact list?')) {
      return;
    }
    
    try {
      await StorageService.deleteContactList(id);
      await this.loadContactListsView();
      await this.loadContactLists(); // Refresh bulk message dropdown
      
      Helpers.showNotification('Contact list deleted', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to delete contact list: ' + error.message, 'error');
    }
  }

  async toggleAutoResponse(enabled) {
    try {
      await StorageService.updateSettings({ autoResponseEnabled: enabled });
      
      if (enabled) {
        await this.setupAutoResponse();
        Helpers.showNotification('Auto response enabled', 'success');
      } else {
        Helpers.showNotification('Auto response disabled', 'success');
      }
    } catch (error) {
      Helpers.showNotification('Failed to toggle auto response: ' + error.message, 'error');
    }
  }

  async previewBulkMessages() {
    const message = document.getElementById('wamBulkMessage').value.trim();
    const listId = document.getElementById('wamContactList').value;
    
    if (!message) {
      Helpers.showNotification('Please enter a message to preview', 'error');
      return;
    }
    
    if (!listId) {
      Helpers.showNotification('Please select a contact list', 'error');
      return;
    }
    
    try {
      const contactList = await StorageService.getContactList(listId);
      if (!contactList) {
        Helpers.showNotification('Contact list not found', 'error');
        return;
      }
      
      const previewWindow = window.open('', '_blank', 'width=600,height=400');
      previewWindow.document.write(`
        <html>
          <head>
            <title>Bulk Message Preview</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .preview-header { background: #25d366; color: white; padding: 15px; margin-bottom: 20px; }
              .message-preview { background: #f0f0f0; padding: 15px; margin-bottom: 20px; border-radius: 8px; }
              .contact-list { max-height: 200px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; }
              .contact-item { padding: 5px; border-bottom: 1px solid #eee; }
            </style>
          </head>
          <body>
            <div class="preview-header">
              <h2>Bulk Message Preview</h2>
            </div>
            <div class="message-preview">
              <h3>Message:</h3>
              <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div>
              <h3>Recipients (${contactList.contacts.length} contacts):</h3>
              <div class="contact-list">
                ${contactList.contacts.map(contact => 
                  `<div class="contact-item">${contact.name} - ${contact.phone}</div>`
                ).join('')}
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      Helpers.showNotification('Failed to generate preview: ' + error.message, 'error');
    }
  }

  async loadCurrentSettings() {
    const settings = await StorageService.getSettings();
    
    document.getElementById('wamMinDelay').value = settings.minDelay / 1000;
    document.getElementById('wamMaxDelay').value = settings.maxDelay / 1000;
    document.getElementById('wamBatchSize').value = settings.bulkMessageBatchSize;
  }

  async clearAllData() {
    if (!confirm('Are you sure you want to clear all extension data? This action cannot be undone.')) {
      return;
    }
    
    const confirmed = prompt('Type "DELETE" to confirm this action:');
    if (confirmed !== 'DELETE') {
      Helpers.showNotification('Action cancelled', 'info');
      return;
    }
    
    try {
      await StorageService.clear();
      
      // Reset UI
      document.getElementById('wamContactList').innerHTML = '<option value="">Select a contact list...</option>';
      document.getElementById('wamAutoRulesList').innerHTML = '';
      document.getElementById('wamContactLists').innerHTML = '';
      
      // Reset form fields
      document.getElementById('wamBulkMessage').value = '';
      document.getElementById('wamAutoKeywords').value = '';
      document.getElementById('wamAutoResponse').value = '';
      document.getElementById('wamAutoEnabled').checked = false;
      
      Helpers.showNotification('All data cleared successfully', 'success');
    } catch (error) {
      Helpers.showNotification('Failed to clear data: ' + error.message, 'error');
    }
  }
}

// Initialize the extension when DOM is ready
let wamManager;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    wamManager = new WhatsAppMarketingManager();
    window.wamManager = wamManager; // Make globally accessible for UI callbacks
  });
} else {
  wamManager = new WhatsAppMarketingManager();
  window.wamManager = wamManager;
}

// Handle extension messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getStatus':
      sendResponse({ 
        initialized: wamManager?.isInitialized || false,
        activeOperations: wamManager?.activeOperations?.size || 0
      });
      break;
      
    case 'exportData':
      StorageService.exportAllData().then(data => {
        sendResponse({ success: true, data });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
      
    case 'importData':
      StorageService.importData(message.data).then(() => {
        sendResponse({ success: true });
        // Reload the extension data
        if (wamManager) {
          wamManager.loadSettings();
          wamManager.loadTabData('bulk');
          wamManager.loadTabData('auto');
          wamManager.loadTabData('contacts');
        }
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
      
    case 'pauseOperations':
      // Implement pause functionality if needed
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});

// Global error handler
window.addEventListener('error', (event) => {
  Helpers.logAction('JavaScript Error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Cleanup when page is unloaded
window.addEventListener('beforeunload', () => {
  if (wamManager) {
    Helpers.logAction('Extension unloading');
  }
});