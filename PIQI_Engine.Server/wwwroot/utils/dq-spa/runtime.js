export const STANDARD_USCDI_V3_CLASSES = [
  'Demographics',
  'Allergies',
  'Conditions',
  'Immunizations',
  'Lab Results',
  'Diagnostic Imaging',
  'Medications',
  'Procedures',
  'Vital Signs',
  'Medical Devices',
  'Health Assessments',
  'Clinical Documents',
  'Encounters'
];

export const RESOURCE_REGISTRY = [
  { name: 'Patient', dataClass: 'Demographics', description: 'Core patient demographics and identifiers.', fields: ['identifier', 'name', 'birthDate', 'gender'] },
  { name: 'Condition', dataClass: 'Conditions', description: 'Problems, diagnoses, and clinical conditions.', fields: ['code', 'onsetDateTime', 'clinicalStatus', 'verificationStatus'] },
  { name: 'Immunization', dataClass: 'Immunizations', description: 'Immunization events and vaccine details.', fields: ['vaccineCode', 'occurrenceDateTime', 'status', 'lotNumber'] },
  { name: 'Observation', dataClass: 'Lab Results', description: 'Clinical observations including laboratory values.', fields: ['code', 'valueQuantity', 'effectiveDateTime', 'status'] },
  { name: 'AllergyIntolerance', dataClass: 'Allergies', description: 'Allergies and intolerances for a patient.', fields: ['code', 'clinicalStatus', 'criticality', 'reaction'] },
  { name: 'MedicationRequest', dataClass: 'Medications', description: 'Medication orders and administration intent.', fields: ['medicationCodeableConcept', 'authoredOn', 'status', 'intent'] },
  { name: 'Procedure', dataClass: 'Procedures', description: 'Performed procedures and interventions.', fields: ['code', 'performedDateTime', 'status', 'performer'] },
  { name: 'Encounter', dataClass: 'Encounters', description: 'Patient encounter context and timing.', fields: ['class', 'type', 'period', 'serviceProvider'] },
  { name: 'Device', dataClass: 'Medical Devices', description: 'Implanted or used medical devices.', fields: ['type', 'udiCarrier', 'status', 'manufacturer'] },
  { name: 'DocumentReference', dataClass: 'Clinical Documents', description: 'Clinical document metadata and linkage.', fields: ['type', 'date', 'author', 'content'] },
  { name: 'Goal', dataClass: 'Health Assessments', description: 'Care goals and target outcomes.', fields: ['description', 'target', 'status', 'category'] },
  { name: 'Practitioner', dataClass: 'Demographics', description: 'Clinician identity and role context.', fields: ['identifier', 'name', 'qualification', 'telecom'] }
];

export const DEFAULT_RUBRICS = [
  { mnemonic: 'USCDI_V3', name: 'USCDI V3', status: 'Active', passThreshold: 70, description: 'United States Core Data for Interoperability version 3.', classCount: 13, ruleCount: null },
  { mnemonic: 'USCDI_V2', name: 'USCDI V2', status: 'Active', passThreshold: 70, description: 'United States Core Data for Interoperability version 2.', classCount: 13, ruleCount: null },
  { mnemonic: 'HL7_FHIR_R4', name: 'HL7 FHIR R4', status: 'Reference', passThreshold: 70, description: 'FHIR R4 interoperability conformance and profile quality checks.', classCount: 13, ruleCount: null },
  { mnemonic: 'CUSTOM', name: 'Custom Rubric', status: 'Draft', passThreshold: 70, description: 'User-defined rubric profile for local quality governance.', classCount: 13, ruleCount: null }
];

export function previewCorrelationEnabled() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.get('previewCorrelation') === '1') return true;
    return window.localStorage && window.localStorage.getItem('dq.previewCorrelation') === '1';
  } catch (_) {
    return false;
  }
}

window.MOCK_DATA_LAYER = window.MOCK_DATA_LAYER || {
  sources: [],
  submissions: [],
  rubrics: DEFAULT_RUBRICS.slice(),
  classNames: STANDARD_USCDI_V3_CLASSES.slice(),
  sessionId: null,
  sessionStartedAt: null,
  previewCorrelation: previewCorrelationEnabled(),
  activeBatchRunId: null,
  submitFormState: null
};

export function newSessionToken() {
  return 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

export function resetSessionState() {
  window.MOCK_DATA_LAYER.sources = [];
  window.MOCK_DATA_LAYER.submissions = [];
  window.MOCK_DATA_LAYER.sessionId = newSessionToken();
  window.MOCK_DATA_LAYER.sessionStartedAt = new Date().toISOString();
  window.MOCK_DATA_LAYER.activeBatchRunId = null;
}

export function activeSessionSubmissions() {
  const sid = window.MOCK_DATA_LAYER.sessionId;
  if (!sid) return window.MOCK_DATA_LAYER.submissions.slice();
  return window.MOCK_DATA_LAYER.submissions.filter(function (submission) {
    return submission.sessionId === sid;
  });
}

export function activeSessionSources() {
  const sid = window.MOCK_DATA_LAYER.sessionId;
  if (!sid) return window.MOCK_DATA_LAYER.sources.slice();
  return window.MOCK_DATA_LAYER.sources.filter(function (source) {
    return source.sessionId === sid;
  });
}

export function activeBatchRunSubmissions() {
  const runId = window.MOCK_DATA_LAYER.activeBatchRunId;
  if (!runId) return [];
  return activeSessionSubmissions().filter(function (submission) {
    return submission.batchRunId === runId;
  });
}

export function uid(prefix) {
  return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

export function generateSessionId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const len = 8;
  let id = '';
  if (window.crypto && window.crypto.getRandomValues) {
    const random = new Uint8Array(len);
    window.crypto.getRandomValues(random);
    for (let i = 0; i < len; i += 1) id += chars.charAt(random[i] % chars.length);
  } else {
    for (let i = 0; i < len; i += 1) id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function endpointBase(endpoint) {
  try {
    const url = new URL(endpoint, window.location.origin);
    return url.origin;
  } catch (_) {
    return window.location.origin;
  }
}

export function n(val) {
  const out = Number(val);
  return Number.isFinite(out) ? out : null;
}

export function pct(val) {
  if (val === null || val === undefined || Number.isNaN(val)) return '-';
  return Math.max(0, Math.min(100, Number(val))).toFixed(0) + '%';
}

export function scoreClass(score) {
  if (score === null || score === undefined) return '';
  if (score >= 70) return 'score-pass';
  if (score >= 40) return 'score-warn';
  return 'score-fail';
}

export function bucket(score) {
  if (score === null || score === undefined) return 'warn';
  if (score >= 70) return 'pass';
  if (score >= 40) return 'warn';
  return 'fail';
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function esc(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createStore(initialState) {
  const listeners = new Set();
  const state = Object.assign({}, initialState);
  return {
    getState: function () { return state; },
    setState: function (patch) {
      Object.assign(state, patch);
      listeners.forEach(function (listener) { listener(state); });
    },
    subscribe: function (listener) {
      listeners.add(listener);
      return function () { listeners.delete(listener); };
    }
  };
}

export const store = createStore({
  currentView: 'submit-message',
  selectedSourceId: null,
  selectedTab: 'classes',
  donutMode: 'class',
  sourceFilters: { provider: '', source: '', facility: '', application: '', format: '', useCase: '' }
});

export const navGroups = [
  { title: 'Overview', links: [{ id: 'dashboard', label: 'Dashboard' }, { id: 'data-sources', label: 'Data Sources' }] },
  { title: 'Analysis', links: [{ id: 'entities', label: 'Entities' }, { id: 'evaluations', label: 'Evaluations' }, { id: 'classes', label: 'Classes' }, { id: 'application', label: 'Application' }, { id: 'formats', label: 'Formats' }] },
  { title: 'Submit', links: [{ id: 'submit-message', label: 'Submit Message' }] },
  { title: 'Settings', links: [{ id: 'facilities', label: 'Facilities' }, { id: 'use-cases', label: 'Use Cases' }] }
];

export function setView(view, extraPatch) {
  store.setState(Object.assign({ currentView: view }, extraPatch || {}));
}

resetSessionState();