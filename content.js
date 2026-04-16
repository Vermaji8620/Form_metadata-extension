// content.js - Final version with text + file input support

let cache = null;
let lastScanTime = 0;
let isStale = true;

console.log('%c✅ Form Inspector content script loaded', 'color: #00ff88; font-weight: bold');

const observer = new MutationObserver(() => {
  isStale = true;
});
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['value', 'disabled', 'required', 'placeholder', 'files']
});

function scanFieldsFast() {
  const start = performance.now();

  const elements = document.querySelectorAll('input, textarea, select');
  const fields = [];

  for (const el of elements) {
    let selector = null;
    if (el.id) {
      selector = `#${CSS.escape(el.id)}`;
    } else if (el.name) {
      selector = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
    }

    const field = {
      tag: el.tagName.toLowerCase(),
      type: el.type || (el.tagName === 'TEXTAREA' ? 'textarea' : ''),
      name: el.name || '',
      id: el.id || '',
      minLength: el.minLength ?? 0,
      maxLength: el.maxLength ?? 0,
      required: el.required || false,
      pattern: el.pattern || '',
      disabled: el.disabled || false,
      readOnly: el.readOnly || false,
      placeholder: el.placeholder || '',
      value: el.value || '',
      selector: selector,
      accept: el.accept || '',
      multiple: el.multiple || false,
      // Additional validation attributes
      min: el.min || '',
      max: el.max || '',
      step: el.step || '',
      autocomplete: el.autocomplete || '',
      inputmode: el.inputmode || '',
      // Custom validation data
      validationRules: getValidationRules(el)
    };

    // Special handling for file inputs
    if (el.type === 'file') {
      field.files = Array.from(el.files || []).map(file => file.name);
    }

    // Special handling for select
    if (el.tagName === 'SELECT') {
      field.options = Array.from(el.options).map(opt => opt.text.trim()).filter(t => t);
      field.optionsCount = el.options.length;
    }

    fields.push(field);
  }

  const durationMs = Number((performance.now() - start).toFixed(2));

  const result = {
    total: fields.length,
    durationMs,
    under30ms: durationMs < 30,
    fields
  };

  cache = result;
  lastScanTime = Date.now();
  isStale = false;
  return result;
}

function getValidationRules(el) {
  const rules = [];

  // Required field
  if (el.required) {
    rules.push({ type: 'required', message: 'Required field' });
  }

  // Length constraints
  if (el.minLength > 0) {
    rules.push({ type: 'minLength', message: `Minimum ${el.minLength} characters` });
  }
  if (el.maxLength > 0) {
    rules.push({ type: 'maxLength', message: `Maximum ${el.maxLength} characters` });
  }

  // Pattern validation
  if (el.pattern) {
    rules.push({ type: 'pattern', message: `Pattern: ${el.pattern}` });
  }

  // File type constraints
  if (el.type === 'file' && el.accept) {
    const acceptedTypes = el.accept.split(',').map(type => type.trim());
    const formattedTypes = acceptedTypes.map(type => {
      if (type.startsWith('.')) {
        return type.substring(1).toUpperCase() + ' files';
      } else if (type.includes('/')) {
        const [mainType, subType] = type.split('/');
        if (subType === '*') {
          return mainType.charAt(0).toUpperCase() + mainType.slice(1) + ' files';
        } else {
          return subType.toUpperCase() + ' files';
        }
      }
      return type;
    });
    rules.push({ type: 'accept', message: `Accepts: ${formattedTypes.join(', ')}` });
  }

  // Number constraints
  if (el.type === 'number') {
    if (el.min !== '' && el.min !== undefined) {
      rules.push({ type: 'min', message: `Minimum value: ${el.min}` });
    }
    if (el.max !== '' && el.max !== undefined) {
      rules.push({ type: 'max', message: `Maximum value: ${el.max}` });
    }
    if (el.step && el.step !== '1') {
      rules.push({ type: 'step', message: `Step: ${el.step}` });
    }
  }

  // Email specific
  if (el.type === 'email') {
    rules.push({ type: 'email', message: 'Must be a valid email address' });
    if (el.multiple) {
      rules.push({ type: 'multiple', message: 'Multiple email addresses allowed (comma-separated)' });
    }
  }

  // URL specific
  if (el.type === 'url') {
    rules.push({ type: 'url', message: 'Must be a valid URL' });
  }

  // Tel specific
  if (el.type === 'tel') {
    rules.push({ type: 'tel', message: 'Must be a valid phone number' });
  }

  // Password specific
  if (el.type === 'password') {
    rules.push({ type: 'password', message: 'Password field' });
  }

  // Date/Time constraints
  if (el.type === 'date' || el.type === 'datetime-local') {
    if (el.min) {
      rules.push({ type: 'min', message: `Earliest: ${new Date(el.min).toLocaleDateString()}` });
    }
    if (el.max) {
      rules.push({ type: 'max', message: `Latest: ${new Date(el.max).toLocaleDateString()}` });
    }
  }

  // Textarea specific
  if (el.tagName === 'TEXTAREA') {
    rules.push({ type: 'textarea', message: 'Multi-line text input' });
  }

  // Select specific
  if (el.tagName === 'SELECT') {
    const optionCount = el.options.length;
    rules.push({ type: 'select', message: `${optionCount} options available` });
  }

  // Autocomplete
  if (el.autocomplete && el.autocomplete !== 'on') {
    rules.push({ type: 'autocomplete', message: `Autocomplete: ${el.autocomplete}` });
  }

  // Input mode
  if (el.inputmode) {
    const modeMessages = {
      'text': 'Text input',
      'decimal': 'Decimal numbers',
      'numeric': 'Numbers only',
      'tel': 'Telephone input',
      'search': 'Search input',
      'email': 'Email input',
      'url': 'URL input'
    };
    rules.push({ type: 'inputmode', message: modeMessages[el.inputmode] || `Input mode: ${el.inputmode}` });
  }

  return rules;
}

// Real-time field monitoring using event delegation
function setupFieldMonitoring() {
  // Use event delegation at document level - survives DOM changes
  document.removeEventListener('input', handleFieldInput);
  document.removeEventListener('change', handleFieldChange);
  
  document.addEventListener('input', handleFieldInput);
  document.addEventListener('change', handleFieldChange);
}

function handleFieldInput(e) {
  const el = e.target;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
    notifyFieldChange(el);
  }
}

function handleFieldChange(e) {
  const el = e.target;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
    notifyFieldChange(el);
  }
}

// Special handler for file inputs - they need the change event specifically
function setupFileInputListeners() {
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(el => {
    // Remove old listener to avoid duplicates
    el.removeEventListener('change', handleFileInputChange);
    // Add new listener
    el.addEventListener('change', handleFileInputChange);
  });
}

function handleFileInputChange(e) {
  const el = e.target;
  notifyFileChange(el);
}

function notifyFileChange(el) {
  let selector = null;
  if (el.id) {
    selector = `#${CSS.escape(el.id)}`;
  } else if (el.name) {
    selector = `input[name="${CSS.escape(el.name)}"]`;
  }

  const fileNames = Array.from(el.files || []).map(file => file.name);
  
  const fieldData = {
    tag: 'input',
    type: 'file',
    name: el.name || '',
    id: el.id || '',
    value: '',
    selector: selector,
    files: fileNames,
    validationRules: getValidationRules(el)
  };

  console.log(`%cFile(s) selected: ${fileNames.join(', ')}`, 'color: #ffcc00');

  // Send update to background script
  chrome.runtime.sendMessage({
    action: 'fieldUpdated',
    field: fieldData
  })
}

function notifyFieldChange(el) {
  let selector = null;
  if (el.id) {
    selector = `#${CSS.escape(el.id)}`;
  } else if (el.name) {
    selector = `${el.tagName.toLowerCase()}[name="${CSS.escape(el.name)}"]`;
  }

  const fieldData = {
    tag: el.tagName.toLowerCase(),
    type: el.type || (el.tagName === 'TEXTAREA' ? 'textarea' : ''),
    name: el.name || '',
    id: el.id || '',
    value: el.value || '',
    selector: selector,
    files: el.type === 'file' ? Array.from(el.files || []).map(file => file.name) : [],
    validationRules: getValidationRules(el)
  };

  // Send update to background script
  chrome.runtime.sendMessage({
    action: 'fieldUpdated',
    field: fieldData
  }).catch(err => {
    // Ignore errors if extension context is destroyed
  });
}

// Initial setup
setupFieldMonitoring();
setupFileInputListeners();

// Re-setup field monitoring when DOM changes significantly
observer.addCallback?.(() => {
  // This will automatically fire when fields are added/removed
  // Event delegation handles the re-attachment
});

// Re-setup file input listeners when new file inputs are added
setInterval(() => {
  setupFileInputListeners();
}, 2000);

// Also manually re-setup on page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    setupFieldMonitoring();
    setupFileInputListeners();
  }
});

function updateFieldValue(selector, newValue, isFileTrigger = false) {
  console.log('%c🔄 updateFieldValue called:', 'color: #ffaa00', { selector, newValue, isFileTrigger });

  if (!selector) {
    console.warn('❌ No selector provided');
    return { success: false, reason: "No selector" };
  }

  const el = document.querySelector(selector);
  console.log('%c🎯 Element found:', 'color: #00aaff', el);

  if (!el) {
    console.warn('❌ Element not found for selector:', selector);
    return { success: false, reason: "Element not found" };
  }

  if (el.type === 'file') {
    if (isFileTrigger) {
      console.log('📁 Triggering file picker...');
      el.click();   // Trigger native file picker
      return { success: true, action: "file_picker_triggered" };
    }
    return { success: false, reason: "Cannot set file value directly" };
  }

  // For text inputs and textarea
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    console.log('✏️ Updating text field value:', newValue);
    el.value = newValue;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  // For select elements
  if (el.tagName === 'SELECT') {
    console.log('📋 Updating select value:', newValue);
    el.value = newValue;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  console.warn('❌ Element not editable:', el.tagName, el.type);
  return { success: false, reason: "Not editable" };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('%c📨 Content script received message:', 'color: #00aaff', request);

  if (request.action === 'ping') {
    console.log('%c🏓 Responding to ping', 'color: #00ffaa');
    sendResponse({ status: 'alive', timestamp: Date.now() });
    return true;
  }

  if (request.action === 'scan') {
    const result = (!isStale && cache && (Date.now() - lastScanTime < 8000))
      ? cache
      : scanFieldsFast();
    console.log('%c📤 Sending scan result:', 'color: #00ffaa', result);
    sendResponse(result);
    return true;
  }

  if (request.action === 'updateValue') {
    const result = updateFieldValue(request.selector, request.value, request.isFileTrigger || false);
    sendResponse(result);
    return true;
  }
});