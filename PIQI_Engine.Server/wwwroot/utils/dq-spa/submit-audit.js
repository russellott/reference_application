import { RESOURCE_REGISTRY, STANDARD_USCDI_V3_CLASSES, bucket, esc, pct, scoreClass } from './runtime.js';

export function parseAuditedMessage(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function getClassFieldPath(className) {
  const map = {
    'Lab Results': 'labResults',
    Medications: 'medications',
    Allergies: 'allergies',
    Conditions: 'conditions',
    Procedures: 'procedures',
    'Vital Signs': 'vitalSigns',
    Immunizations: 'immunizations',
    Demographics: 'demographics',
    Encounters: 'encounters',
    Providers: 'providers',
    'Clinical Documents': 'clinicalDocuments',
    'Diagnostic Imaging': 'diagnosticImaging',
    Goals: 'goals',
    'Health Assessments': 'healthAssessments',
    'Medical Devices': 'medicalDevices'
  };
  return map[className] || null;
}

export function safeJsonParse(input) {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const looksJson = (trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}') || (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']');
  if (!looksJson) return null;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return null;
  }
}

export function firstCodingValue(data) {
  if (!data || typeof data !== 'object') return null;
  const codings = Array.isArray(data.codings) ? data.codings : [];
  if (!codings.length) return null;
  const coding = codings[0] || {};
  return coding.code || coding.display || coding.system || null;
}

export function simplifyAttributeValue(attributeName, dataClass, rawValue) {
  if (rawValue === undefined || rawValue === null) return 'N/A';
  const attr = String(attributeName || '').toLowerCase();
  const primitive = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean' ? String(rawValue) : null;
  const parsed = typeof rawValue === 'object' ? rawValue : safeJsonParse(primitive || '');
  if (!parsed) return primitive && primitive.trim() ? primitive.trim() : 'N/A';

  if (attr.indexOf('resultvalue') >= 0 || attr.indexOf('valuequantity') >= 0) {
    if (parsed.text !== undefined && parsed.text !== null && String(parsed.text).trim()) return String(parsed.text);
    if (parsed.value !== undefined && parsed.value !== null) return String(parsed.value);
    if (parsed.lowValue !== undefined && parsed.highValue !== undefined) return String(parsed.lowValue) + ' - ' + String(parsed.highValue);
  }
  if (attr.indexOf('resultunit') >= 0 || attr.indexOf('unit') >= 0 || attr.indexOf('test') >= 0 || attr.indexOf('code') >= 0 || attr.indexOf('specimen') >= 0 || attr.indexOf('type') >= 0) {
    const code = firstCodingValue(parsed);
    if (code) return String(code);
    if (parsed.text) return String(parsed.text);
  }
  if (attr.indexOf('date') >= 0 || attr.indexOf('time') >= 0) {
    if (parsed.text) return String(parsed.text);
    if (parsed.value) return String(parsed.value);
  }
  if (parsed.text !== undefined && parsed.text !== null && String(parsed.text).trim()) return String(parsed.text);
  const codingFallback = firstCodingValue(parsed);
  if (codingFallback) return String(codingFallback);
  if (Array.isArray(parsed) && parsed.length) {
    const first = parsed[0];
    if (typeof first === 'string' || typeof first === 'number' || typeof first === 'boolean') return String(first);
  }
  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const value = parsed[keys[0]];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return dataClass === 'Lab Results' ? 'Structured Value' : 'Structured Data';
}

export function extractAssessmentItems(auditedMessage, className) {
  const out = [];
  const fieldPath = getClassFieldPath(className);
  if (!auditedMessage || !auditedMessage.patient || !fieldPath || !Array.isArray(auditedMessage.patient[fieldPath])) return out;

  auditedMessage.patient[fieldPath].forEach(function (element) {
    Object.keys(element || {}).forEach(function (key) {
      const attribute = element[key];
      if (!attribute || !attribute.attributeAudit || !Array.isArray(attribute.attributeAudit.assessmentItems)) return;
      attribute.attributeAudit.assessmentItems.forEach(function (item) {
        let rawValue = 'N/A';
        let displayValue = 'N/A';
        if (attribute.data !== undefined && attribute.data !== null) {
          if (typeof attribute.data === 'object') {
            rawValue = JSON.stringify(attribute.data);
            displayValue = simplifyAttributeValue(item.attributeName || key, className, attribute.data);
          } else {
            rawValue = String(attribute.data);
            displayValue = simplifyAttributeValue(item.attributeName || key, className, rawValue);
          }
        }
        out.push({
          attributeName: item.attributeName || key,
          attributeValue: displayValue,
          rawAttributeValue: rawValue,
          assessment: item.assessment || '-',
          status: item.status || 'Unknown',
          reason: item.reason || '-',
          effect: item.effect || '-'
        });
      });
    });
  });
  return out;
}

export function statusBadgeClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'passed') return 'pass';
  if (normalized === 'skipped') return 'warn';
  return 'fail';
}

export function wireSubmitAuditPanel() {
  document.querySelectorAll('[data-legacy-filter-btn]').forEach(function (btn) {
    btn.onclick = function () {
      const tableId = btn.getAttribute('data-table-id');
      const filterMode = btn.getAttribute('data-filter-mode') || 'failed';
      const table = document.getElementById(tableId);
      if (!table) return;
      const nextMode = filterMode === 'failed' ? 'all' : 'failed';
      btn.setAttribute('data-filter-mode', nextMode);
      btn.textContent = nextMode === 'failed' ? 'Show FAILED Only' : 'Show All';
      table.querySelectorAll('tbody tr').forEach(function (row) {
        const status = String(row.getAttribute('data-status') || '').toLowerCase();
        row.style.display = nextMode === 'all' || status === 'failed' ? '' : 'none';
      });
    };
  });
}

export function progressCell(value, inverse) {
  if (value === null) return '-';
  const score = inverse ? 100 - value : value;
  const cls = bucket(score);
  return '<div class="progress ' + cls + '"><span style="width:' + Math.max(0, Math.min(100, value)).toFixed(1) + '%"></span></div><div class="' + scoreClass(score) + '">' + pct(value) + '</div>';
}

export function renderLegacyAuditTab(source, statusCode) {
  const raw = source && source.lastRaw;
  const scoring = raw && raw.scoringData ? raw.scoringData : null;
  const messageResults = scoring && scoring.messageResults ? scoring.messageResults : null;
  const dataClassResults = scoring && Array.isArray(scoring.dataClassResults) ? scoring.dataClassResults : [];
  const auditedMessage = parseAuditedMessage(raw && raw.auditedMessage ? raw.auditedMessage : null);
  if (!raw || !scoring) return '<p class="section-sub">Legacy audit details are not available for this source yet.</p>';

  const metrics = [
    { label: 'Denominator', value: messageResults && messageResults.denominator !== undefined ? String(messageResults.denominator) : '-' },
    { label: 'Numerator', value: messageResults && messageResults.numerator !== undefined ? String(messageResults.numerator) : '-' },
    { label: 'PIQI Score', value: messageResults && messageResults.piqiScore !== undefined ? pct(messageResults.piqiScore) : '-' },
    { label: 'Critical Failure Count', value: messageResults && messageResults.criticalFailureCount !== undefined ? String(messageResults.criticalFailureCount) : '-' },
    { label: 'Weighted Denominator', value: messageResults && messageResults.weightedDenominator !== undefined ? String(messageResults.weightedDenominator) : '-' },
    { label: 'Weighted Numerator', value: messageResults && messageResults.weightedNumerator !== undefined ? String(messageResults.weightedNumerator) : '-' },
    { label: 'Weighted PIQI Score', value: messageResults && messageResults.weightedPIQIScore !== undefined ? pct(messageResults.weightedPIQIScore) : '-' }
  ];

  let html = '';
  if (statusCode) html += '<div class="legacy-success-header"><span class="legacy-success-icon">✓</span><strong>Success (Status: ' + statusCode + ')</strong></div>';
  html += '<section class="legacy-block"><h3 class="legacy-title">Message Results</h3><div class="legacy-metric-grid">' +
    metrics.map(function (metric) {
      return '<article class="legacy-metric"><div class="legacy-metric-label">' + esc(metric.label) + '</div><div class="legacy-metric-value">' + esc(metric.value) + '</div></article>';
    }).join('') + '</div></section>';

  if (dataClassResults.length > 0) {
    let classToShow = null;
    let assessmentRows = [];
    dataClassResults.forEach(function (result) {
      if (classToShow) return;
      if (Number(result && result.instanceCount || 0) <= 0) return;
      const rows = extractAssessmentItems(auditedMessage, result.dataClassName);
      if (rows.length) {
        classToShow = result;
        assessmentRows = rows;
      }
    });

    if (classToShow) {
      html += '<section class="legacy-block"><h3 class="legacy-title">Data Class Results Summary</h3>' +
        '<button class="btn secondary" style="margin-bottom:12px" data-legacy-filter-btn="true" data-filter-mode="failed" data-table-id="submit-legacy-table">Show FAILED Only</button>' +
        '<div class="legacy-class-group"><h4 class="legacy-class-name">' + esc(classToShow.dataClassName || 'Unknown Class') + '</h4><div class="table-wrap"><table class="table legacy-table" id="submit-legacy-table">' +
        '<thead><tr><th>Attribute</th><th>Value</th><th>Assessment</th><th>Status</th><th>Reason</th><th>Effect</th></tr></thead><tbody>' +
        assessmentRows.map(function (item) {
          const preview = item.attributeValue && item.attributeValue.length > 80 ? item.attributeValue.slice(0, 80) + '...' : item.attributeValue;
          return '<tr data-status="' + esc(String(item.status || 'Unknown').toLowerCase()) + '"><td><strong>' + esc(item.attributeName || '-') + '</strong></td><td class="legacy-value" title="' + esc(item.attributeValue || '') + '">' + esc(preview || 'N/A') + '</td><td>' + esc(item.assessment || '-') + '</td><td><span class="badge ' + statusBadgeClass(item.status) + '">' + esc(item.status || 'Unknown') + '</span></td><td><em>' + esc(item.reason || '-') + '</em></td><td>' + esc(item.effect || 'SCORING') + '</td></tr>';
        }).join('') + '</tbody></table></div></div></section>';
    }
  }

  const auditedPayload = auditedMessage || (raw && raw.auditedMessage) || {};
  html += '<section class="legacy-block"><div class="legacy-collapsible-header" onclick="this.parentElement.classList.toggle(\'collapsed\')"><span class="legacy-collapse-icon">▼</span><h3 class="legacy-title" style="display:inline-block;margin:0">Audited Message</h3></div><div class="legacy-json">' + esc(typeof auditedPayload === 'string' ? auditedPayload : JSON.stringify(auditedPayload, null, 2)) + '</div></section>';
  return html;
}

export function tabButton(selectedTab, id, label) {
  return '<button class="tab-btn ' + (selectedTab === id ? 'active' : '') + '" data-tab="' + id + '">' + esc(label) + '</button>';
}

export function topIssueChips(source) {
  const rows = (source.classRows || []).filter(function (row) { return row.score !== null; }).sort(function (a, b) { return (a.score || 0) - (b.score || 0); }).slice(0, 6);
  if (!rows.length) return '<span class="section-sub">No source-level issue chips yet. Submit scored messages to populate top failures.</span>';
  return rows.map(function (row) {
    const failureRate = row.denominator ? (Math.max(row.denominator - row.numerator, 0) / row.denominator) * 100 : 0;
    return '<button class="chip" data-issue="' + esc(row.dataClassName) + '" data-rate="' + failureRate.toFixed(1) + '">' + esc(row.dataClassName) + ' ' + pct(failureRate) + ' fail</button>';
  }).join('');
}

export function renderStaticClassViews() {
  return '' +
    '<section class="view"><section class="card"><h2 class="section-title">Classes</h2><p class="section-sub">Class-level overview of structural PIQI categories.</p></section>' +
    '<section class="card table-wrap"><table class="table"><thead><tr><th>Class</th><th>Status</th></tr></thead><tbody>' +
    STANDARD_USCDI_V3_CLASSES.map(function (className) {
      return '<tr><td>' + esc(className) + '</td><td><span class="badge warn">Structural</span></td></tr>';
    }).join('') + '</tbody></table></section></section>';
}

export function renderEntityRegistry() {
  return '' +
    '<section class="view"><section class="card"><h2 class="section-title">FHIR Entity Registry</h2><p class="section-sub">Resource types mapped to PIQI classes. Click any row for full field descriptions.</p></section>' +
    '<section class="card table-wrap"><table class="table" id="entity-table"><thead><tr><th>Resource</th><th>Mapped Data Class</th><th>Description</th></tr></thead><tbody>' +
    RESOURCE_REGISTRY.map(function (resource, index) {
      return '<tr class="clickable" data-entity-index="' + index + '"><td>' + esc(resource.name) + '</td><td>' + esc(resource.dataClass) + '</td><td>' + esc(resource.description) + '</td></tr>';
    }).join('') + '</tbody></table></section></section>';
}