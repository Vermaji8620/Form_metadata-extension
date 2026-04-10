// sidepanel.js
let currentTabId = null;

async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
}

async function requestScan() {
    const tab = await getActiveTab();
    currentTabId = tab.id;

    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'scan' });

        renderSummary(response);
        renderFields(response.fields);
    } catch (err) {
        document.getElementById('summary').innerHTML = `
      <div style="color:#ff5555">Cannot scan this page.<br>
      <small>Make sure the page has finished loading.</small></div>`;
    }
}

function renderSummary(data) {
    const html = `
    <div class="summary">
      <strong>Total fields:</strong> ${data.total}<br>
      <strong>Scan time:</strong> ${data.durationMs} ms 
      <span style="color:${data.under30ms ? '#00ff88' : '#ffaa00'}">
        ${data.under30ms ? '✅ Under 30 ms' : '⚠️ Over 30 ms'}
      </span><br>
      <small>Cached • ${new Date().toLocaleTimeString()}</small>
    </div>`;
    document.getElementById('summary').innerHTML = html;
}

function renderFields(fields) {
    const container = document.getElementById('fields');
    container.innerHTML = `<h2 style="font-size:15px;margin:0 0 8px 0">Detected Fields (${fields.length})</h2>`;

    fields.forEach(f => {
        const div = document.createElement('div');
        div.className = 'field';
        div.innerHTML = `
      <strong>&lt;${f.tag}&gt;</strong> 
      ${f.type ? `<span style="color:#ffcc00">type="${f.type}"</span>` : ''}
      ${f.name ? `<br><strong>name</strong>: "${f.name}"` : ''}
      ${f.id ? `<br><strong>id</strong>: "${f.id}"` : ''}
      ${f.required ? `<br><span style="color:#ff5555">required</span>` : ''}
      ${f.minLength || f.maxLength ? `<br><strong>length</strong>: ${f.minLength}–${f.maxLength}` : ''}
      ${f.optionsCount ? `<br><strong>options</strong>: ${f.optionsCount}` : ''}
    `;
        container.appendChild(div);
    });

    if (fields.length === 0) {
        container.innerHTML += `<p style="color:#888">No form fields found on this page.</p>`;
    }
}

// Auto-scan when sidebar opens + Refresh button
document.addEventListener('DOMContentLoaded', () => {
    requestScan();

    document.getElementById('refresh').addEventListener('click', () => {
        const btn = document.getElementById('refresh');
        btn.textContent = 'Scanning...';
        requestScan().finally(() => btn.textContent = 'Refresh Scan');
    });
});