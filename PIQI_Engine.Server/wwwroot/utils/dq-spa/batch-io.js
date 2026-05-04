import { n } from './runtime.js';
import { classRowsFromResult } from './data-model.js';

export const BATCH_COLUMN_MAP = {
  UniqueID: 'UniqueID',
  LongAccessionNumberUID: 'LongAccessionNumberUID',
  LabChemTestSID: 'LabChemTestSID',
  LabChemTestName: 'LabChemTestName',
  LabChemTestUrgencySID: 'LabChemTestUrgencySID',
  Urgency: 'Urgency',
  LabChemResultValue: 'LabChemResultValue',
  LabChemResultNumericValue: 'LabChemResultNumericValue',
  TopographySID: 'TopographySID',
  Topography: 'Topography',
  AccessionInstitutionSID: 'AccessionInstitutionSID',
  AccessioningInstitution: 'AccessioningInstitution',
  OrderingInstitutionSID: 'OrderingInstitutionSID',
  OrderingInstutionName: 'OrderingInstutionName',
  CollectingInstitutionSID: 'CollectingInstitutionSID',
  CollectingInstitutionName: 'CollectingInstitutionName',
  LOINCSID: 'LOINCSID',
  LOINC: 'LOINC',
  Units: 'Units',
  Abnormal: 'Abnormal',
  RefHigh: 'RefHigh',
  RefLow: 'RefLow'
};

export async function parseBatchFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcelFile(file);
  if (name.endsWith('.csv')) return parseCSVFile(file);
  throw new Error('Unsupported file type. Use .xlsx, .xls, or .csv.');
}

function parseExcelFile(file) {
  if (typeof XLSX === 'undefined') throw new Error('Missing XLSX library. Ensure the spreadsheet script is loaded.');
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rows.length < 2) throw new Error('Excel file must contain header row and at least one data row.');
        const headers = rows[0].map(function (header) { return String(header || '').trim(); });
        const parsedRows = [];
        for (let i = 1; i < rows.length; i += 1) {
          const values = rows[i] || [];
          if (values.every(function (cell) { return cell === undefined || cell === null || String(cell).trim() === ''; })) continue;
          const row = {};
          headers.forEach(function (header, index) { row[header] = values[index] !== undefined ? values[index] : ''; });
          parsedRows.push(row);
        }
        resolve(parsedRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = function () { reject(new Error('Unable to read Excel file.')); };
    reader.readAsArrayBuffer(file);
  });
}

function parseCSVFile(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const text = String(e.target.result || '');
        const lines = text.split(/\r?\n/).filter(function (line) { return line.trim(); });
        if (lines.length < 2) throw new Error('CSV file must contain header row and at least one data row.');
        const headers = parseCSVLine(lines[0]).map(function (header) { return header.trim(); });
        const parsedRows = [];
        for (let i = 1; i < lines.length; i += 1) {
          const values = parseCSVLine(lines[i]).map(function (value) { return value.trim(); });
          const row = {};
          headers.forEach(function (header, index) { row[header] = values[index] !== undefined ? values[index] : ''; });
          parsedRows.push(row);
        }
        resolve(parsedRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = function () { reject(new Error('Unable to read CSV file.')); };
    reader.readAsText(file);
  });
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

function normalizeBatchCell(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function getBatchColumnValue(row, key) { return normalizeBatchCell(row && row[BATCH_COLUMN_MAP[key]]); }

export function buildBatchRowRequest(row, rowNum, provider, source, model, rubric) {
  const fallbackId = row.messageID || row.messageId || row.UniqueID || row.ID || 'row-' + rowNum;
  const messageData = convertBatchSpreadsheetRowToMessageData(row, provider, source, fallbackId);
  const messageId = messageData.messageID || messageData.messageId || fallbackId;
  return { dataProviderID: provider, dataSourceID: source, messageID: messageId, piqiModelMnemonic: model, evaluationRubricMnemonic: rubric, messageData: JSON.stringify(messageData) };
}

function convertBatchSpreadsheetRowToMessageData(row, provider, source, fallbackId) {
  const uniqueID = getBatchColumnValue(row, 'UniqueID') || fallbackId;
  const unitsValue = getBatchColumnValue(row, 'Units');
  const testName = getBatchColumnValue(row, 'LabChemTestName');
  const loincCode = getBatchColumnValue(row, 'LOINC');
  const refLow = getBatchColumnValue(row, 'RefLow');
  const refHigh = getBatchColumnValue(row, 'RefHigh');
  const abnormal = getBatchColumnValue(row, 'Abnormal');
  const labResult = {
    test: { codings: [], text: testName },
    referenceRange: {},
    resultValue: { text: getBatchColumnValue(row, 'LabChemResultValue'), type: { text: 'PQ' } },
    resultUnit: { codings: unitsValue ? [{ code: unitsValue, display: unitsValue, system: 'UCUM' }] : [], text: unitsValue }
  };
  if (loincCode) labResult.test.codings.push({ code: loincCode, display: testName, system: '2.16.840.1.113883.6.1' });
  if (refLow) labResult.referenceRange.lowValue = refLow;
  if (refHigh) labResult.referenceRange.highValue = refHigh;
  labResult.interpretation = abnormal ? { codings: [{ code: abnormal, system: '2.16.840.1.113883.5.83' }], text: abnormal } : { codings: [{ code: 'N', system: '2.16.840.1.113883.5.83' }], text: 'N' };
  return { messageId: uniqueID, formatID: '', useCaseID: '', patient: { labResults: [labResult], id: uniqueID }, dataSourceID: source, dataProviderID: provider, messageID: uniqueID };
}

export function extractBatchScore(payload) {
  if (!payload || !payload.scoringData || !payload.scoringData.messageResults) return null;
  const score = n(payload.scoringData.messageResults.piqiScore);
  return score === null ? null : Math.round(score);
}

export function createEmptyBatchBreakdown() { return { pass: 0, fail: 0, skip: 0 }; }

export function summarizeAssessmentStatuses(assessments) {
  return (assessments || []).reduce(function (acc, assessment) {
    const status = String(assessment && assessment.status || '').toLowerCase();
    if (status === 'passed') acc.pass += 1;
    else if (status === 'failed') acc.fail += 1;
    else acc.skip += 1;
    return acc;
  }, createEmptyBatchBreakdown());
}

export function buildBatchMeta(runId, runStartedAt, processed, total, succeeded) {
  const elapsedMs = Math.max(Date.now() - runStartedAt, 0);
  const elapsedSeconds = elapsedMs / 1000;
  const rate = processed > 0 && elapsedSeconds > 0 ? (processed / elapsedSeconds).toFixed(2) : '0.00';
  const successRate = processed > 0 ? Math.round((succeeded / processed) * 100) : 0;
  return { runId: runId, elapsed: elapsedSeconds >= 1 ? elapsedSeconds.toFixed(1) + 's' : elapsedMs + 'ms', rate: rate + ' rows/sec', successRate: String(successRate) + '%', processedLabel: String(processed) + ' of ' + String(total) + ' rows processed' };
}

export function extractClassOutcomeBreakdown(payload) {
  const rows = classRowsFromResult(payload && payload.scoringData && payload.scoringData.dataClassResults || []);
  return rows.reduce(function (acc, row) {
    if (!row.denominator) acc.skip += 1;
    else if (row.score >= 70) acc.pass += 1;
    else acc.fail += 1;
    return acc;
  }, { pass: 0, fail: 0, skip: 0 });
}