// utils/helpers.js
class Helpers {
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static getRandomDelay(min = MESSAGE_DELAYS.MIN_DELAY, max = MESSAGE_DELAYS.MAX_DELAY) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  static formatPhoneNumber(number) {
    // Remove all non-numeric characters
    const cleaned = number.replace(/\D/g, '');
    
    // Add country code if missing
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
      return '1' + cleaned;
    }
    
    return cleaned;
  }

  static validatePhoneNumber(number) {
    const formatted = this.formatPhoneNumber(number);
    return PHONE_NUMBER_REGEX.test(formatted);
  }

  static waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        const element = document.querySelector(selector);
        if (element) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element ${selector} not found within ${timeout}ms`));
        } else {
          setTimeout(checkElement, 100);
        }
      };
      
      checkElement();
    });
  }

  static waitForElementToBeVisible(element, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkVisibility = () => {
        if (element && element.offsetParent !== null) {
          resolve(element);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Element not visible within timeout'));
        } else {
          setTimeout(checkVisibility, 100);
        }
      };
      
      checkVisibility();
    });
  }

  static simulateTyping(element, text) {
    // Clear existing content
    element.textContent = '';
    element.innerHTML = '';
    
    // Focus the element
    element.focus();
    
    // Create and dispatch input events
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: text
    });
    
    // Set the text content
    element.textContent = text;
    element.innerHTML = text;
    
    // Dispatch the event
    element.dispatchEvent(inputEvent);
  }

  static createProgressIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'wam-progress-indicator';
    indicator.innerHTML = `
      <div class="wam-progress-bar">
        <div class="wam-progress-fill"></div>
      </div>
      <div class="wam-progress-text">Processing...</div>
    `;
    return indicator;
  }

  static updateProgress(indicator, progress, text) {
    const fill = indicator.querySelector('.wam-progress-fill');
    const textElement = indicator.querySelector('.wam-progress-text');
    
    if (fill) fill.style.width = `${progress}%`;
    if (textElement) textElement.textContent = text;
  }

  static parseCSV(csvText) {
    try {
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const data = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        data.push(row);
      }
      
      return { headers, data };
    } catch (error) {
      throw new Error(ERROR_MESSAGES.CSV_PARSE_ERROR + ': ' + error.message);
    }
  }

  static generateCSV(data, headers) {
    if (!data || data.length === 0) return '';
    
    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = [csvHeaders.join(',')];
    
    data.forEach(row => {
      const values = csvHeaders.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes
        return `"${value.toString().replace(/"/g, '""')}"`;
      });
      csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
  }

  static downloadCSV(data, filename) {
    const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  static logAction(action, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action,
      details
    };
    
    console.log('[WhatsApp Marketing Manager]', logEntry);
    
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

  static showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `wam-notification wam-notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('wam-notification-show');
    }, 100);
    
    setTimeout(() => {
      notification.classList.remove('wam-notification-show');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}