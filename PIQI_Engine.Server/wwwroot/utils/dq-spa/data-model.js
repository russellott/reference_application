import {
  STANDARD_USCDI_V3_CLASSES,
  activeBatchRunSubmissions,
  activeSessionSources,
  activeSessionSubmissions,
  n,
  uid
} from './runtime.js';

export function classRowsFromResult(dataClassResults) {
  const map = new Map();
  (dataClassResults || []).forEach(function (row) {
    map.set(row.dataClassName, {
      dataClassName: row.dataClassName,
      score: n(row.piqiScore),
      numerator: n(row.numerator) || 0,
      denominator: n(row.denominator) || 0,
      critical: n(row.criticalFailureCount) || 0,
      clean: n(row.cleanCount) || 0,
      instanceCount: n(row.instanceCount) || 0,
      raw: row
    });
  });

  return STANDARD_USCDI_V3_CLASSES.map(function (name) {
    return map.get(name) || {
      dataClassName: name,
      score: null,
      numerator: 0,
      denominator: 0,
      critical: 0,
      clean: 0,
      instanceCount: 0,
      raw: null
    };
  });
}

export function ingestApiResponse(requestMeta, responseData) {
  const msg = responseData && responseData.scoringData && responseData.scoringData.messageResults || {};
  const classRows = classRowsFromResult(responseData && responseData.scoringData && responseData.scoringData.dataClassResults || []);
  const score = n(msg.piqiScore);
  const numerator = n(msg.numerator) || 0;
  const denominator = n(msg.denominator) || 0;
  const critical = n(msg.criticalFailureCount) || classRows.reduce(function (sum, row) {
    return sum + (row.critical || 0);
  }, 0);

  const submission = {
    id: uid('sub'),
    sessionId: window.MOCK_DATA_LAYER.sessionId,
    batchRunId: requestMeta.batchRunId || null,
    createdAt: new Date().toISOString(),
    provider: requestMeta.provider,
    source: requestMeta.source,
    facility: requestMeta.facility,
    application: requestMeta.application,
    format: requestMeta.format,
    useCase: requestMeta.useCase,
    endpoint: requestMeta.endpoint,
    model: requestMeta.model,
    rubric: requestMeta.rubric,
    score: score,
    numerator: numerator,
    denominator: denominator,
    critical: critical,
    classRows: classRows,
    responseRaw: responseData
  };

  window.MOCK_DATA_LAYER.submissions.push(submission);
  const sourceKey = requestMeta.provider + '|' + requestMeta.source;
  const sid = window.MOCK_DATA_LAYER.sessionId;
  let source = window.MOCK_DATA_LAYER.sources.find(function (item) {
    return item.key === sourceKey && item.sessionId === sid;
  });

  if (!source) {
    source = {
      id: uid('src'),
      sessionId: sid,
      key: sourceKey,
      provider: requestMeta.provider,
      source: requestMeta.source,
      facility: requestMeta.facility,
      application: requestMeta.application,
      format: requestMeta.format,
      useCase: requestMeta.useCase,
      history: [],
      classRows: classRows,
      messageCount: 0,
      avgScore: null,
      criticalCount: 0,
      cleanCount: 0,
      lastSubmissionId: null,
      lastRaw: null
    };
    window.MOCK_DATA_LAYER.sources.push(source);
  }

  source.messageCount += 1;
  source.history.push({ t: submission.createdAt, score: score });
  source.lastSubmissionId = submission.id;
  source.lastRaw = responseData;
  source.classRows = classRows;

  const sourceSubs = window.MOCK_DATA_LAYER.submissions.filter(function (item) {
    return item.sessionId === sid && (item.provider + '|' + item.source) === sourceKey;
  });
  const scoreVals = sourceSubs.map(function (item) { return item.score; }).filter(function (value) { return value !== null; });
  source.avgScore = scoreVals.length ? scoreVals.reduce(function (sum, value) { return sum + value; }, 0) / scoreVals.length : null;
  source.criticalCount = sourceSubs.filter(function (item) { return item.critical > 0; }).length;
  source.cleanCount = sourceSubs.filter(function (item) {
    return (item.critical || 0) === 0 && (item.score || 0) >= 70;
  }).length;

  return source;
}

export function getKpis() {
  const submissions = activeSessionSubmissions();
  const sources = activeSessionSources();
  const scores = submissions.map(function (item) { return item.score; }).filter(function (value) { return value !== null; });
  return {
    totalMessages: submissions.length || null,
    avgQuality: scores.length ? scores.reduce(function (sum, value) { return sum + value; }, 0) / scores.length : null,
    criticalMessages: submissions.length ? submissions.filter(function (item) { return item.critical > 0; }).length : null,
    cleanMessages: submissions.length ? submissions.filter(function (item) {
      return (item.critical || 0) === 0 && (item.score || 0) >= 70;
    }).length : null,
    dataSources: sources.length || null
  };
}

export function getPassFailSkip(mode) {
  const chartMode = mode === 'message' ? 'message' : 'class';
  const scoped = window.MOCK_DATA_LAYER.previewCorrelation && window.MOCK_DATA_LAYER.activeBatchRunId
    ? activeBatchRunSubmissions()
    : activeSessionSubmissions();
  let pass = 0;
  let fail = 0;
  let skip = 0;
  if (!scoped.length) return { pass: pass, fail: fail, skip: skip };

  if (chartMode === 'message') {
    scoped.forEach(function (submission) {
      if (submission.score === null || submission.score === undefined) skip += 1;
      else if (submission.score >= 70) pass += 1;
      else fail += 1;
    });
    return { pass: pass, fail: fail, skip: skip };
  }

  const classRows = [];
  if (window.MOCK_DATA_LAYER.previewCorrelation && window.MOCK_DATA_LAYER.activeBatchRunId) {
    scoped.forEach(function (submission) {
      (submission.classRows || []).forEach(function (row) { classRows.push(row); });
    });
  } else {
    const latest = scoped.reduce(function (acc, submission) {
      if (!acc) return submission;
      return new Date(submission.createdAt).getTime() >= new Date(acc.createdAt).getTime() ? submission : acc;
    }, null);
    (latest && latest.classRows || []).forEach(function (row) { classRows.push(row); });
  }

  classRows.forEach(function (row) {
    if (!row.denominator) skip += 1;
    else if (row.score >= 70) pass += 1;
    else fail += 1;
  });
  return { pass: pass, fail: fail, skip: skip };
}

export function getActiveBatchCorrelationSummary() {
  if (!window.MOCK_DATA_LAYER.previewCorrelation || !window.MOCK_DATA_LAYER.activeBatchRunId) return null;
  const runSubs = activeBatchRunSubmissions();
  if (!runSubs.length) {
    return { runId: window.MOCK_DATA_LAYER.activeBatchRunId, messages: 0, classOutcomes: 0, avgClassesPerMessage: 0, classBreakdown: { pass: 0, fail: 0, skip: 0 } };
  }

  const classBreakdown = getPassFailSkip('class');
  const classOutcomes = classBreakdown.pass + classBreakdown.fail + classBreakdown.skip;
  return {
    runId: window.MOCK_DATA_LAYER.activeBatchRunId,
    messages: runSubs.length,
    classOutcomes: classOutcomes,
    avgClassesPerMessage: classOutcomes / runSubs.length,
    classBreakdown: classBreakdown
  };
}

export function sourceRankedRows() {
  const rows = activeSessionSources();
  rows.sort(function (left, right) {
    const a = left.avgScore === null ? -1 : left.avgScore;
    const b = right.avgScore === null ? -1 : right.avgScore;
    return b - a;
  });
  return rows.map(function (row, index) {
    return Object.assign({ rank: index + 1 }, row);
  });
}

export function filteredSources(filters) {
  return activeSessionSources().filter(function (source) {
    return (!filters.provider || source.provider === filters.provider) &&
      (!filters.source || source.source === filters.source) &&
      (!filters.facility || source.facility === filters.facility) &&
      (!filters.application || source.application === filters.application) &&
      (!filters.format || source.format === filters.format) &&
      (!filters.useCase || source.useCase === filters.useCase);
  });
}

export function sourceFilterOptions() {
  const sources = activeSessionSources();
  function build(key) {
    return Array.from(new Set(sources.map(function (source) { return source[key]; }).filter(Boolean))).sort();
  }
  return {
    provider: build('provider'),
    source: build('source'),
    facility: build('facility'),
    application: build('application'),
    format: build('format'),
    useCase: build('useCase')
  };
}

export function aggregateClassRows(sources) {
  const map = new Map();
  STANDARD_USCDI_V3_CLASSES.forEach(function (name) {
    map.set(name, { name: name, pass: null, critical: null, clean: null, score: null, rows: [] });
  });
  sources.forEach(function (source) {
    (source.classRows || []).forEach(function (row) {
      if (map.has(row.dataClassName)) map.get(row.dataClassName).rows.push(row);
    });
  });

  map.forEach(function (item) {
    if (!item.rows.length) return;
    const denom = item.rows.reduce(function (sum, row) { return sum + (row.denominator || 0); }, 0);
    const num = item.rows.reduce(function (sum, row) { return sum + (row.numerator || 0); }, 0);
    const critical = item.rows.reduce(function (sum, row) { return sum + (row.critical || 0); }, 0);
    const clean = item.rows.reduce(function (sum, row) { return sum + (row.clean || 0); }, 0);
    item.pass = denom ? (num / denom) * 100 : null;
    item.critical = denom ? (critical / denom) * 100 : null;
    item.clean = denom ? (clean / denom) * 100 : null;
    item.score = item.pass;
  });

  return Array.from(map.values());
}