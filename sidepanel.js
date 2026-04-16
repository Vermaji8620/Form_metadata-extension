// sidepanel.js - Final version with text editing + file upload support + real-time updates

let backgroundPort = null;

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
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });
    renderSummary(response);
    renderFields(response.fields, tab.id);
  } catch (err) {
    console.error("Scan failed:", err);
    document.getElementById('summary').innerHTML = `
      <div style="color:#ff5555;padding:10px">
        Cannot scan this page.<br>
        <small>Make sure the page is fully loaded.</small>
      </div>`;
  }
}

function formatLength(min, max) {
  if (min <= 0 && max <= 0) return null;
  if (min <= 0) return `max: ${max}`;
  if (max <= 0) return `min: ${min}`;
  return `${min} — ${max}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
                 data-selector="${escapeHtml(f.selector)}" 
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
          <div data-file-selector="${escapeHtml(f.selector)}" style="background:#2a2a2a; padding:8px; border-radius:4px; margin:6px 0; font-size:12px; color:#ddd; min-height:20px;">
            ${fileList}
          </div>
          <button data-selector="${escapeHtml(f.selector)}" 
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

    div.innerHTML = html;
    container.appendChild(div);
  });

  attachEditListeners();
}

function attachEditListeners() {
  // Text fields live editing
  document.querySelectorAll('.field input[data-selector]').forEach(inputEl => {
    inputEl.addEventListener('input', async (e) => {
      const selector = e.target.dataset.selector;
      const tabId = parseInt(e.target.dataset.tabid);
      const newValue = e.target.value;

      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'updateValue',
          selector: selector,
          value: newValue
        });

        if (response && response.success) {
          console.log('%cValue updated on page successfully', 'color:#00ff88');
        } else {
          console.warn('Update failed:', response?.reason || 'Unknown');
        }
      } catch (err) {
        console.error('Failed to send update message:', err);
      }
    });
  });

  // File input - trigger native file picker
  document.querySelectorAll('.field button[data-selector]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const selector = e.target.dataset.selector;
      const tabId = parseInt(e.target.dataset.tabid);

      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          action: 'updateValue',
          selector: selector,
          isFileTrigger: true
        });

        if (response && response.action === "file_picker_triggered") {
          console.log('%cFile picker opened from sidebar', 'color:#00ccff');
          // Delay scan to give time for file to be selected
          setTimeout(() => {
            requestScan().finally(() => {
              // Reconnect after scan to ensure port is fresh
              if (!backgroundPort) {
                connectToBackground();
              }
            });
          }, 1500);
        }
      } catch (err) {
        console.error('Failed to trigger file input:', err);
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