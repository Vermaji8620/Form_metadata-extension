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