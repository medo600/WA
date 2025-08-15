// utils/constants.js
const WHATSAPP_SELECTORS = {
  CHAT_LIST: '[data-testid="chat-list"]',
  CHAT_ITEM: '[data-testid="list-item-"]',
  CHAT_NAME: '[data-testid="cell-frame-title"]',
  MESSAGE_INPUT: '[data-testid="conversation-compose-box-input"]',
  SEND_BUTTON: '[data-testid="send"]',
  SEARCH_INPUT: '[data-testid="chat-list-search"]',
  NEW_CHAT_BUTTON: '[data-testid="new-chat-button"]',
  CONTACT_PICKER: '[data-testid="contact-picker"]',
  GROUP_INFO: '[data-testid="group-info"]',
  PARTICIPANTS_LIST: '[data-testid="participants-list"]',
  CONTACT_CARD: '[data-testid="contact-card"]',
  MESSAGE_CONTAINER: '[data-testid="conversation-panel-messages"]',
  INCOMING_MESSAGE: '[data-testid="msg-container"]',
  MESSAGE_TEXT: '[data-testid="quoted-text"]'
};

const MESSAGE_DELAYS = {
  MIN_DELAY: 2000, // 2 seconds
  MAX_DELAY: 5000, // 5 seconds
  TYPING_DELAY: 1500, // 1.5 seconds for typing simulation
  SEARCH_DELAY: 1000 // 1 second for search
};

const STORAGE_KEYS = {
  AUTO_RESPONSES: 'autoResponses',
  BULK_MESSAGES: 'bulkMessages',
  CONTACT_LISTS: 'contactLists',
  SETTINGS: 'settings',
  MESSAGE_HISTORY: 'messageHistory'
};

const ERROR_MESSAGES = {
  WHATSAPP_NOT_LOADED: 'WhatsApp Web is not fully loaded',
  CONTACT_NOT_FOUND: 'Contact not found',
  MESSAGE_SEND_FAILED: 'Failed to send message',
  INVALID_NUMBER: 'Invalid phone number format',
  CSV_PARSE_ERROR: 'Error parsing CSV file'
};

const PHONE_NUMBER_REGEX = /^[\+]?[1-9][\d]{0,15}$/;