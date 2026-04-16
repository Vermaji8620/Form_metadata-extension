// sidepanel.js - Final version with text editing + file upload support + real-time updates

let backgroundPort = null;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Connect to background script for real-time updates
function connectToBackground() {
  try {
    backgroundPort = chrome.runtime.connect({ name: 'sidepanel' });

    backgroundPort.onMessage.addListener((request) => {
      if (request.action === 'fieldUpdated') {
        updateFieldDisplay(request.field);
      }
    });

    backgroundPort.onDisconnect.addListener(() => {
      console.log('%c⚠️ Port disconnected, attempting to reconnect...', 'color: #ffaa00');
      // Attempt to reconnect after a brief delay
      setTimeout(() => {
        connectToBackground();
      }, 1000);
    });
  } catch (err) {
    console.error('Failed to connect to background:', err);
    // Retry connection
    setTimeout(() => {
      connectToBackground();
    }, 1000);
  }
}

// Update a specific field's display in real-time
function updateFieldDisplay(field) {
  if (!field || !field.selector) return;

  // Handle file input fields
  if (field.type === 'file') {
    const escapedSelector = field.selector.replace(/"/g, '&quot;').replace(/\\/g, '\\\\');
    const fileDiv = document.querySelector(`[data-file-selector="${escapedSelector}"]`);
    
    if (fileDiv) {
      if (field.files && field.files.length > 0) {
        const fileList = field.files.map(name => `📎 ${escapeHtml(name)}`).join('<br>');
        fileDiv.innerHTML = fileList;
        console.log(`%cFile field updated: ${field.selector}`, 'color: #00ffaa');
      } else {
        fileDiv.innerHTML = '(No file selected)';
      }
      return;
    }
  }

  // Handle text input fields
  const inputs = document.querySelectorAll('.field input[data-selector]');
  for (const input of inputs) {
    if (input.dataset.selector === field.selector) {
      const oldValue = input.value;
      input.value = field.value || '';
      
      // Only log if value changed to avoid spam
      if (oldValue !== input.value) {
        console.log(`%cField updated: ${field.selector}`, 'color: #00ffaa');
      }
      return;
    }
  }
  
  console.log(`%cField not found in panel yet: ${field.selector}`, 'color: #ffaa00');
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function requestScan() {
  const tab = await getActiveTab();
  console.log('%c🔍 Attempting to scan tab:', 'color: #ffaa00', tab);

  try {
    // First check if content script is loaded
    console.log('%c🔍 Checking if content script is loaded...', 'color: #ffaa00');
    const testResponse = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    console.log('%c✅ Content script responded to ping:', 'color: #00ff88', testResponse);
  } catch (pingErr) {
    console.warn('%c⚠️ Content script not responding to ping, attempting to inject...', 'color: #ffaa00', pingErr);

    // Try to inject content script manually
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      console.log('%c✅ Content script injected manually', 'color: #00ff88');

      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (injectErr) {
      console.error('%c❌ Failed to inject content script:', 'color: #ff5555', injectErr);
    }
  }

  try {
    console.log('%c📤 Sending scan message to content script...', 'color: #00aaff');
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    console.log('%c📨 Received scan response:', 'color: #00ffaa', response);
    renderSummary(response);
    renderFields(response.fields, tab.id);
  } catch (err) {
    console.error("Scan failed:", err);
    document.getElementById('summary').innerHTML = `
      <div style="color:#ff5555;padding:10px">
        Cannot scan this page.<br>
        <small>Error: ${err.message}</small><br>
        <small>Make sure the page is fully loaded and content script is injected.</small>
      </div>`;
  }
}

function formatLength(min, max) {
  if (min <= 0 && max <= 0) return null;
  if (min <= 0) return `max: ${max}`;
  if (max <= 0) return `min: ${min}`;
  return `${min} — ${max}`;
}

function renderValidationRules(rules) {
  if (!rules || rules.length === 0) return '';

  let html = `<div style="margin-top:8px; padding:8px; background:#1a1a1a; border-radius:4px; border-left:3px solid #ffaa00;">
    <strong style="color:#ffaa00; font-size:12px;">📋 VALIDATION RULES:</strong><br>`;

  rules.forEach(rule => {
    const icon = getValidationIcon(rule.type);
    html += `<div style="margin:4px 0; font-size:11px; color:#ccc;">
      ${icon} ${escapeHtml(rule.message)}
    </div>`;
  });

  html += `</div>`;
  return html;
}

function getValidationIcon(type) {
  const icons = {
    required: '🔴',
    minLength: '📏',
    maxLength: '📐',
    pattern: '🔍',
    accept: '📁',
    min: '⬇️',
    max: '⬆️',
    step: '📊',
    email: '📧',
    url: '🌐',
    tel: '📞',
    password: '🔒',
    textarea: '📝',
    select: '📋',
    autocomplete: '🔄',
    inputmode: '⌨️',
    multiple: '➕'
  };
  return icons[type] || '⚙️';
}

function renderSummary(data) {
  const html = `
    <div class="summary">
      <strong>Total fields:</strong> ${data.total}<br>
      <strong>Scan time:</strong> ${data.durationMs} ms 
      <span style="color:${data.under30ms ? '#00ff88' : '#ffaa00'}">
        ${data.under30ms ? '✅ Under 30 ms' : '⚠️ Over 30 ms'}
      </span><br>
      <small style="color:#888">Cached at ${new Date().toLocaleTimeString()}</small>
    </div>`;
  document.getElementById('summary').innerHTML = html;
}

function renderFields(fields, tabId) {
  const container = document.getElementById('fields');
  container.innerHTML = `<h2 style="margin:0 0 12px 0; font-size:15px; color:#ddd;">
    Detected Fields (${fields.length})
  </h2>`;

  fields.forEach(f => {
    const div = document.createElement('div');
    div.className = 'field';

    let html = `
      <strong>&lt;${escapeHtml(f.tag)}&gt;</strong> 
      ${f.type ? `<span style="color:#ffcc00">type="${escapeHtml(f.type)}"</span>` : ''}
    `;

    if (f.name) html += `<div class="attr"><strong>name:</strong> "${escapeHtml(f.name)}"</div>`;
    if (f.id) html += `<div class="attr"><strong>id:</strong> "${escapeHtml(f.id)}"</div>`;

    if (f.placeholder) html += `<div class="attr"><strong>placeholder:</strong> "${escapeHtml(f.placeholder)}"</div>`;

    if (f.required) html += `<div class="attr required">● required</div>`;

    const lengthStr = formatLength(f.minLength, f.maxLength);
    if (lengthStr) html += `<div class="attr"><strong>length:</strong> ${lengthStr}</div>`;

    // Text fields - editable
    const isTextField = (f.tag === 'input' && ['text', 'email', 'password', 'number', 'tel', 'url', 'search'].includes(f.type))
      || f.tag === 'textarea';

    if (isTextField && f.selector) {
      html += `
        <div style="margin-top:10px;">
          <strong style="color:#00ffcc">Edit value on page:</strong><br>
          <input type="${f.type === 'password' ? 'password' : 'text'}" 
                 value="${escapeHtml(f.value)}" 
                 data-selector="${f.selector.replace(/"/g, '&quot;')}" 
                 data-tabid="${tabId}"
                 style="width:100%; padding:8px; background:#2a2a2a; color:#fff; border:1px solid #555; border-radius:4px; margin-top:4px;">
        </div>`;
    }
    // File inputs - show selected files + Choose File button
    else if (f.type === 'file' && f.selector) {
      const fileList = f.files && f.files.length > 0
        ? f.files.map(name => `📎 ${escapeHtml(name)}`).join('<br>')
        : '(No file selected)';

      html += `
        <div style="margin-top:10px;">
          <strong style="color:#00ffcc">Selected file${f.multiple ? 's' : ''}:</strong><br>
          <div data-file-selector="${f.selector.replace(/"/g, '&quot;')}" style="background:#2a2a2a; padding:8px; border-radius:4px; margin:6px 0; font-size:12px; color:#ddd; min-height:20px;">
            ${fileList}
          </div>
          <button data-selector="${f.selector.replace(/"/g, '&quot;')}" 
                  data-tabid="${tabId}"
                  style="padding:6px 12px; background:#0066ff; color:white; border:none; border-radius:4px; cursor:pointer; margin-top:4px;">
            Choose File${f.multiple ? 's' : ''}
          </button>
        </div>`;
    }

    // Select options
    if (f.tag === 'select' && f.options) {
      html += `<div class="attr"><strong>options (${f.options.length}):</strong></div>`;
      f.options.forEach(opt => {
        html += `<div style="margin-left:20px;color:#aaa;font-size:12px;">• ${escapeHtml(opt)}</div>`;
      });
    }

    // Add validation rules display
    if (f.validationRules && f.validationRules.length > 0) {
      html += renderValidationRules(f.validationRules);
    }

    div.innerHTML = html;
    container.appendChild(div);
  });

  attachEditListeners();
}

function attachEditListeners() {
  console.log('%c🔗 Attaching edit listeners...', 'color: #ffaa00');

  // Remove existing listeners first to avoid duplicates
  document.querySelectorAll('.field input[data-selector]').forEach(inputEl => {
    const newInputEl = inputEl.cloneNode(true);
    inputEl.parentNode.replaceChild(newInputEl, inputEl);
  });

  document.querySelectorAll('.field button[data-selector]').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });

  // Text fields live editing
  const textInputs = document.querySelectorAll('.field input[data-selector]');
  console.log('%c📝 Found text inputs:', 'color: #00aaff', textInputs.length);

  textInputs.forEach(inputEl => {
    inputEl.addEventListener('input', async (e) => {
      const selector = e.target.dataset.selector;
      const tabId = parseInt(e.target.dataset.tabid);
      const newValue = e.target.value;

      console.log('%c✏️ Text input changed:', 'color: #ffaa00', { selector, tabId, newValue });

      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'updateValue',
          selector: selector,
          value: newValue
        });

        if (response && response.success) {
          console.log('%c✅ Value updated on page successfully', 'color:#00ff88');
        } else {
          console.warn('❌ Update failed:', response?.reason || 'Unknown');
        }
      } catch (err) {
        console.error('❌ Failed to send update message:', err);
      }
    });
  });

  // File input - trigger native file picker
  const fileButtons = document.querySelectorAll('.field button[data-selector]');
  console.log('%c📁 Found file buttons:', 'color: #00aaff', fileButtons.length);

  fileButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const selector = e.target.dataset.selector;
      const tabId = parseInt(e.target.dataset.tabid);

      console.log('%c🖱️ File button clicked:', 'color: #ffaa00', { selector, tabId });

      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'updateValue',
          selector: selector,
          isFileTrigger: true
        });

        if (response && response.action === "file_picker_triggered") {
          console.log('%c✅ File picker opened from sidebar', 'color:#00ccff');
          // Delay scan to give time for file to be selected
          setTimeout(() => {
            requestScan().finally(() => {
              // Reconnect after scan to ensure port is fresh
              if (!backgroundPort) {
                connectToBackground();
              }
            });
          }, 1500);
        } else {
          console.warn('❌ File picker trigger failed:', response);
        }
      } catch (err) {
        console.error('❌ Failed to trigger file input:', err);
      }
    });
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Connect to background for real-time updates
  connectToBackground();

  requestScan();

  document.getElementById('refresh').addEventListener('click', () => {
    const btn = document.getElementById('refresh');
    btn.textContent = 'Scanning...';
    btn.disabled = true;
    requestScan().finally(() => {
      btn.textContent = 'Refresh Scan';
      btn.disabled = false;
    });
  });
});