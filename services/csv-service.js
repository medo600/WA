// services/csv-service.js
class CSVService {
  static async parseCSVFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const csvText = event.target.result;
          const parsedData = Helpers.parseCSV(csvText);
          
          Helpers.logAction('CSV file parsed', { 
            fileName: file.name,
            rows: parsedData.data.length,
            headers: parsedData.headers 
          });
          
          resolve(parsedData);
        } catch (error) {
          Helpers.logAction('CSV parsing failed', { 
            fileName: file.name,
            error: error.message 
          });
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read CSV file'));
      };
      
      reader.readAsText(file);
    });
  }

  static extractPhoneNumbers(data, phoneColumnName = null) {
    const phoneNumbers = [];
    const phoneColumns = phoneColumnName ? [phoneColumnName] : 
      ['phone', 'Phone', 'PHONE', 'number', 'Number', 'mobile', 'Mobile', 'cell', 'Cell'];
    
    data.forEach((row, index) => {
      let phoneNumber = null;
      
      // Find phone number in the row
      for (const column of phoneColumns) {
        if (row[column]) {
          phoneNumber = row[column].toString().trim();
          break;
        }
      }
      
      if (phoneNumber && Helpers.validatePhoneNumber(phoneNumber)) {
        phoneNumbers.push({
          originalNumber: phoneNumber,
          formattedNumber: Helpers.formatPhoneNumber(phoneNumber),
          rowIndex: index,
          rowData: row
        });
      }
    });
    
    Helpers.logAction('Phone numbers extracted from CSV', { 
      total: data.length,
      valid: phoneNumbers.length,
      phoneColumn: phoneColumnName 
    });
    
    return phoneNumbers;
  }

  static async processContactValidation(csvData, progressCallback) {
    const whatsappService = new WhatsAppService();
    await whatsappService.initialize();
    
    const phoneNumbers = this.extractPhoneNumbers(csvData.data);
    const results = [];
    
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneData = phoneNumbers[i];
      
      try {
        const validationResult = await whatsappService.checkContactExists(
          phoneData.formattedNumber
        );
        
        results.push({
          ...phoneData,
          exists: validationResult.exists,
          error: validationResult.error,
          validatedAt: new Date().toISOString()
        });
        
        if (progressCallback) {
          progressCallback(
            ((i + 1) / phoneNumbers.length) * 100,
            `Validated ${i + 1}/${phoneNumbers.length} contacts`
          );
        }
        
        // Add delay to prevent rate limiting
        await Helpers.delay(1500);
        
      } catch (error) {
        results.push({
          ...phoneData,
          exists: false,
          error: error.message,
          validatedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  static generateValidationReport(validationResults) {
    const report = {
      total: validationResults.length,
      valid: validationResults.filter(r => r.exists).length,
      invalid: validationResults.filter(r => !r.exists).length,
      errors: validationResults.filter(r => r.error).length,
      generatedAt: new Date().toISOString()
    };
    
    const csvData = validationResults.map(result => ({
      'Original Number': result.originalNumber,
      'Formatted Number': result.formattedNumber,
      'Exists on WhatsApp': result.exists ? 'Yes' : 'No',
      'Error': result.error || '',
      'Validated At': result.validatedAt,
      'Row Index': result.rowIndex
    }));
    
    return {
      report,
      csvData: Helpers.generateCSV(csvData)
    };
  }

  static async exportGroupContacts(contacts, groupName = 'WhatsApp Group') {
    const csvData = contacts.map((contact, index) => ({
      'Index': index + 1,
      'Name': contact.name,
      'Phone Number': contact.phone,
      'Extracted At': contact.extractedAt,
      'Group': groupName
    }));
    
    const csv = Helpers.generateCSV(csvData);
    const filename = `${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_contacts_${new Date().toISOString().split('T')[0]}.csv`;
    
    Helpers.downloadCSV(csv, filename);
    
    Helpers.logAction('Group contacts exported', { 
      groupName, 
      contactCount: contacts.length,
      filename 
    });
  }

  static async exportContactValidation(validationResults, filename = null) {
    const { csvData } = this.generateValidationReport(validationResults);
    const exportFilename = filename || `whatsapp_validation_${new Date().toISOString().split('T')[0]}.csv`;
    
    Helpers.downloadCSV(csvData, exportFilename);
    
    Helpers.logAction('Contact validation exported', { 
      totalContacts: validationResults.length,
      filename: exportFilename 
    });
  }

  static async exportMessageHistory(history) {
    const csvData = history.map(entry => ({
      'Timestamp': entry.timestamp,
      'Type': entry.type,
      'Contact': entry.contact || '',
      'Message': entry.message || '',
      'Status': entry.status,
      'Error': entry.error || ''
    }));
    
    const csv = Helpers.generateCSV(csvData);
    const filename = `message_history_${new Date().toISOString().split('T')[0]}.csv`;
    
    Helpers.downloadCSV(csv, filename);
    
    Helpers.logAction('Message history exported', { 
      entryCount: history.length,
      filename 
    });
  }

  static detectPhoneColumns(headers) {
    const phonePatterns = [
      /phone/i, /number/i, /mobile/i, /cell/i, /contact/i, /tel/i
    ];
    
    return headers.filter(header => 
      phonePatterns.some(pattern => pattern.test(header))
    );
  }

  static validateCSVStructure(data) {
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('CSV file is empty or invalid');
    }
    
    if (!data.headers || data.headers.length === 0) {
      throw new Error('CSV file has no headers');
    }
    
    const phoneColumns = this.detectPhoneColumns(data.headers);
    if (phoneColumns.length === 0) {
      throw new Error('No phone number columns detected. Expected columns like: phone, number, mobile, cell, contact');
    }
    
    return {
      isValid: true,
      phoneColumns,
      rowCount: data.data.length,
      headerCount: data.headers.length
    };
  }

  static async importBulkContacts(file, listName) {
    try {
      const csvData = await this.parseCSVFile(file);
      const validation = this.validateCSVStructure(csvData);
      
      const phoneNumbers = this.extractPhoneNumbers(csvData.data);
      
      if (phoneNumbers.length === 0) {
        throw new Error('No valid phone numbers found in the CSV file');
      }
      
      const contacts = phoneNumbers.map(phone => ({
        name: phone.rowData.name || phone.rowData.Name || `Contact ${phone.rowIndex + 1}`,
        phone: phone.formattedNumber,
        originalData: phone.rowData,
        importedAt: new Date().toISOString()
      }));
      
      const contactList = await StorageService.saveContactList(listName, contacts);
      
      Helpers.logAction('Bulk contacts imported', {
        fileName: file.name,
        listName,
        contactCount: contacts.length,
        validPhoneNumbers: phoneNumbers.length
      });
      
      return {
        success: true,
        contactList,
        importedCount: contacts.length,
        validationInfo: validation
      };
      
    } catch (error) {
      Helpers.logAction('Bulk contact import failed', {
        fileName: file.name,
        error: error.message
      });
      throw error;
    }
  }
}