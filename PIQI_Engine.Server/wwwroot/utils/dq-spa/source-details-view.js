import { RESOURCE_REGISTRY, esc, pct, scoreClass, store } from './runtime.js';
import { renderLegacyAuditTab, tabButton, topIssueChips } from './submit-audit.js';
import { sourceRankedRows } from './data-model.js';

export function renderSourceTabContent(source, tab) {
  if (tab === 'classes') {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Data Class</th><th>Score</th><th>Checks</th><th>Critical</th></tr></thead><tbody>' + source.classRows.map(function (row) {
      return '<tr><td>' + esc(row.dataClassName) + '</td><td class="' + scoreClass(row.score) + '">' + esc(row.score === null ? '-' : pct(row.score)) + '</td><td>' + esc((row.numerator || 0) + ' / ' + (row.denominator || 0)) + '</td><td>' + esc(row.critical || 0) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  if (tab === 'entities') {
    const rows = RESOURCE_REGISTRY.map(function (resource) {
      const classRow = source.classRows.find(function (row) { return row.dataClassName === resource.dataClass; });
      return '<tr><td>' + esc(resource.name) + '</td><td>' + esc(resource.dataClass) + '</td><td class="' + scoreClass(classRow ? classRow.score : null) + '">' + esc(classRow && classRow.score !== null ? pct(classRow.score) : '-') + '</td></tr>';
    }).join('');
    return '<div class="table-wrap"><table class="table"><thead><tr><th>FHIR Resource</th><th>Data Class</th><th>Quality Score</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  if (tab === 'ranking') {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Rank</th><th>Source</th><th>Provider</th><th>Average Score</th></tr></thead><tbody>' + sourceRankedRows().map(function (row) {
      return '<tr class="clickable" data-source-id="' + esc(row.id) + '"><td>' + esc(row.rank) + '</td><td>' + esc(row.source) + '</td><td>' + esc(row.provider) + '</td><td class="' + scoreClass(row.avgScore) + '">' + esc(row.avgScore === null ? '-' : pct(row.avgScore)) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  if (tab === 'remediation') {
    const rows = source.classRows.filter(function (row) { return row.score !== null && row.score < 70; });
    if (!rows.length) return '<p class="section-sub">No remediation items yet.</p>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Issue</th><th>Failure Rate</th><th>Action</th></tr></thead><tbody>' + rows.map(function (row) {
      const rate = row.denominator ? (Math.max(row.denominator - row.numerator, 0) / row.denominator) * 100 : 0;
      return '<tr><td>' + esc(row.dataClassName) + '</td><td>' + esc(pct(rate)) + '</td><td><button class="btn secondary" data-remediate="' + esc(row.dataClassName) + '" data-rate="' + rate.toFixed(1) + '">Open Plan</button></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  if (tab === 'legacy') return renderLegacyAuditTab(source);
  return '<p class="section-sub">This section is scaffolded and will populate from submitted source metadata when available.</p>';
}

export function renderSourceDetails() {
  const state = store.getState();
  const source = window.MOCK_DATA_LAYER.sources.find(function (item) { return item.id === state.selectedSourceId; });
  if (!source) {
    return '<section class="view"><section class="card"><h2 class="section-title">Source Details</h2><p class="section-sub">Select a source from dashboard or source review.</p></section></section>';
  }

  const kpis = [
    { key: 'messages', label: 'Total Messages', value: source.messageCount },
    { key: 'score', label: 'Average Score', value: source.avgScore === null ? '-' : pct(source.avgScore) },
    { key: 'critical', label: 'Critical Messages', value: source.criticalCount },
    { key: 'clean', label: 'Clean Messages', value: source.cleanCount },
    { key: 'provider', label: 'Provider', value: source.provider },
    { key: 'source', label: 'Source', value: source.source }
  ];

  return '' +
    '<section class="view dense-view source-details-view"><section class="card"><div><button class="btn secondary" id="back-source-review">Back to Source Review</button></div><h2 class="section-title" style="margin-top:10px">Source Details: ' + esc(source.source) + '</h2><p class="section-sub">Provider ' + esc(source.provider) + ' · Facility ' + esc(source.facility || '-') + '</p></section><section class="kpi-grid">' + kpis.map(function (kpi) {
      return '<article class="kpi" data-source-kpi="' + esc(kpi.key) + '"><div class="kpi-label">' + esc(kpi.label) + '</div><div class="kpi-value">' + esc(kpi.value) + '</div></article>';
    }).join('') + '</section><section class="chart-grid"><article class="card chart-card"><h3 style="margin-top:0">Overall Quality Gauge</h3><canvas id="chart-gauge-source" width="540" height="280"></canvas></article><article class="card chart-card"><h3 style="margin-top:0">Source Trend Over Time</h3><canvas id="chart-line-source" width="860" height="280"></canvas></article></section><section class="card"><h3 style="margin-top:0">Top Failing Attributes</h3><div class="chips">' + topIssueChips(source) + '</div></section><section class="card"><div class="tabs">' + tabButton(state.selectedTab, 'classes', 'Classes') + tabButton(state.selectedTab, 'entities', 'Entities') + tabButton(state.selectedTab, 'ranking', 'Ranking Trends') + tabButton(state.selectedTab, 'remediation', 'Remediation') + tabButton(state.selectedTab, 'legacy', 'Legacy Audit') + tabButton(state.selectedTab, 'application', 'Application') + tabButton(state.selectedTab, 'formats', 'Formats') + '</div><div id="source-tab-content" style="margin-top:10px">' + renderSourceTabContent(source, state.selectedTab) + '</div></section></section>';
}