// content.js - Final version with text + file input support

let cache = null;
let lastScanTime = 0;
let isStale = true;

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
      multiple: el.multiple || false
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

function updateFieldValue(selector, newValue, isFileTrigger = false) {
  if (!selector) return { success: false, reason: "No selector" };

  const el = document.querySelector(selector);
  if (!el) return { success: false, reason: "Element not found" };

  if (el.type === 'file') {
    if (isFileTrigger) {
      el.click();   // Trigger native file picker
      return { success: true, action: "file_picker_triggered" };
    }
    return { success: false, reason: "Cannot set file value directly" };
  }

  // For text inputs and textarea
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.value = newValue;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { success: true };
  }

  return { success: false, reason: "Not editable" };
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
    files: fileNames
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
    files: el.type === 'file' ? Array.from(el.files || []).map(file => file.name) : []
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    const result = (!isStale && cache && (Date.now() - lastScanTime < 8000))
      ? cache
      : scanFieldsFast();
    sendResponse(result);
    return true;
  }

  if (request.action === 'updateValue') {
    const result = updateFieldValue(request.selector, request.value, request.isFileTrigger || false);
    sendResponse(result);
    return true;
  }
});