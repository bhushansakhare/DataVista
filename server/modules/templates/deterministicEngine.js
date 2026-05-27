// Deterministic dashboard data engine.
//
// Takes a sheet's rows and produces KPIs, charts, and a table — WITHOUT AI.
// This is the safety net: even if the AI returns the original template or
// fails entirely, the values computed here are always available to inject.
//
// Detects column types (numeric / date / categorical / text), then derives:
//   - KPIs: total rows, total of primary numeric, average of primary numeric,
//           distinct count of primary categorical.
//   - Charts: line (date or index vs count), bar (top category vs sum/count),
//             donut (category share-of-total), fallback (row index vs count).
//   - Table: first N real rows of the dataset.

const NUM_DURATION_RE = /^\d{1,5}:\d{2}(?::\d{2})?$/;
const NUM_BYTE_RE = /^(-?\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB|PB)$/i;
const NUM_BYTE_MULT = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 };
const NUM_PERCENT_RE = /^(-?\d+(?:[.,]\d+)?)\s*%$/;
const NUM_CURRENCY_RE = /^([$€£¥₹])\s*(-?[\d,]+(?:\.\d+)?)$/;

function toNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  if (NUM_DURATION_RE.test(s)) {
    const parts = s.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }
  let m;
  if ((m = s.match(NUM_BYTE_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n * (NUM_BYTE_MULT[m[2].toUpperCase()] || 1) : null;
  }
  if ((m = s.match(NUM_PERCENT_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if ((m = s.match(NUM_CURRENCY_RE))) {
    const n = Number(m[2].replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function looksLikeDate(v) {
  if (v === null || v === undefined) return false;
  const s = String(v).trim();
  if (!s || s.length < 4) return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false;  // bare number
  const t = Date.parse(s);
  return Number.isFinite(t);
}

/**
 * Classify each column into one of: 'number', 'date', 'category', 'text'.
 * Uses a 100-row sample with a 70% threshold.
 */
export function detectColumns(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return {};
  const columns = Object.keys(rows[0] || {});
  const sample = rows.slice(0, 100);
  const types = {};
  for (const col of columns) {
    let num = 0, date = 0, total = 0;
    const distinct = new Set();
    for (const r of sample) {
      const v = r?.[col];
      if (v === null || v === undefined || v === '') continue;
      total++;
      distinct.add(String(v));
      if (toNumber(v) !== null) num++;
      else if (looksLikeDate(v)) date++;
    }
    if (total === 0) { types[col] = 'text'; continue; }
    const numRatio = num / total;
    const dateRatio = date / total;
    if (numRatio >= 0.7) types[col] = 'number';
    else if (dateRatio >= 0.7) types[col] = 'date';
    else if (distinct.size <= Math.min(total * 0.6, 30)) types[col] = 'category';
    else types[col] = 'text';
  }
  return types;
}

function bucketByMonth(dates) {
  const buckets = new Map();
  for (const d of dates) {
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    const dt = new Date(t);
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12);
}

function groupCount(rows, col, limit = 8) {
  const counts = new Map();
  for (const r of rows) {
    const v = r?.[col];
    if (v === null || v === undefined || v === '') continue;
    const k = String(v);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const arr = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (arr.length <= limit) return arr;
  const top = arr.slice(0, limit - 1);
  const tail = arr.slice(limit - 1).reduce((s, [, n]) => s + n, 0);
  return [...top, ['Others', tail]];
}

function groupSum(rows, catCol, numCol, limit = 8) {
  const sums = new Map();
  for (const r of rows) {
    const k = r?.[catCol];
    if (k === null || k === undefined || k === '') continue;
    const n = toNumber(r?.[numCol]);
    if (n === null) continue;
    const key = String(k);
    sums.set(key, (sums.get(key) || 0) + n);
  }
  const arr = Array.from(sums.entries()).sort((a, b) => b[1] - a[1]);
  if (arr.length <= limit) return arr;
  const top = arr.slice(0, limit - 1);
  const tail = arr.slice(limit - 1).reduce((s, [, v]) => s + v, 0);
  return [...top, ['Others', tail]];
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Build a guaranteed-non-empty chart from raw rows. Used as the last-ditch
 * fallback when no usable date/category/numeric column is found — keeps the
 * "NO CHARTABLE COLUMNS TO SAVE" failure mode permanently dead.
 *
 * Spec:
 *   labels = rows.map((_, i) => i + 1)
 *   data   = rows.map(() => 1)
 *
 * If rows is itself empty, returns a single (1, 0) point — still renderable.
 */
function fallbackChart(rows, title = 'Records') {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { title, labels: [1], data: [0] };
  }
  return {
    title,
    labels: rows.map((_, i) => i + 1),
    data:   rows.map(() => 1),
  };
}

/**
 * Compute the full set of deterministic data the renderer can inject. Always
 * returns a populated result — never empty, never throws.
 *
 * @param {Array<object>} rows
 * @returns {{
 *   columns: object,
 *   kpis: Array<{label:string, value:string, raw:number}>,
 *   charts: { line: {labels, data, title}, bar: {labels, data, title}, donut: {labels, data, title} },
 *   table: { headers: string[], rows: Array<Array<string>> },
 * }}
 */
export function computeDashboardData(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const columns = detectColumns(safeRows);
  const colNames = Object.keys(columns);
  const numericCols    = colNames.filter((c) => columns[c] === 'number');
  const dateCols       = colNames.filter((c) => columns[c] === 'date');
  const categoryCols   = colNames.filter((c) => columns[c] === 'category');

  const primaryNumeric  = numericCols[0] || null;
  const primaryDate     = dateCols[0] || null;
  const primaryCategory = categoryCols[0] || colNames[0] || null;

  // ── KPIs ────────────────────────────────────────────────────────────────
  const kpis = [];
  kpis.push({
    label: 'Total Records',
    value: formatNumber(safeRows.length),
    raw: safeRows.length,
  });
  if (primaryNumeric) {
    const values = safeRows.map((r) => toNumber(r?.[primaryNumeric])).filter((v) => v !== null);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? sum / values.length : 0;
    kpis.push({ label: `Total ${primaryNumeric}`, value: formatNumber(sum), raw: sum });
    kpis.push({ label: `Avg ${primaryNumeric}`,   value: formatNumber(avg), raw: avg });
  }
  if (primaryCategory) {
    const distinct = new Set(safeRows.map((r) => String(r?.[primaryCategory] ?? '')).filter(Boolean)).size;
    kpis.push({
      label: `Unique ${primaryCategory}`,
      value: formatNumber(distinct),
      raw: distinct,
    });
  }
  // Pad to at least 4 KPIs so a 4-card layout always fills.
  while (kpis.length < 4) {
    kpis.push({ label: `KPI ${kpis.length + 1}`, value: formatNumber(safeRows.length), raw: safeRows.length });
  }

  // ── Line chart (timeline) ───────────────────────────────────────────────
  let line;
  if (primaryDate) {
    const buckets = bucketByMonth(safeRows.map((r) => r?.[primaryDate]).filter(Boolean));
    line = {
      title: `${primaryDate} over time`,
      labels: buckets.map(([k]) => k),
      data:   buckets.map(([, v]) => v),
    };
  } else {
    // Fallback: chunk rows into 10 buckets by index, plot row count per bucket.
    const buckets = Math.min(10, Math.max(2, Math.ceil(safeRows.length / 10)));
    const size = Math.ceil(safeRows.length / buckets) || 1;
    const labels = [];
    const data = [];
    for (let i = 0; i < buckets; i++) {
      const slice = safeRows.slice(i * size, (i + 1) * size);
      if (slice.length === 0) continue;
      labels.push(`${i * size + 1}–${i * size + slice.length}`);
      data.push(slice.length);
    }
    line = { title: 'Records by group', labels, data };
  }
  // Spec-mandated empty-chart guard. If the line chart ended up with no
  // labels/data (date column was unusable, no rows, etc.) substitute the
  // index-based fallback so no chart ever ships empty.
  if (!Array.isArray(line.labels) || line.labels.length === 0
      || !Array.isArray(line.data) || line.data.length === 0) {
    line = fallbackChart(safeRows, line.title || 'Records');
  }

  // ── Bar chart (category breakdown) ──────────────────────────────────────
  let bar;
  if (primaryCategory && primaryNumeric) {
    const grouped = groupSum(safeRows, primaryCategory, primaryNumeric);
    bar = {
      title: `${primaryNumeric} by ${primaryCategory}`,
      labels: grouped.map(([k]) => k),
      data:   grouped.map(([, v]) => v),
    };
  } else if (primaryCategory) {
    const grouped = groupCount(safeRows, primaryCategory);
    bar = {
      title: `Count by ${primaryCategory}`,
      labels: grouped.map(([k]) => k),
      data:   grouped.map(([, v]) => v),
    };
  } else {
    bar = fallbackChart(safeRows, 'Records');
  }
  if (!Array.isArray(bar.labels) || bar.labels.length === 0
      || !Array.isArray(bar.data) || bar.data.length === 0) {
    bar = fallbackChart(safeRows, bar.title || 'Records');
  }

  // ── Donut chart (distribution) ──────────────────────────────────────────
  let donut;
  if (primaryCategory) {
    const grouped = groupCount(safeRows, primaryCategory, 5);
    donut = {
      title: `${primaryCategory} distribution`,
      labels: grouped.map(([k]) => k),
      data:   grouped.map(([, v]) => v),
    };
  } else {
    donut = fallbackChart(safeRows, 'Distribution');
  }
  if (!Array.isArray(donut.labels) || donut.labels.length === 0
      || !Array.isArray(donut.data) || donut.data.length === 0) {
    donut = fallbackChart(safeRows, donut.title || 'Distribution');
  }

  // ── Table (first 5–10 real rows) ────────────────────────────────────────
  const headers = colNames.slice(0, 6);
  const tableRows = safeRows.slice(0, 10).map((r) => headers.map((h) => {
    const v = r?.[h];
    if (v === null || v === undefined) return '';
    return String(v).slice(0, 80);
  }));

  return {
    columns,
    kpis,
    charts: { line, bar, donut },
    table: { headers, rows: tableRows },
  };
}
