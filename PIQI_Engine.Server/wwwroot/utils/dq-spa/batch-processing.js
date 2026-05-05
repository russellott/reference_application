import { ingestApiResponse } from './data-model.js';
import { buildBatchMeta, buildBatchRowRequest, createEmptyBatchBreakdown, extractBatchScore, parseBatchFile, summarizeAssessmentStatuses } from './batch-io.js';
import { extractAssessmentDetails, renderBatchMasterDetail, updateBatchRow } from './batch-detail.js?v=9';
import { store } from './runtime.js';

export function updateBatchSummary(total, processed, passed, failed, average, classBreakdown, batchMeta) {
  const ids = { total: 'batch-total', processed: 'batch-processed', passed: 'batch-passed', failed: 'batch-failed', average: 'batch-average', classPass: 'batch-class-pass', classFail: 'batch-class-fail', classSkip: 'batch-class-skip', note: 'batch-correlation-note', runId: 'batch-run-id', elapsed: 'batch-elapsed', rate: 'batch-rate', successRate: 'batch-success-rate' };
  const elements = Object.keys(ids).reduce(function (acc, key) { acc[key] = document.getElementById(ids[key]); return acc; }, {});
  if (elements.total) elements.total.textContent = String(total);
  if (elements.processed) elements.processed.textContent = String(processed);
  if (elements.passed) elements.passed.textContent = String(passed);
  if (elements.failed) elements.failed.textContent = String(failed);
  if (elements.average) elements.average.textContent = average;
  if (elements.runId) elements.runId.textContent = batchMeta && batchMeta.runId ? batchMeta.runId : '-';
  if (elements.elapsed) elements.elapsed.textContent = batchMeta && batchMeta.elapsed ? batchMeta.elapsed : '0.0s';
  if (elements.rate) elements.rate.textContent = batchMeta && batchMeta.rate ? batchMeta.rate : '0.00 rows/sec';
  if (elements.successRate) elements.successRate.textContent = batchMeta && batchMeta.successRate ? batchMeta.successRate : '0%';
  if (elements.classPass) elements.classPass.textContent = String(classBreakdown && classBreakdown.pass || 0);
  if (elements.classFail) elements.classFail.textContent = String(classBreakdown && classBreakdown.fail || 0);
  if (elements.classSkip) elements.classSkip.textContent = String(classBreakdown && classBreakdown.skip || 0);
  if (elements.note) {
    const pass = classBreakdown && classBreakdown.pass || 0;
    const fail = classBreakdown && classBreakdown.fail || 0;
    const skip = classBreakdown && classBreakdown.skip || 0;
    elements.note.textContent = processed > 0 || pass > 0 || fail > 0 || skip > 0 ? (batchMeta && batchMeta.processedLabel ? batchMeta.processedLabel : String(processed) + ' rows processed') + '. Checks: ' + pass + ' passed, ' + fail + ' failed, ' + skip + ' skipped.' : 'Processed rows and assessment checks will appear here during batch execution.';
  }
  document.dispatchEvent(new CustomEvent('piqi:batchSummaryUpdated'));
}

function updateBatchProgress(progressBar, processed, total) {
  if (!progressBar) return;
  progressBar.style.width = (total > 0 ? Math.round((processed / total) * 100) : 0) + '%';
}

export async function processBatchUpload() {
  const fileInput = document.getElementById('batch-file');
  const statusHint = document.getElementById('batch-file-hint');
  const resultsCard = document.getElementById('batch-result-card');
  const progressBar = document.getElementById('batch-progress-bar');
  const endpoint = document.getElementById('cfg-endpoint').value.trim();
  const model = document.getElementById('cfg-model').value.trim();
  const rubric = document.getElementById('cfg-rubric').value.trim();
  const provider = document.getElementById('cfg-provider').value.trim() || 'Provider';
  const source = document.getElementById('cfg-source').value.trim() || 'Source';
  const facility = document.getElementById('cfg-facility').value.trim();
  const application = document.getElementById('cfg-application').value.trim();
  const format = document.getElementById('cfg-format').value.trim() || 'JSON';
  const useCase = document.getElementById('cfg-use-case').value.trim();
  const batchRunId = 'batch-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const runStartedAt = Date.now();
  const assessmentBreakdown = createEmptyBatchBreakdown();
  if (!fileInput || !fileInput.files.length) {
    if (statusHint) statusHint.textContent = 'Please select a batch file first.';
    return;
  }

  const file = fileInput.files[0];
  if (window.MOCK_DATA_LAYER.previewCorrelation) {
    window.MOCK_DATA_LAYER.activeBatchRunId = batchRunId;
    store.setState({ donutMode: 'message' });
  }
  window.batchMasterState = { messages: [], selectedKey: null, filter: 'all' };
  if (statusHint) statusHint.textContent = 'Reading batch file...';
  if (resultsCard) resultsCard.style.display = 'none';
  renderBatchMasterDetail();
  updateBatchSummary(0, 0, 0, 0, 'N/A', assessmentBreakdown, buildBatchMeta(batchRunId, runStartedAt, 0, 0, 0));

  let rows;
  try {
    rows = await parseBatchFile(file);
  } catch (err) {
    if (statusHint) statusHint.textContent = 'Batch parse error: ' + err.message;
    return;
  }
  if (!rows.length) {
    if (statusHint) statusHint.textContent = 'Batch file contained no rows.';
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  if (resultsCard) resultsCard.style.display = 'block';
  if (statusHint) statusHint.textContent = 'Processing ' + rows.length + ' rows...';

  for (let i = 0; i < rows.length; i += 1) {
    const rowNum = i + 1;
    if (statusHint) statusHint.textContent = 'Processing row ' + rowNum + ' of ' + rows.length + '...';
    try {
      const requestBody = buildBatchRowRequest(rows[i], rowNum, provider, source, model, rubric);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : await response.text();
      if (!response.ok) throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));

      const score = extractBatchScore(payload);
      const messageId = requestBody.messageID;
      const assessments = extractAssessmentDetails(payload, messageId);
      const assessmentSummary = summarizeAssessmentStatuses(assessments);
      succeeded += 1;
      processed += 1;
      if (score !== null) { scoreSum += score; scoreCount += 1; }
      assessmentBreakdown.pass += assessmentSummary.pass;
      assessmentBreakdown.fail += assessmentSummary.fail;
      assessmentBreakdown.skip += assessmentSummary.skip;
      ingestApiResponse({ provider: provider, source: source, facility: facility, application: application, format: format, useCase: useCase, endpoint: endpoint, model: model, rubric: rubric, batchRunId: batchRunId }, payload);
      updateBatchSummary(rows.length, processed, succeeded, failed, scoreCount > 0 ? Math.round(scoreSum / scoreCount) + '%' : 'N/A', assessmentBreakdown, buildBatchMeta(batchRunId, runStartedAt, processed, rows.length, succeeded));
      updateBatchProgress(progressBar, processed, rows.length);
      updateBatchRow(rowNum, messageId, score === null ? '-' : score + '%', score >= 70 ? 'pass' : 'fail', payload);
    } catch (err) {
      failed += 1;
      processed += 1;
      updateBatchSummary(rows.length, processed, succeeded, failed, scoreCount > 0 ? Math.round(scoreSum / scoreCount) + '%' : 'N/A', assessmentBreakdown, buildBatchMeta(batchRunId, runStartedAt, processed, rows.length, succeeded));
      updateBatchProgress(progressBar, processed, rows.length);
      updateBatchRow(rowNum, null, '-', 'fail', err.message);
    }
  }

  if (statusHint) {
    statusHint.textContent = failed > 0 ? 'Batch complete with request errors. Processed ' + processed + ' of ' + rows.length + ' rows; request failures: ' + failed + '.' : 'Batch complete. Processed ' + processed + ' rows.';
  }
}