async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function requestScan() {
  const tab = await getActiveTab();
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });

    renderSummary(response);
    renderFields(response.fields);
  } catch (err) {
    document.getElementById('summary').innerHTML = `
      <div style="color:#ff5555;padding:10px">
        Cannot scan this page.<br>
        <small>Try refreshing the page or clicking "Refresh Scan".</small>
      </div>`;
  }
}

function formatLength(min, max) {
  const hasMin = min > 0;
  const hasMax = max > 0;

  if (!hasMin && !hasMax) return null;           // Don't show if both are default
  if (!hasMin) return `max: ${max}`;
  if (!hasMax) return `min: ${min}`;
  return `${min} — ${max}`;
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

function renderFields(fields) {
  const container = document.getElementById('fields');
  container.innerHTML = `<h2 style="margin:0 0 12px 0; font-size:15px; color:#ddd;">
    Detected Fields (${fields.length})
  </h2>`;

  fields.forEach(f => {
    const div = document.createElement('div');
    div.className = 'field';

    let html = `
      <strong>&lt;${f.tag}&gt;</strong> 
      ${f.type ? `<span style="color:#ffcc00">type="${f.type}"</span>` : ''}
    `;

    if (f.name) html += `<div class="attr"><strong>name:</strong> <span>"${f.name}"</span></div>`;
    if (f.id) html += `<div class="attr"><strong>id:</strong> <span>"${f.id}"</span></div>`;

    // Placeholder
    if (f.placeholder && f.placeholder.trim() !== '') {
      html += `<div class="attr"><strong>placeholder:</strong> <span>"${f.placeholder}"</span></div>`;
    }

    // Current Value (very useful!)
    if (f.value && f.value.trim() !== '') {
      html += `<div class="attr" style="color:#00ffaa"><strong>value:</strong> <span>"${f.value}"</span></div>`;
    } else {
      html += `<div class="attr" style="color:#666"><strong>value:</strong> (empty)</div>`;
    }

    if (f.required) {
      html += `<div class="attr required">● required</div>`;
    }

    // Length (fixed)
    const lengthStr = formatLength(f.minLength, f.maxLength);
    if (lengthStr) {
      html += `<div class="attr"><strong>length:</strong> ${lengthStr}</div>`;
    }

    if (f.pattern) {
      html += `<div class="attr"><strong>pattern:</strong> <span>"${f.pattern}"</span></div>`;
    }

    // Select Options - Show all options
    if (f.tag === 'select' && f.options && f.options.length > 0) {
      html += `<div class="attr"><strong>options (${f.options.length}):</strong></div>`;
      f.options.forEach(opt => {
        html += `<div style="margin-left:20px; color:#aaa; font-size:12px;">• ${opt}</div>`;
      });
    } else if (f.optionsCount > 0) {
      html += `<div class="attr"><strong>options:</strong> ${f.optionsCount}</div>`;
    }

    if (f.disabled) html += `<div class="attr" style="color:#888">disabled</div>`;
    if (f.readOnly) html += `<div class="attr" style="color:#888">readonly</div>`;

    div.innerHTML = html;
    container.appendChild(div);
  });

  if (fields.length === 0) {
    container.innerHTML += `<p style="color:#888; text-align:center; padding:20px;">
      No form fields found on this page.
    </p>`;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  requestScan();

  document.getElementById('refresh').addEventListener('click', () => {
    const btn = document.getElementById('refresh');
    const originalText = btn.textContent;
    btn.textContent = 'Scanning...';
    btn.disabled = true;

    requestScan().finally(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    });
  });
});