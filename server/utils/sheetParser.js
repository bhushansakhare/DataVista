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

// Matches "120:15:14", "1:30", "12:00" — duration written as HH:MM:SS or MM:SS.
const DURATION_RE = /^\d{1,5}:\d{2}(?::\d{2})?$/;
// Matches "95k", "1.5M", "2B", "1.2T" — suffixed magnitudes (case-insensitive).
const SUFFIX_RE = /^(-?\d+(?:[.,]\d+)?)\s*([kKmMbBtT])$/;
const SUFFIX_MULT = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9, t: 1e12, T: 1e12 };
// Matches "120 MB", "1.5GB", "5 KB" — byte units with optional space.
const BYTE_RE = /^(-?\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB|PB)$/i;
const BYTE_MULT = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 };
// Matches "50%", "12.5 %"
const PERCENT_RE = /^(-?\d+(?:[.,]\d+)?)\s*%$/;
// Matches "$50", "€1,200.50", "₹150", "£99.9"
const CURRENCY_RE = /^([$€£¥₹])\s*(-?[\d,]+(?:\.\d+)?)$/;

function durationToSeconds(s) {
  const parts = String(s).trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return NaN;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return NaN;
}

function suffixedToNumber(s) {
  const m = String(s).trim().match(SUFFIX_RE);
  if (!m) return NaN;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  return n * (SUFFIX_MULT[m[2]] || 1);
}

function bytesFromString(s) {
  const m = String(s).trim().match(BYTE_RE);
  if (!m) return NaN;
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return NaN;
  return n * (BYTE_MULT[m[2].toUpperCase()] || 1);
}

function percentFromString(s) {
  const m = String(s).trim().match(PERCENT_RE);
  if (!m) return NaN;
  return Number(m[1].replace(',', '.'));
}

function currencyFromString(s) {
  const m = String(s).trim().match(CURRENCY_RE);
  if (!m) return NaN;
  return Number(m[2].replace(/,/g, ''));
}

function isNumeric(v) {
  if (v === null || v === undefined || v === '') return false;
  const s = String(v).trim();
  if (DURATION_RE.test(s)) return Number.isFinite(durationToSeconds(s));
  if (BYTE_RE.test(s)) return Number.isFinite(bytesFromString(s));
  if (SUFFIX_RE.test(s)) return Number.isFinite(suffixedToNumber(s));
  if (PERCENT_RE.test(s)) return Number.isFinite(percentFromString(s));
  if (CURRENCY_RE.test(s)) return Number.isFinite(currencyFromString(s));
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n);
}

function isDateLike(v) {
  if (!v) return false;
  const s = String(v).trim();
  if (s.length < 4) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  // Don't let durations like "120:15:14" leak through as dates
  if (DURATION_RE.test(s)) return false;
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
        const s = String(v).trim();
        let n = NaN;
        if (DURATION_RE.test(s)) n = durationToSeconds(s);
        else if (BYTE_RE.test(s)) n = bytesFromString(s);
        else if (SUFFIX_RE.test(s)) n = suffixedToNumber(s);
        else if (PERCENT_RE.test(s)) n = percentFromString(s);
        else if (CURRENCY_RE.test(s)) n = currencyFromString(s);
        else n = Number(s.replace(/,/g, ''));
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
