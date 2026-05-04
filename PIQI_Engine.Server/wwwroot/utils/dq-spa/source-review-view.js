import { bucket, esc, pct, scoreClass, store } from './runtime.js';
import { aggregateClassRows, filteredSources, sourceFilterOptions } from './data-model.js';
import { progressCell } from './submit-audit.js';

export function renderSourceReviewRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="8">No sources match current filters.</td></tr>';
  }
  return rows.map(function (source) {
    return '<tr class="clickable" data-source-id="' + esc(source.id) + '"><td>' + esc(source.source) + '</td><td>' + esc(source.provider) + '</td><td>' + esc(source.facility || '-') + '</td><td>' + esc(source.application || '-') + '</td><td>' + esc(source.messageCount) + '</td><td class="' + scoreClass(source.avgScore) + '">' + esc(source.avgScore === null ? '-' : pct(source.avgScore)) + '</td><td>' + esc(source.criticalCount) + '</td><td>' + esc(source.cleanCount) + '</td></tr>';
  }).join('');
}

export function renderClassStructuralRows(sources) {
  const rows = aggregateClassRows(sources);
  return rows.map(function (row) {
    const status = bucket(row.score);
    const label = row.score === null ? 'No Data' : status === 'pass' ? 'Passing' : status === 'warn' ? 'Watch' : 'Failing';
    return '<tr class="clickable" data-class-name="' + esc(row.name) + '"><td>' + esc(row.name) + '</td><td>' + progressCell(row.pass) + '</td><td>' + progressCell(row.critical, true) + '</td><td>' + progressCell(row.clean) + '</td><td><span class="badge ' + status + '">' + esc(label) + '</span></td></tr>';
  }).join('');
}

export function renderSourceReview() {
  const state = store.getState();
  const options = sourceFilterOptions();
  const sources = filteredSources(state.sourceFilters);
  const hasData = window.MOCK_DATA_LAYER.submissions.length > 0;
  function selectHtml(field) {
    return '<select class="select" data-filter="' + field + '"><option value="">All</option>' + options[field].map(function (value) {
      return '<option value="' + esc(value) + '" ' + (state.sourceFilters[field] === value ? 'selected' : '') + '>' + esc(value) + '</option>';
    }).join('') + '</select>';
  }

  return '' +
    '<section class="view dense-view source-review-view"><section class="card"><h2 class="section-title">Source Review</h2><p class="section-sub">Filter and inspect source-level performance with class-level drill-down.</p></section><section class="card"><div class="filter-bar"><div class="form-item"><label>Provider</label>' + selectHtml('provider') + '</div><div class="form-item"><label>Source</label>' + selectHtml('source') + '</div><div class="form-item"><label>Facility</label>' + selectHtml('facility') + '</div><div class="form-item"><label>Application</label>' + selectHtml('application') + '</div><div class="form-item"><label>Format</label>' + selectHtml('format') + '</div><div class="form-item"><label>Use Case</label>' + selectHtml('useCase') + '</div></div></section><section class="card table-wrap"><table class="table dense-table" id="review-source-table"><thead><tr><th>Source</th><th>Provider</th><th>Facility</th><th>Application</th><th>Messages</th><th>Average Score</th><th>Critical</th><th>Clean</th></tr></thead><tbody>' + renderSourceReviewRows(sources) + '</tbody></table></section><section class="chart-grid"><article class="card chart-card"><h3 style="margin-top:0">Source Trend</h3><canvas id="chart-line-review" width="860" height="300"></canvas></article><article class="card chart-card chart-donut-card"><h3 style="margin-top:0;color:#0f172a">Class Distribution</h3><canvas id="chart-donut-review" width="540" height="300"></canvas></article></section><section class="card"><h3 style="margin-top:0">Data Class Results</h3>' + (!hasData ? '<div class="placeholder-banner">No submission data yet. Structural rows are shown and scores will appear after message submission.</div>' : '') + '<div class="table-wrap"><table class="table dense-table" id="class-result-table"><thead><tr><th>Data Class</th><th>Pass %</th><th>Critical %</th><th>Clean %</th><th>Status</th></tr></thead><tbody>' + renderClassStructuralRows(sources) + '</tbody></table></div></section></section>';
}