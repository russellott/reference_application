import { RESOURCE_REGISTRY, STANDARD_USCDI_V3_CLASSES, activeSessionSources, activeSessionSubmissions, bucket, clamp, esc, pct, setView, store } from './runtime.js';
import { filteredSources, sourceRankedRows } from './data-model.js';
import { drawBarChart } from './charts-gauge-bar.js';
import { modalSection, modalStatRows, modalTable, openModal } from './modal-ui.js';
import { extractAssessmentItems, getClassFieldPath, parseAuditedMessage, statusBadgeClass } from './submit-audit.js';

export function wireDashboardView() {
  const donutModeSelect = document.getElementById('donut-mode-select');
  if (donutModeSelect) donutModeSelect.addEventListener('change', function () { store.setState({ donutMode: donutModeSelect.value === 'message' ? 'message' : 'class' }); });
  document.querySelectorAll('[data-kpi]').forEach(function (tile) {
    tile.addEventListener('click', function () {
      const key = tile.getAttribute('data-kpi');
      const labels = { totalMessages: 'Total Messages', avgQuality: 'Average Quality Score', criticalMessages: 'Critical Messages', cleanMessages: 'Clean Messages', dataSources: 'Data Sources' };
      const rows = sourceRankedRows().map(function (source) { return [source.source, source.provider, String(source.messageCount), source.avgScore === null ? '-' : pct(source.avgScore), String(source.criticalCount), String(source.cleanCount)]; });
      openModal({ icon: 'i', title: labels[key] || key, subtitle: 'Source-level breakdown for this metric.', bodyHtml: modalSection('Summary', modalStatRows([{ label: 'Active sources', value: String(activeSessionSources().length) }, { label: 'Messages scored', value: String(activeSessionSubmissions().length) }])) + modalSection('By source', modalTable(['Source', 'Provider', 'Messages', 'Avg Score', 'Critical', 'Clean'], rows) + '<div style="margin-top:10px">' + sourceRankedRows().map(function (source) { const score = source.avgScore === null ? 0 : source.avgScore; return '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between"><span>' + esc(source.source) + '</span><strong>' + esc(source.avgScore === null ? '-' : pct(source.avgScore)) + '</strong></div><div class="progress ' + bucket(score) + '"><span style="width:' + clamp(score, 0, 100).toFixed(1) + '%"></span></div></div>'; }).join('') + '</div>') });
    });
  });
  document.querySelectorAll('#dashboard-source-table tbody tr[data-source-id]').forEach(function (row) { row.addEventListener('click', function () { setView('source-details', { selectedSourceId: row.getAttribute('data-source-id'), selectedTab: 'classes' }); }); });
  document.querySelectorAll('#dashboard-class-table tbody tr[data-class-name]').forEach(function (row) { row.addEventListener('click', function () { openClassPanel(row); }); });
}

export function wireSourceReviewView() {
  document.querySelectorAll('[data-filter]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      const filters = Object.assign({}, store.getState().sourceFilters);
      filters[sel.getAttribute('data-filter')] = sel.value;
      store.setState({ sourceFilters: filters });
    });
  });
  document.querySelectorAll('#review-source-table tbody tr[data-source-id]').forEach(function (row) { row.addEventListener('click', function () { setView('source-details', { selectedSourceId: row.getAttribute('data-source-id'), selectedTab: 'classes' }); }); });
  document.querySelectorAll('#class-result-table tbody tr[data-class-name]').forEach(function (row) { row.addEventListener('click', function () { openClassPanel(row); }); });
}

function summarizeAssessmentStatuses(items) {
  return (items || []).reduce(function (acc, item) {
    const status = String(item && item.status || '').toLowerCase();
    if (status === 'passed') acc.pass += 1;
    else if (status === 'failed') acc.fail += 1;
    else acc.skip += 1;
    return acc;
  }, { pass: 0, fail: 0, skip: 0 });
}

function renderReasonList(items, status) {
  const counts = new Map();
  (items || []).forEach(function (item) {
    if (String(item && item.status || '').toLowerCase() !== status) return;
    const key = (item && item.reason && item.reason !== '-' ? item.reason : item && item.assessment ? item.assessment : 'No detail').trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const rows = Array.from(counts.entries()).sort(function (left, right) { return right[1] - left[1]; }).slice(0, 3);
  if (!rows.length) return '<li><span>No items recorded</span><strong>0</strong></li>';
  return rows.map(function (entry) {
    return '<li><span>' + esc(entry[0]) + '</span><strong>' + esc(String(entry[1])) + '</strong></li>';
  }).join('');
}

function getInlineClassPayload(entry) {
  if (!entry) return '{}';
  if (entry.auditedMessage) return entry.auditedMessage;
  if (entry.raw && entry.raw.auditedMessage) {
    const parsed = parseAuditedMessage(entry.raw.auditedMessage);
    if (parsed) return parsed;
    if (typeof entry.raw.auditedMessage === 'string') return entry.raw.auditedMessage;
  }
  if (entry.raw) return entry.raw;
  return '{}';
}

function isFailedStatus(value) {
  return String(value || '').toLowerCase() === 'failed';
}

function jsonToken(value, cssClass, failedContext) {
  const classes = failedContext ? cssClass + ' json-failed-token' : cssClass;
  return '<span class="' + classes + '">' + esc(value) + '</span>';
}

function formatAuditJson(value, depth, failedContext) {
  const indent = new Array(depth + 1).join('  ');
  const childIndent = new Array(depth + 2).join('  ');

  if (value === null) return jsonToken('null', 'json-null', failedContext);

  if (Array.isArray(value)) {
    if (!value.length) return jsonToken('[]', 'json-punct', failedContext);
    const rows = value.map(function (item) {
      return childIndent + formatAuditJson(item, depth + 1, failedContext);
    });
    return jsonToken('[', 'json-punct', failedContext) + '\n' + rows.join(',\n') + '\n' + indent + jsonToken(']', 'json-punct', failedContext);
  }

  if (typeof value === 'object') {
    const localFailed = failedContext || isFailedStatus(value.status);
    const keys = Object.keys(value);
    if (!keys.length) return jsonToken('{}', 'json-punct', localFailed);

    const rows = keys.map(function (key) {
      return childIndent + jsonToken(JSON.stringify(key), 'json-key', localFailed) + jsonToken(': ', 'json-punct', localFailed) + formatAuditJson(value[key], depth + 1, localFailed);
    });

    return jsonToken('{', 'json-punct', localFailed) + '\n' + rows.join(',\n') + '\n' + indent + jsonToken('}', 'json-punct', localFailed);
  }

  if (typeof value === 'string') return jsonToken(JSON.stringify(value), 'json-string', failedContext);
  if (typeof value === 'number') return jsonToken(String(value), 'json-number', failedContext);
  if (typeof value === 'boolean') return jsonToken(value ? 'true' : 'false', 'json-boolean', failedContext);
  return jsonToken(JSON.stringify(value), 'json-string', failedContext);
}

function renderInlineClassJson(entry) {
  const payload = getInlineClassPayload(entry);
  if (typeof payload === 'string') return esc(payload);
  return formatAuditJson(payload, 0, false);
}

function renderInlineClassDetail(className) {
  const matched = filteredSources(store.getState().sourceFilters).map(function (source) {
    const classRow = (source.classRows || []).find(function (item) { return item.dataClassName === className; });
    if (!classRow) return null;
    const raw = source.lastRaw || null;
    const auditedMessage = parseAuditedMessage(raw && raw.auditedMessage ? raw.auditedMessage : null);
    const assessments = extractAssessmentItems(auditedMessage, className).map(function (item) {
      return Object.assign({ source: source.source, provider: source.provider }, item);
    });
    return { source: source, classRow: classRow, raw: raw, auditedMessage: auditedMessage, assessments: assessments };
  }).filter(Boolean);

  if (!matched.length) {
    return '<div class="class-inline-detail"><p class="section-sub">No matching class data is available for this filter selection.</p></div>';
  }

  const allAssessments = [];
  matched.forEach(function (entry) {
    entry.assessments.forEach(function (item) { allAssessments.push(item); });
  });
  const totals = summarizeAssessmentStatuses(allAssessments);
  const totalChecks = matched.reduce(function (sum, entry) { return sum + (entry.classRow.denominator || 0); }, 0);
  const totalCritical = matched.reduce(function (sum, entry) { return sum + (entry.classRow.critical || 0); }, 0);
  const avgScore = matched.length ? matched.reduce(function (sum, entry) { return sum + (entry.classRow.score || 0); }, 0) / matched.length : null;
  const primary = matched.find(function (entry) { return entry.assessments.length || entry.raw; }) || matched[0];
  const assessmentTable = allAssessments.length
    ? allAssessments.map(function (item) {
      const preview = item.attributeValue && item.attributeValue.length > 80 ? item.attributeValue.slice(0, 80) + '...' : item.attributeValue;
      return '<tr data-status="' + esc(String(item.status || 'Unknown').toLowerCase()) + '"><td>' + esc(item.source) + '</td><td>' + esc(item.attributeName || '-') + '</td><td class="class-inline-value" title="' + esc(item.rawAttributeValue || item.attributeValue || '') + '">' + esc(preview || 'N/A') + '</td><td>' + esc(item.assessment || '-') + '</td><td><span class="badge ' + statusBadgeClass(item.status) + '">' + esc(item.status || 'Unknown') + '</span></td><td><em>' + esc(item.reason || '-') + '</em></td></tr>';
    }).join('')
    : '<tr><td colspan="6">No attribute-level assessments were captured for this class in the current session.</td></tr>';

  return '' +
    '<div class="class-inline-detail">' +
    '<div class="class-inline-header">' +
    '<div><h4 class="class-inline-title">' + esc(className) + '</h4><p class="class-inline-sub">Inline detail for the selected class. Expand another class to switch context.</p></div>' +
    '<div class="class-inline-stats">' +
    '<article class="class-inline-stat"><span>Sources</span><strong>' + esc(String(matched.length)) + '</strong></article>' +
    '<article class="class-inline-stat"><span>Average Score</span><strong>' + esc(avgScore === null ? '-' : pct(avgScore)) + '</strong></article>' +
    '<article class="class-inline-stat"><span>Total Checks</span><strong>' + esc(String(totalChecks)) + '</strong></article>' +
    '<article class="class-inline-stat"><span>Critical</span><strong>' + esc(String(totalCritical)) + '</strong></article>' +
    '</div>' +
    '</div>' +
    '<div class="class-inline-breakdown">' +
    '<article class="class-inline-pill pass"><span>Passed</span><strong>' + esc(String(totals.pass)) + '</strong><ul class="class-inline-reasons">' + renderReasonList(allAssessments, 'passed') + '</ul></article>' +
    '<article class="class-inline-pill fail"><span>Failed</span><strong>' + esc(String(totals.fail)) + '</strong><ul class="class-inline-reasons">' + renderReasonList(allAssessments, 'failed') + '</ul></article>' +
    '<article class="class-inline-pill warn"><span>Skipped</span><strong>' + esc(String(totals.skip)) + '</strong><ul class="class-inline-reasons">' + renderReasonList(allAssessments, 'skipped') + '</ul></article>' +
    '</div>' +
    '<div class="class-inline-grid">' +
    '<section class="class-inline-card"><h5>Checks and Reasons</h5><div class="table-wrap"><table class="table dense-table class-inline-table"><thead><tr><th>Source</th><th>Attribute</th><th>Value</th><th>Assessment</th><th>Status</th><th>Reason</th></tr></thead><tbody>' + assessmentTable + '</tbody></table></div></section>' +
    '<section class="class-inline-card"><h5>Audited Message</h5><p class="section-sub">Showing the latest audited message payload for this class.</p><pre class="class-inline-json">' + renderInlineClassJson(primary) + '</pre></section>' +
    '</div>' +
    '</div>';
}

function clearInlineClassPanels() {
  document.querySelectorAll('.class-inline-detail-row').forEach(function (row) { row.remove(); });
  document.querySelectorAll('tr[data-class-name].expanded').forEach(function (row) {
    row.classList.remove('expanded');
    row.removeAttribute('aria-expanded');
  });
  const panelRoot = document.getElementById('panel-root');
  if (panelRoot) panelRoot.innerHTML = '';
}

function openClassPanel(row) {
  if (!row) return;
  const className = row.getAttribute('data-class-name');
  if (!className) return;
  const existing = row.nextElementSibling;
  const alreadyOpen = existing && existing.classList && existing.classList.contains('class-inline-detail-row');
  clearInlineClassPanels();
  if (alreadyOpen) return;

  row.classList.add('expanded');
  row.setAttribute('aria-expanded', 'true');

  const detailRow = document.createElement('tr');
  detailRow.className = 'class-inline-detail-row';
  const cell = document.createElement('td');
  cell.colSpan = row.children.length || 1;
  cell.innerHTML = renderInlineClassDetail(className);
  detailRow.appendChild(cell);
  row.insertAdjacentElement('afterend', detailRow);
}

export function wireSourceDetailsView() {
  const source = window.MOCK_DATA_LAYER.sources.find(function (item) { return item.id === store.getState().selectedSourceId; });
  if (!source) return;
  const backBtn = document.getElementById('back-source-review');
  if (backBtn) backBtn.addEventListener('click', function () { setView('source-review'); });
  document.querySelectorAll('[data-source-kpi]').forEach(function (tile) { tile.addEventListener('click', function () { openModal({ icon: 'i', title: 'Source KPI: ' + tile.getAttribute('data-source-kpi'), subtitle: source.source + ' metric details', bodyHtml: modalSection('Details', modalStatRows([{ label: 'Source', value: source.source }, { label: 'Provider', value: source.provider }, { label: 'Messages', value: String(source.messageCount) }, { label: 'Average score', value: source.avgScore === null ? '-' : pct(source.avgScore) }])) }); }); });
  document.querySelectorAll('[data-issue]').forEach(function (chip) { chip.addEventListener('click', function () { openRemediationModal(chip.getAttribute('data-issue'), chip.getAttribute('data-rate')); }); });
  document.querySelectorAll('[data-tab]').forEach(function (btn) { btn.addEventListener('click', function () { store.setState({ selectedTab: btn.getAttribute('data-tab') }); }); });
  const tabContent = document.getElementById('source-tab-content');
  if (!tabContent) return;
  tabContent.querySelectorAll('[data-source-id]').forEach(function (row) { row.addEventListener('click', function () { setView('source-details', { selectedSourceId: row.getAttribute('data-source-id') }); }); });
  tabContent.querySelectorAll('[data-remediate]').forEach(function (btn) { btn.addEventListener('click', function () { openRemediationModal(btn.getAttribute('data-remediate'), btn.getAttribute('data-rate')); }); });
}

function openRemediationModal(issue, rate) {
  openModal({ icon: '!', title: issue + ' Root Cause', subtitle: 'Failure rate ' + pct(Number(rate)) + ' with remediation guidance.', bodyHtml: modalSection('Root Cause Summary', modalStatRows([{ label: 'Issue', value: issue }, { label: 'Failure Rate', value: pct(Number(rate)) }, { label: 'Likely Drivers', value: 'Missing fields, invalid coding, date precision' }])) + modalSection('Remediation Steps', '<ol><li>Validate source mapping for required attributes.</li><li>Correct coding system and value set conformance.</li><li>Backfill missing values from source systems.</li><li>Re-submit message and verify score lift on dashboard.</li></ol>') });
}

export function wireEntitiesView() {
  document.querySelectorAll('[data-entity-index]').forEach(function (row) {
    row.addEventListener('click', function () {
      const entity = RESOURCE_REGISTRY[Number(row.getAttribute('data-entity-index'))];
      openModal({ icon: 'i', title: entity.name, subtitle: entity.description, bodyHtml: modalSection('Entity Overview', modalStatRows([{ label: 'FHIR Resource', value: entity.name }, { label: 'Mapped Data Class', value: entity.dataClass }])) + modalSection('Key Fields', modalTable(['Field', 'Plain English Description'], entity.fields.map(function (field) { return [field, 'Business-critical element used in PIQI quality scoring and remediation analysis.']; }))) });
    });
  });
}

export function wireEvaluationsView() {
  document.querySelectorAll('[data-rubric-index]').forEach(function (card) {
    card.addEventListener('click', function () {
      const rubric = window.MOCK_DATA_LAYER.rubrics[Number(card.getAttribute('data-rubric-index'))];
      openModal({ icon: 'i', title: rubric.name, subtitle: rubric.mnemonic, bodyHtml: modalSection('Standard Details', modalStatRows([{ label: 'Status', value: rubric.status }, { label: 'Pass Threshold', value: pct(rubric.passThreshold) }, { label: 'Data Classes', value: String(rubric.classCount || '-') }, { label: 'Rules', value: String(rubric.ruleCount || '-') }])) + modalSection('Description', '<p>' + esc(rubric.description || 'No description') + '</p>') + modalSection('Covered Data Classes', '<div class="chips">' + STANDARD_USCDI_V3_CLASSES.map(function (className) { return '<span class="badge warn">' + esc(className) + '</span>'; }).join(' ') + '</div>') });
    });
  });
  const btn = document.getElementById('new-eval-btn');
  if (!btn) return;
  btn.addEventListener('click', function () {
    openModal({ icon: '+', title: 'New Evaluation', subtitle: 'Define a new rubric profile.', bodyHtml: '<section class="card"><div class="form-grid"><div class="form-item"><label>Name</label><input id="new-rubric-name" class="input"></div><div class="form-item"><label>Base Standard</label><select id="new-rubric-base" class="select"><option>USCDI_V3</option><option>USCDI_V2</option><option>HL7_FHIR_R4</option></select></div><div class="form-item"><label>Pass Threshold (%)</label><input id="new-rubric-threshold" class="input" type="number" min="0" max="100" value="70"></div><div class="form-item" style="grid-column:1 / -1"><label>Description</label><textarea id="new-rubric-description" class="textarea" style="min-height:120px"></textarea></div></div><div class="actions"><button class="btn primary" id="create-rubric-btn">Create Rubric</button></div></section>' });
    const createBtn = document.getElementById('create-rubric-btn');
    if (!createBtn) return;
    createBtn.addEventListener('click', function () {
      const name = (document.getElementById('new-rubric-name').value || '').trim();
      if (!name) return;
      window.MOCK_DATA_LAYER.rubrics.push({ mnemonic: name.toUpperCase().replace(/\s+/g, '_'), name: name, status: 'Draft', passThreshold: Number(document.getElementById('new-rubric-threshold').value || 70), description: (document.getElementById('new-rubric-description').value || '').trim() || ('Derived from ' + document.getElementById('new-rubric-base').value), classCount: 13, ruleCount: null });
      document.getElementById('modal-root').innerHTML = '';
      if (window.__dqSpa && typeof window.__dqSpa.renderAll === 'function') window.__dqSpa.renderAll();
    });
  });
}