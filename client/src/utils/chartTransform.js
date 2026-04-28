export const CHART_TYPES = [
  { id: 'bar', name: 'Bar', group: 'basic', desc: 'Compare category values' },
  { id: 'line', name: 'Line', group: 'basic', desc: 'Trend over time' },
  { id: 'donut', name: 'Donut', group: 'basic', desc: 'Percentage distribution' },
  { id: 'area', name: 'Area', group: 'basic', desc: 'Trend + volume' },
  { id: 'stackedBar', name: 'Stacked Bar', group: 'advanced', desc: 'Multi-category compare' },
  { id: 'horizontalBar', name: 'Horizontal Bar', group: 'advanced', desc: 'Long labels' },
  { id: 'scatter', name: 'Scatter', group: 'advanced', desc: 'Correlation between two variables' },
  { id: 'treemap', name: 'Treemap', group: 'advanced', desc: 'Hierarchical data' },
  { id: 'funnel', name: 'Funnel', group: 'advanced', desc: 'Conversion pipeline' },
  { id: 'radial', name: 'Radial Bar', group: 'pro', desc: 'Circular progress' },
  { id: 'heatmap', name: 'Heatmap', group: 'pro', desc: 'Intensity grid' },
  { id: 'waterfall', name: 'Waterfall', group: 'pro', desc: 'Increment / decrement flow' },
];

export const PALETTE = [
  '#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
];

// Regexes mirror the server parser so even if a column wasn't classified as
// numeric on import, values like "120 MB" / "1.5GB" / "$50" / "120:15:14"
// still produce a usable number when fed to the chart engine.
const NUM_DURATION_RE = /^\d{1,5}:\d{2}(?::\d{2})?$/;
const NUM_BYTE_RE = /^(-?\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB|PB)$/i;
const NUM_BYTE_MULT = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 };
const NUM_SUFFIX_RE = /^(-?\d+(?:[.,]\d+)?)\s*([kKmMbBtT])$/;
const NUM_SUFFIX_MULT = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9, t: 1e12, T: 1e12 };
const NUM_PERCENT_RE = /^(-?\d+(?:[.,]\d+)?)\s*%$/;
const NUM_CURRENCY_RE = /^([$€£¥₹])\s*(-?[\d,]+(?:\.\d+)?)$/;

/**
 * Returns true if at least 70% of non-empty sample values from `col` parse as
 * a number (after unit/duration/currency/percent stripping). Useful when the
 * server's type detector classified a column as `string` because of unit
 * suffixes like "120 MB".
 */
export function looksNumeric(rows, col) {
  const sample = rows.slice(0, 80).map((r) => r?.[col]).filter((v) => v !== null && v !== undefined && v !== '');
  if (sample.length === 0) return false;
  let hits = 0;
  for (const v of sample) {
    if (typeof v === 'number' && Number.isFinite(v)) { hits++; continue; }
    const s = String(v).trim();
    if (
      NUM_DURATION_RE.test(s) ||
      NUM_BYTE_RE.test(s) ||
      NUM_SUFFIX_RE.test(s) ||
      NUM_PERCENT_RE.test(s) ||
      NUM_CURRENCY_RE.test(s) ||
      Number.isFinite(Number(s.replace(/,/g, '')))
    ) {
      hits++;
    }
  }
  return hits / sample.length >= 0.7;
}

function num(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim();
  if (!s) return 0;
  if (NUM_DURATION_RE.test(s)) {
    const parts = s.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  let m;
  if ((m = s.match(NUM_BYTE_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n * (NUM_BYTE_MULT[m[2].toUpperCase()] || 1) : 0;
  }
  if ((m = s.match(NUM_SUFFIX_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n * (NUM_SUFFIX_MULT[m[2]] || 1) : 0;
  }
  if ((m = s.match(NUM_PERCENT_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if ((m = s.match(NUM_CURRENCY_RE))) {
    const n = Number(m[2].replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function applyFilters(rows, filters = []) {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      if (!f.field || !f.op) return true;
      const v = row[f.field];
      const target = f.value;
      switch (f.op) {
        case 'equals': return String(v) === String(target);
        case 'not_equals': return String(v) !== String(target);
        case 'contains': return String(v ?? '').toLowerCase().includes(String(target).toLowerCase());
        case 'gt': return num(v) > num(target);
        case 'gte': return num(v) >= num(target);
        case 'lt': return num(v) < num(target);
        case 'lte': return num(v) <= num(target);
        case 'not_empty': return v !== null && v !== undefined && v !== '';
        default: return true;
      }
    })
  );
}

function reduce(values, agg) {
  if (!values.length) return 0;
  switch (agg) {
    case 'sum': return values.reduce((a, b) => a + b, 0);
    case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min': return Math.min(...values);
    case 'max': return Math.max(...values);
    case 'count': return values.length;
    case 'none': return values[values.length - 1];
    default: return values.reduce((a, b) => a + b, 0);
  }
}

export function aggregate(rows, { xField, yField, yFields, groupBy, aggregation = 'sum', filters = [] }) {
  const filtered = applyFilters(rows, filters);
  if (!xField) return { data: [], groups: [] };

  // Multi-Y wins over groupBy. Each yField becomes its own series.
  const ys = Array.isArray(yFields) && yFields.length > 0
    ? yFields
    : (yField ? [yField] : []);
  const useMultiY = ys.length >= 2;

  if (useMultiY) {
    const buckets = new Map();
    for (const r of filtered) {
      const k = r[xField];
      if (k === null || k === undefined || k === '') continue;
      const key = String(k);
      if (!buckets.has(key)) buckets.set(key, { __x: key, __metrics: {} });
      const b = buckets.get(key);
      for (const y of ys) {
        if (!b.__metrics[y]) b.__metrics[y] = [];
        b.__metrics[y].push(num(r[y]));
      }
    }
    const data = [];
    for (const b of buckets.values()) {
      const out = { name: b.__x };
      for (const y of ys) {
        out[y] = reduce(b.__metrics[y] || [], aggregation);
      }
      data.push(out);
    }
    return { data, groups: [...ys] };
  }

  const buckets = new Map();
  for (const r of filtered) {
    const k = r[xField];
    if (k === null || k === undefined || k === '') continue;
    const key = String(k);
    if (!buckets.has(key)) buckets.set(key, { __x: key, __groups: {} });
    const b = buckets.get(key);
    if (groupBy) {
      const g = String(r[groupBy] ?? 'unknown');
      if (!b.__groups[g]) b.__groups[g] = [];
      b.__groups[g].push(num(r[yField]));
    } else {
      if (!b.__values) b.__values = [];
      b.__values.push(yField ? num(r[yField]) : 1);
    }
  }
  const rowsOut = [];
  const groupSet = new Set();
  for (const b of buckets.values()) {
    const out = { name: b.__x };
    if (groupBy) {
      for (const g of Object.keys(b.__groups)) {
        out[g] = reduce(b.__groups[g], aggregation);
        groupSet.add(g);
      }
    } else {
      out.value = reduce(b.__values || [], aggregation);
    }
    rowsOut.push(out);
  }
  return { data: rowsOut, groups: Array.from(groupSet) };
}

/**
 * Total per metric — used by donut/radial/treemap/funnel when the chart has
 * multiple yFields. Produces one slice per metric with its sum across the
 * filtered rows.
 */
export function totalsPerMetric(rows, { yFields = [], aggregation = 'sum', filters = [] }) {
  const filtered = applyFilters(rows, filters);
  return yFields.map((y, i) => {
    const nums = filtered.map((r) => num(r[y]));
    return {
      name: y,
      value: reduce(nums, aggregation),
      fill: PALETTE[i % PALETTE.length],
    };
  });
}

export function buildScatter(rows, { xField, yField, groupBy, filters = [] }) {
  const filtered = applyFilters(rows, filters);
  if (!xField || !yField) return { series: [{ name: 'Series', data: [] }] };
  if (!groupBy) {
    return {
      series: [{
        name: yField,
        data: filtered.map((r) => ({ x: num(r[xField]), y: num(r[yField]) })),
      }],
    };
  }
  const map = new Map();
  for (const r of filtered) {
    const g = String(r[groupBy] ?? 'unknown');
    if (!map.has(g)) map.set(g, []);
    map.get(g).push({ x: num(r[xField]), y: num(r[yField]) });
  }
  return { series: Array.from(map.entries()).map(([name, data]) => ({ name, data })) };
}

export function buildTreemap(rows, { xField, yField, filters = [] }) {
  const filtered = applyFilters(rows, filters);
  const map = new Map();
  for (const r of filtered) {
    const k = String(r[xField] ?? '');
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + num(r[yField]));
  }
  return Array.from(map.entries()).map(([name, size]) => ({ name, size }));
}

export function buildFunnel(rows, { xField, yField, filters = [] }) {
  const filtered = applyFilters(rows, filters);
  const map = new Map();
  for (const r of filtered) {
    const k = String(r[xField] ?? '');
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + num(r[yField]));
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, fill: PALETTE[i % PALETTE.length] }));
}

export function buildHeatmap(rows, { xField, yField, groupBy, aggregation = 'sum', filters = [] }) {
  const filtered = applyFilters(rows, filters);
  if (!xField || !groupBy) return { xs: [], ys: [], cells: [], max: 0 };
  const xs = new Set(); const ys = new Set();
  const map = new Map();
  for (const r of filtered) {
    const x = String(r[xField] ?? '');
    const y = String(r[groupBy] ?? '');
    if (!x || !y) continue;
    xs.add(x); ys.add(y);
    const k = `${x}__${y}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(yField ? num(r[yField]) : 1);
  }
  const cells = [];
  let max = 0;
  for (const x of xs) {
    for (const y of ys) {
      const arr = map.get(`${x}__${y}`) || [];
      const v = reduce(arr, aggregation);
      if (v > max) max = v;
      cells.push({ x, y, v });
    }
  }
  return { xs: Array.from(xs), ys: Array.from(ys), cells, max };
}

export function buildWaterfall(rows, { xField, yField, filters = [] }) {
  const filtered = applyFilters(rows, filters);
  const map = new Map();
  for (const r of filtered) {
    const k = String(r[xField] ?? '');
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + num(r[yField]));
  }
  let running = 0;
  const out = [];
  for (const [name, delta] of map.entries()) {
    const start = running;
    running += delta;
    out.push({ name, base: Math.min(start, running), value: Math.abs(delta), delta, end: running });
  }
  return out;
}
