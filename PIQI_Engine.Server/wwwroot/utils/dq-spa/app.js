import { activeSessionSources, activeSessionSubmissions, navGroups, resetSessionState, setView, store } from './runtime.js';
import { filteredSources, getPassFailSkip } from './data-model.js';
import { renderDashboard } from './dashboard-view.js?v=4';
import { drawDonutChart } from './charts-donut.js';
import { drawGaugeChart } from './charts-gauge-bar.js';
import { drawLineChart } from './charts-line.js';
import { renderEntities, renderEvaluations, renderApplication, renderClasses, renderFacilities, renderFormats, renderUseCases } from './misc-views.js';
import { renderSourceDetails } from './source-details-view.js';
import { renderSourceReview } from './source-review-view.js';
import { renderSubmitMessage } from './submit-view.js?v=9';
import { wireDashboardView, wireEntitiesView, wireEvaluationsView, wireSourceDetailsView, wireSourceReviewView } from './view-events.js?v=4';

function getPreviewProfessionalEnabled() {
  const params = new URLSearchParams(window.location.search || '');
  const param = (params.get('preview') || '').toLowerCase();
  if (param === 'pro' || param === 'professional') return true;
  if (param === 'off' || param === 'default') return false;
  return true;
}

function setPreviewProfessionalEnabled(enabled) {
  document.body.classList.toggle('preview-professional', enabled);
}

function getColorHierarchyPreviewEnabled() {
  const params = new URLSearchParams(window.location.search || '');
  const value = (params.get('colorPreview') || params.get('navColorPreview') || '').toLowerCase();
  return value === '1' || value === 'true' || value === 'on' || value === 'yes';
}

function setColorHierarchyPreviewEnabled(enabled) {
  document.body.classList.toggle('preview-nav-colors', enabled);
}

function activeTopNavId(view) {
  if (view === 'submit-message') return 'submit-message';
  if (view === 'source-review' || view === 'data-sources' || view === 'source-details') return 'source-review';
  return 'dashboard';
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  const state = store.getState();
  sidebar.innerHTML = navGroups.map(function (group) {
    return '<section class="sidebar-group"><h4>' + group.title + '</h4>' + group.links.map(function (link) { return '<button class="side-link ' + (state.currentView === link.id ? 'active' : '') + '" data-go="' + link.id + '">' + link.label + '</button>'; }).join('') + '</section>';
  }).join('');
  sidebar.querySelectorAll('[data-go]').forEach(function (btn) { btn.addEventListener('click', function () { setView(btn.getAttribute('data-go') === 'data-sources' ? 'source-review' : btn.getAttribute('data-go')); }); });
}

function renderTopLinks() {
  const current = activeTopNavId(store.getState().currentView);
  document.querySelectorAll('[data-nav]').forEach(function (btn) {
    const id = btn.getAttribute('data-nav');
    const isActive = id === current;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('data-active', isActive ? 'true' : 'false');
    if (isActive) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
    btn.onclick = function () { setView(id); };
  });
}

function drawViewCharts(view) {
  if (view === 'dashboard') setTimeout(function () { drawLineChart('chart-line-main', activeSessionSubmissions().map(function (submission) { return { t: submission.createdAt, score: submission.score, source: submission.source, provider: submission.provider, criticalCount: submission.criticalCount, cleanCount: submission.cleanCount, classRows: submission.classRows }; })); drawDonutChart('chart-donut-main', getPassFailSkip(store.getState().donutMode)); }, 8);
  if (view === 'source-review' || view === 'data-sources') setTimeout(function () { const points = []; filteredSources(store.getState().sourceFilters).forEach(function (source) { (source.history || []).forEach(function (point) { points.push({ t: point.t, score: point.score }); }); }); drawLineChart('chart-line-review', points); drawDonutChart('chart-donut-review', getPassFailSkip(store.getState().donutMode)); }, 8);
  if (view === 'source-details') setTimeout(function () { const source = activeSessionSources().find(function (item) { return item.id === store.getState().selectedSourceId; }); drawGaugeChart('chart-gauge-source', source && source.avgScore !== null ? source.avgScore : null); drawLineChart('chart-line-source', source ? source.history.map(function (point) { return { t: point.t, score: point.score }; }) : []); }, 8);
}

function wireViewEvents(view) {
  if (view === 'submit-message') return import('./submit-view.js?v=9').then(function (m) { m.wireSubmitView(); });
  if (view === 'dashboard') wireDashboardView();
  if (view === 'source-review' || view === 'data-sources') wireSourceReviewView();
  if (view === 'source-details') wireSourceDetailsView();
  if (view === 'entities') wireEntitiesView();
  if (view === 'evaluations') wireEvaluationsView();
  return Promise.resolve();
}

async function renderCurrentView() {
  const main = document.getElementById('main');
  const audit = document.getElementById('submit-audit-container');
  const view = store.getState().currentView;
  main.innerHTML = view === 'dashboard' ? renderDashboard() : view === 'submit-message' ? renderSubmitMessage() : view === 'source-review' || view === 'data-sources' ? renderSourceReview() : view === 'source-details' ? renderSourceDetails() : view === 'entities' ? renderEntities() : view === 'evaluations' ? renderEvaluations() : view === 'classes' ? renderClasses() : view === 'application' ? renderApplication() : view === 'formats' ? renderFormats() : view === 'facilities' ? renderFacilities() : view === 'use-cases' ? renderUseCases() : '<section class="card"><h2 class="section-title">View not found</h2></section>';
  if (view !== 'submit-message' && audit) {
    audit.innerHTML = '';
    audit.style.display = 'none';
  }
  await wireViewEvents(view);
  drawViewCharts(view);
}

export async function renderAll() { renderSidebar(); renderTopLinks(); await renderCurrentView(); }

function showFatalLoadError(message) {
  const loader = document.getElementById('app-loader');
  const app = document.getElementById('app');
  if (loader) loader.classList.add('hidden');
  if (app) {
    app.classList.remove('hidden');
    app.innerHTML = '<section class="card" style="margin:16px"><h2 class="section-title">Unable to load Data Quality SPA</h2><p class="section-sub">A client-side initialization error occurred.</p><pre style="white-space:pre-wrap;overflow:auto;max-height:320px">' + String(message || 'Unknown error').replace(/[<>&]/g, function (char) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[char]; }) + '</pre></section>';
  }
}

export function initializeApp() {
  window.__dqSpa = { renderAll: renderAll };
  window.addEventListener('error', function (evt) {
    const message = evt && evt.error && evt.error.stack ? evt.error.stack : evt && evt.message ? evt.message : 'Unknown runtime error';
    if (document.getElementById('app-loader') && !document.getElementById('app-loader').classList.contains('hidden')) showFatalLoadError(message);
  });
  store.subscribe(function () { renderAll(); });
  try {
    setPreviewProfessionalEnabled(getPreviewProfessionalEnabled());
    setColorHierarchyPreviewEnabled(getColorHierarchyPreviewEnabled());
    resetSessionState();
    renderAll();
    setTimeout(function () {
      const loader = document.getElementById('app-loader');
      const app = document.getElementById('app');
      if (loader) loader.classList.add('hidden');
      if (app) app.classList.remove('hidden');
      setView('submit-message');
    }, 450);
  } catch (err) {
    showFatalLoadError(err && err.stack ? err.stack : String(err));
  }
}