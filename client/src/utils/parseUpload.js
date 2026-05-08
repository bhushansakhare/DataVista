// Client-side parsers for the AI Assistant's file uploads. CSV via papaparse,
// XLSX via SheetJS. Returns row objects matching the shape every other
// downstream component expects ([{col1: val, col2: val}, ...]).

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const CSV_RE = /\.csv$/i;
const XLSX_RE = /\.xlsx?$/i;

/**
 * Replace empty/blank/__EMPTY* column headers with deterministic placeholder
 * names ("Column_1", "Column_2", …). xlsx and Papa emit `__EMPTY*` when a
 * header row has blank cells — those names should never reach the AI or
 * the UI. Returns { columns, rename } where `rename` maps each ORIGINAL
 * header to its cleaned name.
 */
function cleanColumns(rawColumns) {
  const seen = new Map();
  const columns = [];
  const rename = {};
  rawColumns.forEach((raw, i) => {
    const original = String(raw ?? '').trim();
    const isEmpty = !original || /^__EMPTY(?:_\d+)?$/i.test(original);
    let name = isEmpty ? `Column_${i + 1}` : original;
    if (seen.has(name)) {
      const n = seen.get(name) + 1;
      seen.set(name, n);
      name = `${name}_${n}`;
    } else {
      seen.set(name, 1);
    }
    columns.push(name);
    rename[raw] = name;
  });
  return { columns, rename };
}

function renameRowKeys(rows, rename) {
  if (!rows || rows.length === 0) return rows;
  return rows.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) {
      const newKey = Object.prototype.hasOwnProperty.call(rename, k) ? rename[k] : k;
      out[newKey] = row[k];
    }
    return out;
  });
}

/** Detect a Google Sheets URL — used to route input to the right pipeline. */
export function isGoogleSheetUrl(s) {
  if (typeof s !== 'string') return false;
  return /docs\.google\.com\/spreadsheets/i.test(s);
}

/**
 * Parse a CSV / XLSX File into row objects.
 * @returns {Promise<{ rows: Array<Object>, columns: string[] }>}
 */
export async function parseFile(file) {
  if (!file) throw new Error('No file provided');
  if (CSV_RE.test(file.name)) return parseCsv(file);
  if (XLSX_RE.test(file.name)) return parseXlsx(file);
  throw new Error(`Unsupported file type: ${file.name}. Use .csv, .xls, or .xlsx`);
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results) => {
        const rawRows = (results.data || []).filter((r) => r && Object.keys(r).length > 0);
        const rawColumns = (results.meta?.fields || []).filter(Boolean);
        const { columns, rename } = cleanColumns(rawColumns);
        const rows = renameRowKeys(rawRows, rename);
        resolve({ rows, columns });
      },
      error: (err) => reject(err),
    });
  });
}

async function parseXlsx(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets');
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const rawColumns = rawRows[0] ? Object.keys(rawRows[0]) : [];
  const { columns, rename } = cleanColumns(rawColumns);
  const rows = renameRowKeys(rawRows, rename);
  return { rows, columns };
}

/** Build a synthetic sheet object compatible with downstream components. */
export function buildEphemeralSheet({ title, rows, columns, sheetUrl = '' }) {
  return {
    _id: `eph-${Date.now().toString(36)}`,
    title,
    sheetUrl,
    rawData: rows,
    columns,
    selectedColumns: columns,
    detectedTypes: detectTypes(rows, columns),
    rowCount: rows.length,
  };
}

function detectTypes(rows, columns) {
  const types = {};
  for (const col of columns) {
    let num = 0, date = 0, total = 0;
    for (let i = 0; i < rows.length && total < 80; i++) {
      const v = rows[i]?.[col];
      if (v === null || v === undefined || v === '') continue;
      total++;
      const s = String(v).trim();
      if (Number.isFinite(Number(s.replace(/,/g, '')))) num++;
      else if (Number.isFinite(Date.parse(s)) && s.length >= 4 && !/^\d+(\.\d+)?$/.test(s)) date++;
    }
    if (total === 0) types[col] = 'string';
    else if (num / total >= 0.8) types[col] = 'number';
    else if (date / total >= 0.8) types[col] = 'date';
    else types[col] = 'string';
  }
  return types;
}
