import { activeSessionSources, activeSessionSubmissions, bucket, esc, pct, scoreClass, store } from './runtime.js';
import { aggregateClassRows, getActiveBatchCorrelationSummary, getKpis, sourceRankedRows } from './data-model.js';
import { progressCell } from './submit-audit.js';

export function renderSourceRows(rows, clickable) {
  if (!rows.length) {
    return '<tr><td colspan="7">No sources submitted yet. Submit a message to populate this table.</td></tr>';
  }
  return rows.map(function (row) {
    return '<tr class="' + (clickable ? 'clickable' : '') + '" data-source-id="' + esc(row.id) + '">' +
      '<td>' + esc(row.source) + '</td>' +
      '<td>' + esc(row.provider) + '</td>' +
      '<td>' + esc(row.messageCount) + '</td>' +
      '<td class="' + scoreClass(row.avgScore) + '">' + esc(row.avgScore === null ? '-' : pct(row.avgScore)) + '</td>' +
      '<td>' + esc(row.criticalCount) + '</td>' +
      '<td>' + esc(row.cleanCount) + '</td>' +
      '<td>' + esc(row.rank || '-') + '</td>' +
      '</tr>';
  }).join('');
}

export function renderDashboardClassRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="4">No class outcomes available yet.</td></tr>';
  }
  return rows.map(function (row) {
    const status = bucket(row.score);
    const label = row.score === null ? 'No Data' : status === 'pass' ? 'Passing' : status === 'warn' ? 'Watch' : 'Failing';
    return '<tr class="clickable" data-class-name="' + esc(row.name) + '">' +
      '<td>' + esc(row.name) + '</td>' +
      '<td>' + progressCell(row.pass) + '</td>' +
      '<td>' + progressCell(row.critical, true) + '</td>' +
      '<td><span class="badge ' + status + '">' + esc(label) + '</span></td>' +
      '</tr>';
  }).join('');
}

function kpiTile(label, value, key) {
  return '<article class="kpi" data-kpi="' + key + '"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value ' + scoreClass(typeof value === 'number' ? value : null) + '">' + esc(value === null || value === undefined ? '-' : key === 'avgQuality' ? pct(value) : value) + '</div></article>';
}

export function renderDashboard() {
  const kpis = getKpis();
  const ranked = sourceRankedRows();
  const classRows = aggregateClassRows(activeSessionSources());
  const topSource = ranked.length ? ranked[0] : null;
  const lowestSource = ranked.length ? ranked[ranked.length - 1] : null;
  const hasData = activeSessionSubmissions().length > 0;
  const state = store.getState();
  const previewEnabled = window.MOCK_DATA_LAYER.previewCorrelation;
  const correlation = getActiveBatchCorrelationSummary();
  const donutMode = state.donutMode === 'message' ? 'message' : 'class';
  const donutTitle = donutMode === 'message' ? 'Message Pass / Fail / Skip Distribution' : 'Pass / Fail / Skip Distribution';
  const donutSubline = previewEnabled ? '<div class="section-sub" style="margin-top:6px">Preview correlation mode is ON' + (correlation ? ' for run ' + esc(correlation.runId) : '; no active batch run yet') + '</div>' : '';
  const donutModeControl = previewEnabled ? '<label class="section-sub" style="display:block;margin-top:6px">Donut mode <select id="donut-mode-select" class="select" style="max-width:220px;margin-left:8px"><option value="class" ' + (donutMode === 'class' ? 'selected' : '') + '>Class outcomes</option><option value="message" ' + (donutMode === 'message' ? 'selected' : '') + '>Message outcomes</option></select></label>' : '';
  const donutCorrelationNote = correlation ? '<div class="section-sub" id="donut-correlation-note" style="margin-top:10px">' + esc(correlation.messages) + ' messages -> ' + esc(correlation.classOutcomes) + ' class outcomes (' + esc(correlation.avgClassesPerMessage.toFixed(1)) + ' classes/message)</div>' : '';
  const sourceOverviewCard = '<section class="card table-wrap dashboard-table-card dashboard-row-card"><h3 class="dashboard-section-title">Source Overview</h3><p class="dashboard-section-sub">Compare source-level quality, critical counts, and rank at a glance.</p><table class="table" id="dashboard-source-table"><thead><tr><th>Source</th><th>Provider</th><th>Message Count</th><th>Average Score</th><th>Critical Count</th><th>Clean Count</th><th>Rank</th></tr></thead><tbody>' + renderSourceRows(ranked, true) + '</tbody></table></section>';
  const classExplorerCard = '<section class="card table-wrap dashboard-class-card dashboard-table-card dashboard-class-card--wide"><h3 class="dashboard-section-title">Data Class Explorer</h3><p class="dashboard-section-sub">Select a class to inspect pass/fail checks and remediation detail.</p>' + (!hasData ? '<p class="dashboard-section-sub" style="margin-bottom:10px;color:#94a3b8">Submit a JSON message or run a batch to populate this table.</p>' : '') + '<table class="table dense-table" id="dashboard-class-table"><thead><tr><th>Data Class</th><th>Pass %</th><th>Critical %</th><th>Status</th></tr></thead><tbody>' + renderDashboardClassRows(classRows) + '</tbody></table></section>';

  return '' +
    '<section class="view dashboard-view">' +
    '<section class="card dashboard-hero"><h2 class="section-title dashboard-main-title">Data Quality Command Center</h2><p class="section-sub dashboard-main-sub">Quality posture across sources, risk signals, and trend direction - JSON and batch data included.</p><div class="dashboard-hero-notes"><div class="hero-note"><span>Top Source</span><strong>' + esc(topSource ? topSource.source : '-') + '</strong></div><div class="hero-note"><span>Top Score</span><strong>' + esc(topSource && topSource.avgScore !== null ? pct(topSource.avgScore) : '-') + '</strong></div><div class="hero-note"><span>Needs Attention</span><strong>' + esc(lowestSource ? lowestSource.source : '-') + '</strong></div><div class="hero-note"><span>Current Score</span><strong>' + esc(lowestSource && lowestSource.avgScore !== null ? pct(lowestSource.avgScore) : '-') + '</strong></div></div></section>' +
    '<section class="kpi-grid executive-kpi-grid">' +
    kpiTile('Total Messages', kpis.totalMessages, 'totalMessages') +
    kpiTile('Average Quality Score', kpis.avgQuality, 'avgQuality') +
    kpiTile('Critical Messages', kpis.criticalMessages, 'criticalMessages') +
    kpiTile('Clean Messages', kpis.cleanMessages, 'cleanMessages') +
    kpiTile('Data Sources', kpis.dataSources, 'dataSources') +
    '</section>' +
    '<section class="dashboard-layout"><div class="dashboard-left"><article class="card chart-card dashboard-chart-card"><h3 class="dashboard-section-title">Message Quality Over Time</h3><p class="dashboard-section-sub">Track score trajectory and detect drift as new submissions arrive.</p><canvas id="chart-line-main" width="860" height="300"></canvas></article></div><aside class="dashboard-right"><article class="card chart-card chart-donut-card dashboard-chart-card"><h3 class="dashboard-section-title">' + esc(donutTitle) + '</h3><p class="dashboard-section-sub">Distribution by class outcomes - click a segment to drill down.</p>' + donutSubline + donutModeControl + '<canvas id="chart-donut-main" width="540" height="300"></canvas>' + donutCorrelationNote + '</article></aside></section>' +
    sourceOverviewCard +
    classExplorerCard +
    '</section>';
}