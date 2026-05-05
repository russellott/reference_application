import { endpointBase, generateSessionId, resetSessionState, store, uid } from './runtime.js';
import { processBatchUpload, updateBatchSummary } from './batch-processing.js?v=8';
import { renderBatchMasterDetail } from './batch-detail.js?v=9';
import { ingestApiResponse } from './data-model.js';
import { renderLegacyAuditTab, wireSubmitAuditPanel } from './submit-audit.js';

export function renderSubmitMessage() {
  return '' +
    '<section class="view"><section class="card"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap"><h2 class="section-title" style="margin:0">Submit Message</h2><span id="api-status-badge" class="api-badge api-badge--checking">● Checking API...</span></div><p class="section-sub">Score a PIQI or FHIR message and view quality results instantly. Results appear below after submission.</p></section><section class="card"><div class="form-grid"><div class="form-item" style="grid-column:1 / -1"><label for="msg-json">PIQI or FHIR JSON Message</label><textarea id="msg-json" class="textarea" placeholder="Paste JSON payload here"></textarea></div><div class="form-item" style="grid-column:1 / -1"><label>JSON File Upload</label><div class="dropzone" id="dropzone">Drop JSON file here or click to choose</div><input id="msg-file" type="file" accept="application/json,.json" class="hidden"></div><div class="form-item"><label for="cfg-provider">Provider ID</label><input id="cfg-provider" class="input" placeholder="Provider Alpha"></div><div class="form-item"><label for="cfg-source">Source ID</label><input id="cfg-source" class="input" placeholder="Main EHR Feed"></div><div class="advanced-settings" style="grid-column:1 / -1"><button type="button" class="advanced-toggle" id="advanced-toggle-btn" aria-expanded="false"><span>Advanced Settings</span><span id="advanced-toggle-icon">▼</span></button><div id="advanced-settings-body" class="advanced-body hidden"><div class="form-grid advanced-grid"><div class="form-item"><label for="cfg-endpoint">API Endpoint URL</label><input id="cfg-endpoint" class="input" value="http://localhost:5025/PIQI/ScoreAuditMessage"></div><div class="form-item"><label for="cfg-model">Model Mnemonic</label><input id="cfg-model" class="input" value="PAT_CLINICAL_V1"></div><div class="form-item"><label for="cfg-rubric">Rubric Mnemonic</label><input id="cfg-rubric" class="input" value="USCDI_V3"></div><div class="form-item"><label for="cfg-facility">Facility</label><input id="cfg-facility" class="input" placeholder="Facility 1"></div><div class="form-item"><label for="cfg-application">Application</label><input id="cfg-application" class="input" placeholder="Application A"></div><div class="form-item"><label for="cfg-format">Format</label><input id="cfg-format" class="input" value="JSON"></div><div class="form-item" style="grid-column:1 / -1"><label for="cfg-use-case">Use Case</label><input id="cfg-use-case" class="input" placeholder="Quality Monitoring"></div></div></div></div></div><div class="actions" style="margin-top:12px"><button class="btn primary" id="submit-msg-btn">Submit</button><button class="btn secondary" id="clear-msg-btn">Clear</button><button class="btn secondary" id="new-session-btn" title="Reset all in-memory metrics and start a new session">New Session</button><span id="submit-status" class="section-sub"></span></div></section><section class="card" id="batch-section" style="display:block !important; margin-top:24px"><h3 class="section-title" style="margin-top:0">Batch Upload</h3><div class="form-grid" style="grid-template-columns: 1fr; gap: 12px"><div class="form-item" style="grid-column:1 / -1"><label>Batch File Upload</label><div class="dropzone" id="batch-dropzone">Drop Excel/CSV file here or click to choose</div><input id="batch-file" type="file" accept=".xlsx,.xls,.csv" class="hidden"><div class="section-sub" id="batch-file-hint">Upload an Excel or CSV file with row-based lab data.</div></div><div class="form-item" style="grid-column:1 / -1"><button class="btn primary" id="batch-submit-btn">Process Batch</button><button class="btn secondary" id="batch-clear-btn">Clear Batch</button></div><div id="batch-result-card" class="batch-result-card" style="display:none; margin-top:20px"><div class="form-grid batch-meta-grid"><div class="form-item batch-meta-item"><strong>Run ID</strong><div id="batch-run-id" class="batch-meta-value">-</div></div><div class="form-item batch-meta-item"><strong>Elapsed</strong><div id="batch-elapsed" class="batch-meta-value">0.0s</div></div><div class="form-item batch-meta-item"><strong>Rate</strong><div id="batch-rate" class="batch-meta-value">0.00 rows/sec</div></div><div class="form-item batch-meta-item"><strong>Success Rate</strong><div id="batch-success-rate" class="batch-meta-value">0%</div></div></div><div class="form-grid batch-stats-grid"><div class="form-item batch-stat-item"><strong>Total Rows</strong><div id="batch-total" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Processed</strong><div id="batch-processed" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Succeeded</strong><div id="batch-passed" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Failed</strong><div id="batch-failed" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Average</strong><div id="batch-average" class="stat-value">N/A</div></div></div><div class="form-grid batch-class-grid"><div class="form-item batch-stat-item"><strong>Passed Checks</strong><div id="batch-class-pass" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Failed Checks</strong><div id="batch-class-fail" class="stat-value">0</div></div><div class="form-item batch-stat-item"><strong>Skipped Checks</strong><div id="batch-class-skip" class="stat-value">0</div></div></div><div id="batch-correlation-note" class="section-sub batch-note" style="margin-bottom: 12px">Processed rows and assessment checks will appear here during batch execution.</div><div class="form-item" style="grid-column:1 / -1"><div class="progress" style="height: 14px; border-radius: 8px; overflow: hidden"><div id="batch-progress-bar" class="progress-bar" style="width:0%; height:100%;"></div></div></div><div id="batch-master-detail" class="batch-master-detail batch-master-detail--single" style="margin-top:16px;display:none"><section class="batch-master-detail-panel"><div class="batch-master-detail-head"><div><h4 id="batch-master-title" style="margin:0">Batch checks</h4><p id="batch-master-sub" class="section-sub" style="margin:4px 0 0">No checks yet.</p></div><div class="batch-master-legend"><span><i class="dot pass"></i>Pass</span><span><i class="dot fail"></i>Fail</span><span><i class="dot skip"></i>Skip</span></div></div><div class="batch-master-filters batch-master-filters--inline"><button class="btn secondary active" id="batch-filter-all" type="button">All</button><button class="btn secondary" id="batch-filter-issues" type="button">Fail + Skip</button><button class="btn secondary" id="batch-filter-pass" type="button">Pass only</button></div><div id="batch-master-kpis" class="batch-master-kpis"></div><div class="table-wrap batch-master-table-wrap"><table class="table" id="batch-results-table"><thead><tr><th>MessageID</th><th>DataClass</th><th>AttributeName</th><th>AttributeValue</th><th>Assessment</th><th>Status</th><th>Reason</th><th>Effect</th></tr></thead><tbody id="batch-master-tbody"></tbody></table></div></section></div></div></section></section>';
}

async function autoPopulateSubmitDefaults() {
  const endpointEl = document.getElementById('cfg-endpoint');
  const providerEl = document.getElementById('cfg-provider');
  const sourceEl = document.getElementById('cfg-source');
  const facilityEl = document.getElementById('cfg-facility');
  const applicationEl = document.getElementById('cfg-application');
  const useCaseEl = document.getElementById('cfg-use-case');
  if (!providerEl || !sourceEl) return;
  if (!providerEl.value.trim()) providerEl.value = 'Provider-' + generateSessionId();
  if (!sourceEl.value.trim()) sourceEl.value = 'Source-' + generateSessionId();
  if (facilityEl && !facilityEl.value.trim()) facilityEl.value = 'Facility 1';
  if (applicationEl && !applicationEl.value.trim()) applicationEl.value = 'Application A';
  if (useCaseEl && !useCaseEl.value.trim()) useCaseEl.value = 'Quality Monitoring';
  const badge = document.getElementById('api-status-badge');
  if (!endpointEl || !badge) return;
  try {
    const res = await fetch(endpointBase(endpointEl.value.trim()) + '/Diagnostics/status', { method: 'GET' });
    if (res.ok) {
      badge.textContent = '● API Online';
      badge.className = 'api-badge api-badge--ok';
    } else {
      badge.textContent = '● API Error ' + res.status;
      badge.className = 'api-badge api-badge--warn';
    }
  } catch (_) {
    badge.textContent = '● API Unreachable';
    badge.className = 'api-badge api-badge--err';
  }
}

function wireFileDropzone(dropzone, input, onFile) {
  if (!dropzone || !input) return;
  dropzone.addEventListener('click', function () { input.click(); });
  dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', function () { dropzone.classList.remove('drag'); });
  dropzone.addEventListener('drop', function (e) { e.preventDefault(); dropzone.classList.remove('drag'); onFile(e.dataTransfer.files && e.dataTransfer.files[0]); });
  input.addEventListener('change', function (e) { onFile(e.target.files && e.target.files[0]); });
}

function saveSubmitFormState() {
  const fields = ['msg-json', 'cfg-provider', 'cfg-source', 'cfg-endpoint', 'cfg-model', 'cfg-rubric', 'cfg-facility', 'cfg-application', 'cfg-format', 'cfg-use-case'];
  const state = {};
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) state[id] = el.value;
  });
  const advancedBody = document.getElementById('advanced-settings-body');
  state['advanced-open'] = advancedBody ? !advancedBody.classList.contains('hidden') : false;

  // Save batch result card state
  const resultCard = document.getElementById('batch-result-card');
  const batchStatIds = ['batch-total', 'batch-processed', 'batch-passed', 'batch-failed', 'batch-average', 'batch-class-pass', 'batch-class-fail', 'batch-class-skip', 'batch-run-id', 'batch-elapsed', 'batch-rate', 'batch-success-rate', 'batch-correlation-note'];
  const batchStats = {};
  batchStatIds.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) batchStats[id] = el.textContent;
  });
  const progressBar = document.getElementById('batch-progress-bar');
  const hintEl = document.getElementById('batch-file-hint');
  state['batch-card-visible'] = resultCard ? resultCard.style.display !== 'none' : false;
  state['batch-stats'] = batchStats;
  state['batch-progress'] = progressBar ? progressBar.style.width : '0%';
  state['batch-file-hint'] = hintEl ? hintEl.textContent : '';

  window.MOCK_DATA_LAYER.submitFormState = state;
}

function restoreSubmitFormState() {
  const state = window.MOCK_DATA_LAYER.submitFormState;
  if (!state) return;
  const fields = ['msg-json', 'cfg-provider', 'cfg-source', 'cfg-endpoint', 'cfg-model', 'cfg-rubric', 'cfg-facility', 'cfg-application', 'cfg-format', 'cfg-use-case'];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el && state[id] !== undefined) el.value = state[id];
  });
  if (state['advanced-open']) {
    const advancedBody = document.getElementById('advanced-settings-body');
    const advancedToggle = document.getElementById('advanced-toggle-btn');
    const advancedIcon = document.getElementById('advanced-toggle-icon');
    if (advancedBody) advancedBody.classList.remove('hidden');
    if (advancedToggle) advancedToggle.setAttribute('aria-expanded', 'true');
    if (advancedIcon) advancedIcon.textContent = '▲';
  }

  // Restore batch result card
  if (state['batch-card-visible']) {
    const resultCard = document.getElementById('batch-result-card');
    if (resultCard) resultCard.style.display = 'block';
    const batchStats = state['batch-stats'] || {};
    Object.keys(batchStats).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = batchStats[id];
    });
    const progressBar = document.getElementById('batch-progress-bar');
    if (progressBar && state['batch-progress']) progressBar.style.width = state['batch-progress'];
    renderBatchMasterDetail();
  }
  const hintEl = document.getElementById('batch-file-hint');
  if (hintEl && state['batch-file-hint']) hintEl.textContent = state['batch-file-hint'];
}

export function wireSubmitView() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('msg-file');
  const textArea = document.getElementById('msg-json');
  autoPopulateSubmitDefaults();
  restoreSubmitFormState();

  // Auto-save state on every field change so navigation away preserves it
  const trackedFields = ['msg-json', 'cfg-provider', 'cfg-source', 'cfg-endpoint', 'cfg-model', 'cfg-rubric', 'cfg-facility', 'cfg-application', 'cfg-format', 'cfg-use-case'];
  trackedFields.forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', saveSubmitFormState);
  });
  // Also save when batch stats are updated programmatically
  document.addEventListener('piqi:batchSummaryUpdated', saveSubmitFormState);

  // Remove the listener when the view is unmounted (next view change)
  const unsubscribe = store.subscribe(function (state) {
    if (state.currentView !== 'submit-message') {
      document.removeEventListener('piqi:batchSummaryUpdated', saveSubmitFormState);
      unsubscribe();
    }
  });
  wireFileDropzone(dropzone, fileInput, function (file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () { textArea.value = String(reader.result || ''); saveSubmitFormState(); };
    reader.readAsText(file);
  });

  const batchDropzone = document.getElementById('batch-dropzone');
  const batchFileInput = document.getElementById('batch-file');
  wireFileDropzone(batchDropzone, batchFileInput, function (file) {
    if (!file) return;
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    batchFileInput.files = dataTransfer.files;
    const hint = document.getElementById('batch-file-hint');
    if (hint) hint.textContent = 'Ready to process: ' + file.name;
  });

  document.getElementById('batch-submit-btn').addEventListener('click', processBatchUpload);
  document.getElementById('batch-clear-btn').addEventListener('click', function () {
    if (batchFileInput) batchFileInput.value = '';
    const hint = document.getElementById('batch-file-hint');
    const card = document.getElementById('batch-result-card');
    if (hint) hint.textContent = 'Upload an Excel or CSV file with row-based lab data.';
    if (card) card.style.display = 'none';
    window.batchMasterState = { messages: [], selectedKey: null, filter: 'all' };
    renderBatchMasterDetail();
    updateBatchSummary(0, 0, 0, 0, 'N/A', { pass: 0, fail: 0, skip: 0 });
  });

  const advancedToggle = document.getElementById('advanced-toggle-btn');
  const advancedBody = document.getElementById('advanced-settings-body');
  const advancedIcon = document.getElementById('advanced-toggle-icon');
  if (advancedToggle && advancedBody && advancedIcon) {
    advancedToggle.addEventListener('click', function () {
      const hidden = advancedBody.classList.contains('hidden');
      advancedBody.classList.toggle('hidden', !hidden);
      advancedToggle.setAttribute('aria-expanded', hidden ? 'true' : 'false');
      advancedIcon.textContent = hidden ? '▲' : '▼';
    });
  }

  document.getElementById('clear-msg-btn').addEventListener('click', function () {
    textArea.value = '';
    document.getElementById('submit-status').textContent = '';
    window.MOCK_DATA_LAYER.submitFormState = null;
    const auditContainer = document.getElementById('submit-audit-container');
    if (auditContainer) {
      auditContainer.innerHTML = '';
      auditContainer.style.display = 'none';
    }
  });

  document.getElementById('new-session-btn').addEventListener('click', function () {
    resetSessionState();
    window.MOCK_DATA_LAYER.submitFormState = null;
    const statusEl = document.getElementById('submit-status');
    const auditContainer = document.getElementById('submit-audit-container');
    if (statusEl) {
      statusEl.textContent = 'New session started. Pass/Fail/Skip metrics cleared.';
      statusEl.className = 'section-sub';
    }
    if (auditContainer) {
      auditContainer.innerHTML = '';
      auditContainer.style.display = 'none';
    }
    if (window.__dqSpa && typeof window.__dqSpa.renderAll === 'function') window.__dqSpa.renderAll();
  });

  document.getElementById('submit-msg-btn').addEventListener('click', async function () {
    const statusEl = document.getElementById('submit-status');
    statusEl.textContent = 'Submitting...';
    try {
      const endpoint = document.getElementById('cfg-endpoint').value.trim();
      const model = document.getElementById('cfg-model').value.trim();
      const rubric = document.getElementById('cfg-rubric').value.trim();
      const provider = document.getElementById('cfg-provider').value.trim() || 'Provider';
      const source = document.getElementById('cfg-source').value.trim() || 'Source';
      const facility = document.getElementById('cfg-facility').value.trim();
      const application = document.getElementById('cfg-application').value.trim();
      const format = document.getElementById('cfg-format').value.trim() || 'JSON';
      const useCase = document.getElementById('cfg-use-case').value.trim();
      const parsed = JSON.parse(textArea.value.trim());
      const requestBody = { dataProviderID: provider, dataSourceID: source, messageID: parsed.messageID || parsed.messageId || uid('msg'), piqiModelMnemonic: model, evaluationRubricMnemonic: rubric, messageData: JSON.stringify(parsed) };
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      if (!response.ok) throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
      if (!payload || !payload.scoringData) throw new Error('API response did not include scoringData.');
      const sourceEntry = ingestApiResponse({ provider: provider, source: source, facility: facility, application: application, format: format, useCase: useCase, endpoint: endpoint, model: model, rubric: rubric }, payload);
      statusEl.textContent = '✓ Success (Status: ' + response.status + ')';
      statusEl.className = 'section-sub score-pass';
      const auditContainer = document.getElementById('submit-audit-container');
      if (auditContainer) {
        auditContainer.innerHTML = renderLegacyAuditTab(sourceEntry, response.status);
        auditContainer.style.display = 'block';
        wireSubmitAuditPanel();
        auditContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (err) {
      statusEl.textContent = 'Submission failed: ' + err.message;
      statusEl.className = 'section-sub score-fail';
    }
  });
}