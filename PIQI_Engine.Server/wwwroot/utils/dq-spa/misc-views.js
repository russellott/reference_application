import { DEFAULT_RUBRICS, RESOURCE_REGISTRY, STANDARD_USCDI_V3_CLASSES, esc } from './runtime.js';

export function renderEntities() {
  return '' +
    '<section class="view"><section class="card"><h2 class="section-title">FHIR Entity Registry</h2><p class="section-sub">Resource types mapped to PIQI classes. Click any row for full field descriptions.</p></section><section class="card table-wrap"><table class="table" id="entity-table"><thead><tr><th>Resource</th><th>Mapped Data Class</th><th>Description</th></tr></thead><tbody>' + RESOURCE_REGISTRY.map(function (resource, index) {
      return '<tr class="clickable" data-entity-index="' + index + '"><td>' + esc(resource.name) + '</td><td>' + esc(resource.dataClass) + '</td><td>' + esc(resource.description) + '</td></tr>';
    }).join('') + '</tbody></table></section></section>';
}

export function renderEvaluations() {
  const cards = window.MOCK_DATA_LAYER.rubrics.map(function (rubric, index) {
    return '<article class="card clickable" data-rubric-index="' + index + '"><h3 style="margin-top:0">' + esc(rubric.name) + '</h3><div><span class="badge ' + (rubric.status === 'Active' ? 'pass' : rubric.status === 'Draft' ? 'warn' : 'fail') + '">' + esc(rubric.status) + '</span></div><div class="stat-row"><span>Data Classes</span><strong>' + esc(rubric.classCount === null ? '-' : rubric.classCount) + '</strong></div><div class="stat-row"><span>Rules</span><strong>' + esc(rubric.ruleCount === null ? '-' : rubric.ruleCount) + '</strong></div></article>';
  }).join('');
  return '<section class="view"><section class="card"><h2 class="section-title">Evaluations</h2><p class="section-sub">Rubric library and scoring standards.</p><div class="actions"><button class="btn primary" id="new-eval-btn">New Evaluation</button></div></section><section class="chart-grid">' + cards + '</section></section>';
}

export function renderClasses() {
  return '<section class="view"><section class="card"><h2 class="section-title">Classes</h2><p class="section-sub">Class-level overview of structural PIQI categories.</p></section><section class="card table-wrap"><table class="table"><thead><tr><th>Class</th><th>Status</th></tr></thead><tbody>' + STANDARD_USCDI_V3_CLASSES.map(function (className) {
    return '<tr><td>' + esc(className) + '</td><td><span class="badge warn">Structural</span></td></tr>';
  }).join('') + '</tbody></table></section></section>';
}

export function renderDataSources() { return null; }

export function renderApplication() {
  return '<section class="view"><section class="card"><h2 class="section-title">Application</h2><p class="section-sub">Application-level metadata appears as sources are submitted.</p></section></section>';
}

export function renderFormats() {
  return '<section class="view"><section class="card"><h2 class="section-title">Formats</h2><p class="section-sub">Message format metrics populate from source submissions.</p></section></section>';
}

export function renderFacilities() {
  return '<section class="view"><section class="card"><h2 class="section-title">Facilities</h2><p class="section-sub">Facility-level reporting is data-driven and currently uses submitted source metadata.</p></section></section>';
}

export function renderUseCases() {
  return '<section class="view"><section class="card"><h2 class="section-title">Use Cases</h2><p class="section-sub">Use-case reporting is populated by source submission metadata.</p></section></section>';
}

export function ensureRubrics() {
  if (!Array.isArray(window.MOCK_DATA_LAYER.rubrics) || !window.MOCK_DATA_LAYER.rubrics.length) {
    window.MOCK_DATA_LAYER.rubrics = DEFAULT_RUBRICS.slice();
  }
}