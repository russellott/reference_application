import { esc } from './runtime.js';
import { openModal } from './modal-ui.js';
import { extractBatchScore } from './batch-io.js';
import { extractAssessmentItems, parseAuditedMessage, simplifyAttributeValue, statusBadgeClass } from './submit-audit.js';

export function extractAssessmentDetails(payload, messageId) {
  if (!payload || !payload.scoringData) return [];
  const assessments = [];
  const auditedMessage = parseAuditedMessage(payload.auditedMessage || payload.messageData);
  const dataClasses = ['Lab Results', 'Medications', 'Allergies', 'Conditions', 'Procedures', 'Vital Signs', 'Immunizations', 'Demographics', 'Encounters', 'Providers', 'Clinical Documents', 'Diagnostic Imaging', 'Goals', 'Health Assessments', 'Medical Devices'];

  if (auditedMessage && auditedMessage.patient) {
    dataClasses.forEach(function (className) {
      extractAssessmentItems(auditedMessage, className).forEach(function (item) {
        assessments.push({ messageId: messageId, dataClass: className, attributeName: item.attributeName || '-', attributeValue: item.attributeValue || 'N/A', rawAttributeValue: item.rawAttributeValue || item.attributeValue || 'N/A', assessment: item.assessment || '-', status: item.status || 'Unknown', reason: item.reason || '-', effect: item.effect || '-' });
      });
    });
  }

  if (!assessments.length && typeof payload.auditedMessage === 'string') {
    try {
      const parsed = JSON.parse(payload.auditedMessage);
      if (parsed && Array.isArray(parsed)) {
        parsed.forEach(function (item) {
          if (item.evaluationResults && Array.isArray(item.evaluationResults)) {
            item.evaluationResults.forEach(function (result) {
              const rawValue = item.messageData ? (typeof item.messageData === 'string' ? item.messageData : JSON.stringify(item.messageData)) : '-';
              assessments.push({ messageId: messageId, dataClass: item.dataClassMnemonic || item.classEntityMnemonic || '-', attributeName: item.entityName || item.name || '-', attributeValue: simplifyAttributeValue(item.entityName || item.name || '-', item.dataClassMnemonic || item.classEntityMnemonic || '-', rawValue), rawAttributeValue: rawValue, assessment: result.samDisplayName || result.samMnemonic || '-', status: result.evalResult || 'Unknown', reason: result.customErrorMessage || result.samMnemonic || '-', effect: result.isCritical ? 'Critical' : (result.isScoring ? 'Scoring' : 'Conditional') });
            });
          } else {
            const rawValue = item.messageData ? (typeof item.messageData === 'string' ? item.messageData : JSON.stringify(item.messageData)) : '-';
            assessments.push({ messageId: messageId, dataClass: item.dataClassMnemonic || item.classEntityMnemonic || '-', attributeName: item.entityName || item.name || '-', attributeValue: simplifyAttributeValue(item.entityName || item.name || '-', item.dataClassMnemonic || item.classEntityMnemonic || '-', rawValue), rawAttributeValue: rawValue, assessment: '-', status: 'No Assessments', reason: '-', effect: '-' });
          }
        });
      }
    } catch (_) {
      // Ignore invalid JSON fallback payloads.
    }
  }

  if (!assessments.length) {
    const score = extractBatchScore(payload);
    assessments.push({ messageId: messageId, dataClass: '-', attributeName: 'Summary', attributeValue: '-', rawAttributeValue: '-', assessment: score !== null ? score + '%' : '-', status: score !== null && score >= 70 ? 'Passed' : 'Failed', reason: payload.errorMessage || 'See details for full assessment', effect: score !== null && score >= 70 ? 'Passing' : 'Failing' });
  }
  return assessments;
}

function renderAssessmentValue(value) {
  const raw = value === null || value === undefined ? '-' : String(value);
  const trimmed = raw.trim();
  if (!trimmed) return '<span style="color:#64748b">-</span>';
  if ((trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}') || (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']')) {
    try {
      return '<pre style="margin:0;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto">' + esc(JSON.stringify(JSON.parse(trimmed), null, 2)) + '</pre>';
    } catch (_) {
      // Fall through to plain text.
    }
  }
  return '<div style="padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;white-space:pre-wrap;word-break:break-word;max-height:220px;overflow:auto">' + esc(raw) + '</div>';
}

function openBatchAssessmentDetail(rowNum, assessment) {
  if (!assessment) return;
  const status = String(assessment.status || 'Unknown');
  const statusClass = statusBadgeClass(status);
  const rawValue = assessment.rawAttributeValue || assessment.attributeValue;
  const hasSeparateRaw = rawValue && assessment.attributeValue && String(rawValue) !== String(assessment.attributeValue);
  const bodyHtml = '<section class="card" style="margin:0"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong style="font-size:1rem">' + esc(assessment.dataClass || '-') + ' · ' + esc(assessment.attributeName || '-') + '</strong><span class="batch-status-badge ' + esc(statusClass) + '">' + esc(status) + '</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px"><div class="stat-row"><span>Message ID</span><strong>' + esc(assessment.messageId || '-') + '</strong></div><div class="stat-row"><span>Batch Row</span><strong>Row ' + esc(rowNum) + '</strong></div><div class="stat-row"><span>Assessment</span><strong>' + esc(assessment.assessment || '-') + '</strong></div><div class="stat-row"><span>Effect</span><strong>' + esc(assessment.effect || '-') + '</strong></div></div></section><section class="card" style="margin:0"><h4 style="margin:0 0 8px">Attribute Value</h4>' + renderAssessmentValue(assessment.attributeValue) + '</section>' + (hasSeparateRaw ? '<section class="card" style="margin:0"><h4 style="margin:0 0 8px">Raw Payload</h4>' + renderAssessmentValue(rawValue) + '</section>' : '') + '<section class="card" style="margin:0"><h4 style="margin:0 0 8px">Reason</h4><div style="padding:10px 12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;white-space:pre-wrap;word-break:break-word">' + esc(assessment.reason || '-') + '</div></section>';
  openModal({ title: 'Assessment Detail', subtitle: 'Row ' + rowNum + ' · click outside to close', bodyHtml: bodyHtml });
}

function normalizeAssessmentStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'passed' || status === 'pass' || status === 'success') return 'pass';
  if (status === 'failed' || status === 'fail' || status === 'error') return 'fail';
  if (status === 'skipped' || status === 'skip' || status === 'no assessments') return 'skip';
  return 'skip';
}

function assessmentMatchesFilter(statusKey, filter) {
  if (filter === 'pass') return statusKey === 'pass';
  if (filter === 'issues') return statusKey === 'fail' || statusKey === 'skip';
  return true;
}

function computeAssessmentSummary(assessments) {
  return (assessments || []).reduce(function (acc, item) {
    const status = normalizeAssessmentStatus(item && item.status);
    if (status === 'pass') acc.pass += 1;
    else if (status === 'fail') acc.fail += 1;
    else acc.skip += 1;
    return acc;
  }, { pass: 0, fail: 0, skip: 0 });
}

export function renderBatchMasterDetail() {
  const root = document.getElementById('batch-master-detail');
  const kpis = document.getElementById('batch-master-kpis');
  const tbody = document.getElementById('batch-master-tbody');
  const title = document.getElementById('batch-master-title');
  const subtitle = document.getElementById('batch-master-sub');
  const btnAll = document.getElementById('batch-filter-all');
  const btnIssues = document.getElementById('batch-filter-issues');
  const btnPass = document.getElementById('batch-filter-pass');
  if (!root || !kpis || !tbody || !title || !subtitle) return;

  window.batchMasterState = window.batchMasterState || { messages: [], selectedKey: null, filter: 'all' };
  const state = window.batchMasterState;
  const messages = state.messages || [];

  const allAssessments = [];
  messages.forEach(function (message) {
    (message.assessments || []).forEach(function (assessment) {
      const statusKey = normalizeAssessmentStatus(assessment && assessment.status);
      if (assessmentMatchesFilter(statusKey, state.filter || 'all')) {
        allAssessments.push({ messageId: message.messageId || message.key || '-', rowNum: message.rowNum, assessment: assessment, statusKey: statusKey });
      }
    });
  });

  root.style.display = allAssessments.length ? 'block' : 'none';
  if (!allAssessments.length) {
    kpis.innerHTML = '';
    tbody.innerHTML = '';
    title.textContent = 'Batch checks';
    subtitle.textContent = state.filter === 'all' ? 'No checks yet.' : 'No checks match this filter.';
    return;
  }

  if (btnAll) btnAll.classList.toggle('active', state.filter === 'all');
  if (btnIssues) btnIssues.classList.toggle('active', state.filter === 'issues');
  if (btnPass) btnPass.classList.toggle('active', state.filter === 'pass');
  [btnAll, btnIssues, btnPass].forEach(function (btn, index) {
    if (btn && !btn.__bound) {
      btn.__bound = true;
      btn.addEventListener('click', function () {
        state.filter = ['all', 'issues', 'pass'][index];
        renderBatchMasterDetail();
      });
    }
  });

  const aggregate = allAssessments.reduce(function (acc, entry) {
    if (entry.statusKey === 'pass') acc.pass += 1;
    else if (entry.statusKey === 'fail') acc.fail += 1;
    else acc.skip += 1;
    const score = entry.assessment && entry.assessment.assessment;
    if (typeof score === 'string' && score.endsWith('%')) {
      const numeric = Number(score.replace('%', ''));
      if (!Number.isNaN(numeric)) {
        acc.scoreSum += numeric;
        acc.scoreCount += 1;
      }
    }
    return acc;
  }, { pass: 0, fail: 0, skip: 0, scoreSum: 0, scoreCount: 0 });

  title.textContent = 'Batch checks';
  const matchedMessages = new Set(allAssessments.map(function (entry) { return entry.rowNum; })).size;
  subtitle.textContent = String(matchedMessages) + ' messages · ' + String(allAssessments.length) + ' checks.';
  kpis.innerHTML = '<div class="batch-mini-kpi"><span>Avg Score</span><strong>' + esc(aggregate.scoreCount ? Math.round(aggregate.scoreSum / aggregate.scoreCount) + '%' : '-') + '</strong></div><div class="batch-mini-kpi"><span>Pass</span><strong class="pass">' + esc(String(aggregate.pass)) + '</strong></div><div class="batch-mini-kpi"><span>Fail</span><strong class="fail">' + esc(String(aggregate.fail)) + '</strong></div><div class="batch-mini-kpi"><span>Skip</span><strong class="warn">' + esc(String(aggregate.skip)) + '</strong></div>';
  tbody.innerHTML = allAssessments.map(function (entry, index) {
    const assessment = entry.assessment;
    const rowClass = entry.statusKey === 'pass' ? 'row-pass' : (entry.statusKey === 'fail' ? 'row-failed' : 'row-skipped');
    return '<tr class="' + rowClass + ' clickable batch-assessment-row" data-assessment-index="' + esc(String(index)) + '"><td class="batch-message-id" title="' + esc(entry.messageId) + '">' + esc(entry.messageId) + '</td><td>' + esc(assessment && assessment.dataClass || '-') + '</td><td>' + esc(assessment && assessment.attributeName || '-') + '</td><td class="batch-attribute-value" title="' + esc(assessment && assessment.attributeValue || '-') + '">' + esc(assessment && assessment.attributeValue || '-') + '</td><td>' + esc(assessment && assessment.assessment || '-') + '</td><td><span class="batch-status-badge ' + esc(statusBadgeClass(assessment && assessment.status || '')) + '">' + esc(assessment && assessment.status || '-') + '</span></td><td class="batch-reason" title="' + esc(assessment && assessment.reason || '-') + '">' + esc(assessment && assessment.reason || '-') + '</td><td>' + esc(assessment && assessment.effect || '-') + '</td></tr>';
  }).join('');
  tbody.querySelectorAll('[data-assessment-index]').forEach(function (el) {
    el.addEventListener('click', function () {
      const selected = allAssessments[Number(el.getAttribute('data-assessment-index'))];
      if (selected) openBatchAssessmentDetail(selected.rowNum, selected.assessment);
    });
  });
}

function upsertBatchMessage(rowNum, messageId, score, status, assessments, details) {
  window.batchMasterState = window.batchMasterState || { messages: [], selectedKey: null, filter: 'all' };
  const key = 'row-' + rowNum;
  const entry = { key: key, rowNum: rowNum, messageId: messageId || key, score: typeof score === 'number' ? score : null, status: status, assessments: assessments || [], details: details, summary: computeAssessmentSummary(assessments) };
  const list = window.batchMasterState.messages;
  const idx = list.findIndex(function (message) { return message.key === key; });
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  if (!window.batchMasterState.selectedKey) window.batchMasterState.selectedKey = key;
}

export function updateBatchRow(rowNum, messageId, score, status, details) {
  const assessments = extractAssessmentDetails(details, messageId || ('Row ' + rowNum));
  const numericScore = typeof score === 'number' ? score : (typeof score === 'string' && score.endsWith('%') ? Number(score.replace('%', '')) : null);
  upsertBatchMessage(rowNum, messageId || ('Row ' + rowNum), numericScore, status, assessments, details);
  renderBatchMasterDetail();
  window.batchDetails = window.batchDetails || {};
  window.batchDetails[rowNum] = details;
}

window.showBatchDetail = function (rowNum) {
  const details = window.batchDetails && window.batchDetails[rowNum];
  openModal({ icon: 'i', title: 'Batch Row ' + rowNum + ' Details', subtitle: typeof details === 'string' ? 'Error or raw message text.' : 'Scoring response payload.', bodyHtml: '<pre style="white-space: pre-wrap; word-break: break-word;">' + esc(typeof details === 'string' ? details : JSON.stringify(details, null, 2)) + '</pre>' });
};