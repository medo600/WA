// services/whatsapp-service.js
class WhatsAppService {
  constructor() {
    this.isInitialized = false;
    this.messageQueue = [];
    this.isProcessingQueue = false;
  }

  async initialize() {
    try {
      await Helpers.waitForElement(WHATSAPP_SELECTORS.CHAT_LIST);
      this.isInitialized = true;
      Helpers.logAction('WhatsApp Service initialized');
      return true;
    } catch (error) {
      Helpers.logAction('WhatsApp Service initialization failed', { error: error.message });
      throw new Error(ERROR_MESSAGES.WHATSAPP_NOT_LOADED);
    }
  }

  async searchContact(phoneNumber) {
    try {
      const searchInput = await Helpers.waitForElement(WHATSAPP_SELECTORS.SEARCH_INPUT);
      
      // Clear search
      searchInput.click();
      await Helpers.delay(500);
      
      // Type phone number
      Helpers.simulateTyping(searchInput, phoneNumber);
      await Helpers.delay(MESSAGE_DELAYS.SEARCH_DELAY);
      
      // Look for contact in search results
      const chatList = document.querySelector(WHATSAPP_SELECTORS.CHAT_LIST);
      const contacts = chatList ? chatList.querySelectorAll(WHATSAPP_SELECTORS.CHAT_ITEM) : [];
      
      for (const contact of contacts) {
        const nameElement = contact.querySelector(WHATSAPP_SELECTORS.CHAT_NAME);
        if (nameElement && nameElement.textContent.includes(phoneNumber)) {
          return contact;
        }
      }
      
      return null;
    } catch (error) {
      Helpers.logAction('Contact search failed', { phoneNumber, error: error.message });
      throw error;
    }
  }

  async openChat(contact) {
    try {
      contact.click();
      await Helpers.delay(1000);
      
      // Wait for message input to be available
      await Helpers.waitForElement(WHATSAPP_SELECTORS.MESSAGE_INPUT);
      return true;
    } catch (error) {
      Helpers.logAction('Failed to open chat', { error: error.message });
      throw error;
    }
  }

  async sendMessage(message, contact = null) {
    try {
      if (contact) {
        await this.openChat(contact);
      }
      
      const messageInput = await Helpers.waitForElement(WHATSAPP_SELECTORS.MESSAGE_INPUT);
      
      // Simulate typing
      Helpers.simulateTyping(messageInput, message);
      await Helpers.delay(MESSAGE_DELAYS.TYPING_DELAY);
      
      // Send message
      const sendButton = await Helpers.waitForElement(WHATSAPP_SELECTORS.SEND_BUTTON);
      sendButton.click();
      
      await Helpers.delay(Helpers.getRandomDelay());
      
      Helpers.logAction('Message sent', { message: message.substring(0, 50) + '...' });
      return true;
    } catch (error) {
      Helpers.logAction('Failed to send message', { error: error.message });
      throw new Error(ERROR_MESSAGES.MESSAGE_SEND_FAILED);
    }
  }

  async checkContactExists(phoneNumber) {
    try {
      const formattedNumber = Helpers.formatPhoneNumber(phoneNumber);
      if (!Helpers.validatePhoneNumber(formattedNumber)) {
        return { exists: false, error: ERROR_MESSAGES.INVALID_NUMBER };
      }
      
      const contact = await this.searchContact(formattedNumber);
      return { 
        exists: contact !== null, 
        phoneNumber: formattedNumber,
        contact: contact
      };
    } catch (error) {
      return { exists: false, error: error.message, phoneNumber };
    }
  }

  async bulkCheckContacts(phoneNumbers, progressCallback) {
    const results = [];
    const total = phoneNumbers.length;
    
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const result = await this.checkContactExists(phoneNumber);
      results.push(result);
      
      if (progressCallback) {
        progressCallback((i + 1) / total * 100, `Checking ${i + 1}/${total}`);
      }
      
      // Add delay to avoid rate limiting
      await Helpers.delay(1000);
    }
    
    return results;
  }

  async sendBulkMessages(contacts, message, progressCallback) {
    const results = [];
    const total = contacts.length;
    
    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      try {
        await this.sendMessage(message, contact.element);
        results.push({ success: true, contact: contact.phoneNumber });
        
        if (progressCallback) {
          progressCallback((i + 1) / total * 100, `Sent ${i + 1}/${total} messages`);
        }
      } catch (error) {
        results.push({ 
          success: false, 
          contact: contact.phoneNumber, 
          error: error.message 
        });
      }
      
      // Random delay between messages
      await Helpers.delay(Helpers.getRandomDelay());
    }
    
    return results;
  }

  async extractGroupContacts() {
    try {
      // Check if we're in a group chat
      const groupInfo = document.querySelector(WHATSAPP_SELECTORS.GROUP_INFO);
      if (!groupInfo) {
        throw new Error('Not in a group chat');
      }
      
      // Open group info
      groupInfo.click();
      await Helpers.delay(1000);
      
      // Wait for participants list
      const participantsList = await Helpers.waitForElement(WHATSAPP_SELECTORS.PARTICIPANTS_LIST);
      const contactCards = participantsList.querySelectorAll(WHATSAPP_SELECTORS.CONTACT_CARD);
      
      const contacts = [];
      
      contactCards.forEach(card => {
        const nameElement = card.querySelector('[data-testid="cell-frame-title"]');
        const phoneElement = card.querySelector('[data-testid="cell-frame-secondary"]');
        
        if (nameElement) {
          const name = nameElement.textContent.trim();
          const phone = phoneElement ? phoneElement.textContent.trim() : '';
          
          contacts.push({
            name,
            phone: Helpers.formatPhoneNumber(phone),
            extractedAt: new Date().toISOString()
          });
        }
      });
      
      Helpers.logAction('Group contacts extracted', { count: contacts.length });
      return contacts;
    } catch (error) {
      Helpers.logAction('Failed to extract group contacts', { error: error.message });
      throw error;
    }
  }

  async setupAutoResponse(keywords, responses) {
    this.autoResponseRules = { keywords, responses };
    
    // Set up message listener
    this.startAutoResponseMonitoring();
    
    Helpers.logAction('Auto-response setup', { 
      keywordCount: keywords.length, 
      responseCount: responses.length 
    });
  }

  startAutoResponseMonitoring() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const messageElements = node.querySelectorAll(WHATSAPP_SELECTORS.INCOMING_MESSAGE);
            messageElements.forEach(this.processIncomingMessage.bind(this));
          }
        });
      });
    });
    
    const messageContainer = document.querySelector(WHATSAPP_SELECTORS.MESSAGE_CONTAINER);
    if (messageContainer) {
      observer.observe(messageContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  async processIncomingMessage(messageElement) {
    if (!this.autoResponseRules) return;
    
    const messageText = messageElement.querySelector(WHATSAPP_SELECTORS.MESSAGE_TEXT);
    if (!messageText) return;
    
    const text = messageText.textContent.toLowerCase();
    
    for (const keyword of this.autoResponseRules.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        const response = this.autoResponseRules.responses[
          Math.floor(Math.random() * this.autoResponseRules.responses.length)
        ];
        
        // Add delay before auto-response
        setTimeout(async () => {
          await this.sendMessage(response);
        }, Helpers.getRandomDelay(3000, 8000));
        
        Helpers.logAction('Auto-response triggered', { keyword, response });
        break;
      }
    }
  }

  clearSearch() {
    const searchInput = document.querySelector(WHATSAPP_SELECTORS.SEARCH_INPUT);
    if (searchInput) {
      searchInput.click();
      Helpers.simulateTyping(searchInput, '');
    }
  }
}