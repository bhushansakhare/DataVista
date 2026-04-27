import axios from 'axios';
import Papa from 'papaparse';
import crypto from 'crypto';

export function parseSheetUrl(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) throw Object.assign(new Error('Invalid Google Sheet URL'), { status: 400 });
  const sheetKey = m[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return { sheetKey, gid };
}

export function buildCsvUrl(sheetKey, gid = '0') {
  return `https://docs.google.com/spreadsheets/d/${sheetKey}/export?format=csv&gid=${gid}`;
}

export async function fetchCsv(sheetKey, gid = '0') {
  const url = buildCsvUrl(sheetKey, gid);
  const { data } = await axios.get(url, {
    responseType: 'text',
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400,
  });
  return data;
}

function isNumeric(v) {
  if (v === null || v === undefined || v === '') return false;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n);
}

function isDateLike(v) {
  if (!v) return false;
  const s = String(v).trim();
  if (s.length < 4) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

export function detectTypes(rows, columns) {
  const types = {};
  for (const col of columns) {
    let num = 0, date = 0, total = 0;
    for (const r of rows) {
      const v = r[col];
      if (v === null || v === undefined || v === '') continue;
      total++;
      if (isNumeric(v)) num++;
      else if (isDateLike(v)) date++;
    }
    if (total === 0) types[col] = 'string';
    else if (num / total >= 0.8) types[col] = 'number';
    else if (date / total >= 0.8) types[col] = 'date';
    else types[col] = 'string';
  }
  return types;
}

export function coerceRows(rows, types) {
  return rows.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v === null || v === undefined || v === '') { out[k] = null; continue; }
      if (types[k] === 'number') {
        const n = Number(String(v).replace(/,/g, ''));
        out[k] = Number.isFinite(n) ? n : null;
      } else if (types[k] === 'date') {
        const t = Date.parse(v);
        out[k] = Number.isFinite(t) ? new Date(t).toISOString() : v;
      } else {
        out[k] = String(v);
      }
    }
    return out;
  });
}

export function parseCsv(csv) {
  const result = Papa.parse(csv, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (result.errors && result.errors.length) {
    const firstFatal = result.errors.find((e) => e.type === 'Quotes' || e.type === 'FieldMismatch');
    if (firstFatal) console.warn('[csv-parse]', firstFatal);
  }
  const rows = result.data || [];
  const columns = result.meta && result.meta.fields ? result.meta.fields.filter(Boolean) : [];
  const types = detectTypes(rows, columns);
  const coerced = coerceRows(rows, types);
  return { rows: coerced, columns, types };
}

export function hashContent(s) {
  return crypto.createHash('sha1').update(s || '').digest('hex');
}
