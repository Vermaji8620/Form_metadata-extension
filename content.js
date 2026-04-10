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
  attributeFilter: ['value', 'disabled', 'required', 'placeholder']
});

function scanFieldsFast() {
  const start = performance.now();

  const elements = document.querySelectorAll('input, textarea, select');
  const fields = [];

  for (const el of elements) {
    const field = {
      tag: el.tagName.toLowerCase(),
      type: el.type || (el.tagName === 'TEXTAREA' ? 'textarea' : ''),
      name: el.name || '',
      id: el.id || '',
      accept: el.accept || '',
      minLength: el.minLength ?? 0,
      maxLength: el.maxLength ?? 0,
      required: el.required || false,
      pattern: el.pattern || '',
      multiple: el.multiple || false,
      disabled: el.disabled || false,
      readOnly: el.readOnly || false,
      placeholder: el.placeholder || '',
      value: el.value || '',                    // Current entered value
      optionsCount: el.tagName === 'SELECT' ? el.options.length : 0
    };

    // For select: capture all option texts
    if (el.tagName === 'SELECT') {
      field.options = Array.from(el.options).map(opt => opt.text.trim()).filter(text => text !== '');
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    if (!isStale && cache && (Date.now() - lastScanTime < 5000)) {
      sendResponse(cache);
      return true;
    }
    const result = scanFieldsFast();
    sendResponse(result);
    return true;
  }
});