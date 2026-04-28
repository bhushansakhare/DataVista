// Classifies every column of a sheet into a usable role for charting:
//  - numeric  → Y-axis candidates
//  - date     → X-axis time-series candidate
//  - category → low-cardinality string, good for X / group-by
//  - text     → high-cardinality string (names, titles) — keep for filters
//  - id       → numeric or text identifier — never useful as Y-axis
//  - url      → http(s) link — never useful in any axis

const URL_RE = /^https?:\/\//i;
const ID_NAME_RE = /^(id|sr\.?\s*no\.?|sno|s\.?no\.?|#|index|row[\s_]?id|uuid)$/i;
const ID_NAME_HINT_RE = /\b(id|sr\.?\s*no\.?|index|uuid)\b/i;

function nonEmpty(values) {
  return values.filter((v) => v !== null && v !== undefined && v !== '');
}

function isUrlColumn(values) {
  if (!values.length) return false;
  let hits = 0;
  for (const v of values) {
    if (typeof v === 'string' && URL_RE.test(v.trim())) hits++;
  }
  return hits / values.length >= 0.5;
}

function isIdColumn(name, values) {
  if (ID_NAME_RE.test(name)) return true;
  // High-uniqueness numeric / text → very likely an identifier
  const set = new Set(values.map(String));
  if (values.length >= 6 && set.size === values.length) return true;
  // Name hints + monotonic increase
  if (ID_NAME_HINT_RE.test(name) && values.length >= 4) {
    const nums = values.map((v) => Number(v)).filter(Number.isFinite);
    if (nums.length >= values.length * 0.9) {
      let monotonic = true;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] < nums[i - 1]) { monotonic = false; break; }
      }
      if (monotonic) return true;
    }
  }
  return false;
}

export function analyzeSheet(sheet) {
  const types = sheet?.detectedTypes || {};
  const allCols = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const selected =
    Array.isArray(sheet?.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : allCols;
  const cols = allCols.filter((c) => selected.includes(c));
  const rows = Array.isArray(sheet?.rawData) ? sheet.rawData : [];

  const out = {
    numeric: [],   // { name, count, sum, range }
    date: [],      // { name, count, span }
    category: [],  // { name, cardinality, count }
    text: [],      // { name, cardinality, count }
    id: [],        // { name }
    url: [],       // { name }
  };

  for (const c of cols) {
    const t = types[c] || 'string';
    const sample = nonEmpty(rows.slice(0, 200).map((r) => r[c]));

    if (isUrlColumn(sample)) { out.url.push({ name: c }); continue; }

    if (t === 'date') {
      const ts = sample.map((v) => Date.parse(v)).filter(Number.isFinite);
      const span = ts.length ? Math.max(...ts) - Math.min(...ts) : 0;
      out.date.push({ name: c, count: ts.length, span });
      continue;
    }

    if (t === 'number') {
      if (isIdColumn(c, sample)) { out.id.push({ name: c }); continue; }
      const nums = sample.map((v) => Number(v)).filter(Number.isFinite);
      const sum = nums.reduce((a, b) => a + b, 0);
      const max = nums.length ? Math.max(...nums) : 0;
      const min = nums.length ? Math.min(...nums) : 0;
      out.numeric.push({ name: c, count: nums.length, sum, range: max - min });
      continue;
    }

    // string
    if (isIdColumn(c, sample)) { out.id.push({ name: c }); continue; }
    const set = new Set(sample.map(String));
    const cardinality = set.size;
    if (cardinality >= 2 && cardinality <= 30 && cardinality / Math.max(sample.length, 1) < 0.6) {
      out.category.push({ name: c, cardinality, count: sample.length });
    } else {
      out.text.push({ name: c, cardinality, count: sample.length });
    }
  }

  // Rank: numeric by total magnitude, date by span, category by closeness to ideal cardinality (~6)
  out.numeric.sort((a, b) => Math.abs(b.sum) + b.range - (Math.abs(a.sum) + a.range));
  out.date.sort((a, b) => b.span - a.span);
  out.category.sort((a, b) => Math.abs(a.cardinality - 6) - Math.abs(b.cardinality - 6));

  return out;
}

/**
 * Returns the list of columns the chart editor should show in each role.
 * URLs are excluded from every axis. IDs are excluded from Y-axis.
 */
export function getAxisCandidates(sheet) {
  const a = analyzeSheet(sheet);
  const urlSet = new Set(a.url.map((c) => c.name));
  const idSet = new Set(a.id.map((c) => c.name));
  const allCols = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const selected =
    Array.isArray(sheet?.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : allCols;
  const visible = allCols.filter((c) => selected.includes(c) && !urlSet.has(c));
  const types = sheet?.detectedTypes || {};

  return {
    insights: a,
    xCandidates: visible,
    yCandidates: visible.filter((c) => types[c] === 'number' && !idSet.has(c)),
    groupCandidates: visible.filter((c) => !idSet.has(c)),
    excluded: { urls: a.url.map((c) => c.name), ids: a.id.map((c) => c.name) },
  };
}
