// content.js
let cache = null;
let lastScanTime = 0;
let isStale = true;

const observer = new MutationObserver(() => {
    isStale = true;                    // Any DOM change = cache invalid
});
observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['value', 'disabled', 'required'] // only fields we care about
});

// FAST SCAN – this is the 30 ms target function
function scanFieldsFast() {
    const start = performance.now();

    const elements = document.querySelectorAll('input, textarea, select');
    const fields = [];

    for (const el of elements) {
        fields.push({
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
            // Select-specific
            optionsCount: el.tagName === 'SELECT' ? el.options.length : 0
        });
    }

    const durationMs = Number((performance.now() - start).toFixed(2));

    const result = {
        total: fields.length,
        durationMs,
        under30ms: durationMs < 30,
        fields
    };

    // Update cache
    cache = result;
    lastScanTime = Date.now();
    isStale = false;

    return result;
}

// Listen for requests from side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scan') {
        // Return cache if fresh
        if (!isStale && cache && (Date.now() - lastScanTime < 5000)) {
            sendResponse(cache);
            return true;
        }
        // Otherwise do fresh fast scan
        const result = scanFieldsFast();
        sendResponse(result);
        return true;
    }
});