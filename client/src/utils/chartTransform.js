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

export function applyFilters(rows, filters = []) {
  if (!Array.isArray(filters) || filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      if (!f || !f.field || !f.op) return true;
      const v = row[f.field];
      const target = f.value;
      switch (f.op) {
        case 'equals': return String(v) === String(target);
        case 'not_equals': return String(v) !== String(target);
        case 'contains': {
          const t = String(target ?? '').toLowerCase();
          if (!t) return true;
          return String(v ?? '').toLowerCase().includes(t);
        }
        case 'gt': return num(v) > num(target);
        case 'gte': return num(v) >= num(target);
        case 'lt': return num(v) < num(target);
        case 'lte': return num(v) <= num(target);
        case 'not_empty': return v !== null && v !== undefined && v !== '';
        case 'in': {
          if (!Array.isArray(target) || target.length === 0) return true;
          return target.map(String).includes(String(v));
        }
        case 'between': {
          if (!Array.isArray(target) || target.length < 2) return true;
          const aRaw = target[0], bRaw = target[1];
          const aSet = aRaw !== '' && aRaw !== null && aRaw !== undefined;
          const bSet = bRaw !== '' && bRaw !== null && bRaw !== undefined;
          if (!aSet && !bSet) return true;
          const x = num(v);
          if (aSet && bSet) {
            const a = num(aRaw), b = num(bRaw);
            return x >= Math.min(a, b) && x <= Math.max(a, b);
          }
          if (aSet) return x >= num(aRaw);
          return x <= num(bRaw);
        }
        case 'date_between': {
          if (!Array.isArray(target) || target.length < 2) return true;
          const aRaw = target[0], bRaw = target[1];
          const aSet = aRaw !== '' && aRaw !== null && aRaw !== undefined;
          const bSet = bRaw !== '' && bRaw !== null && bRaw !== undefined;
          if (!aSet && !bSet) return true;
          const t = Date.parse(v);
          if (!Number.isFinite(t)) return false;
          if (aSet && bSet) {
            const a = Date.parse(aRaw), b = Date.parse(bRaw);
            if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
            return t >= Math.min(a, b) && t <= Math.max(a, b);
          }
          if (aSet) {
            const a = Date.parse(aRaw);
            return Number.isFinite(a) ? t >= a : true;
          }
          const b = Date.parse(bRaw);
          return Number.isFinite(b) ? t <= b : true;
        }
        default: return true;
      }
    })
  );
}

function reduce(values, agg, rawValues) {
  if (agg === 'unique') {
    const arr = Array.isArray(rawValues) ? rawValues : values;
    const set = new Set();
    for (const v of arr) {
      if (v === null || v === undefined || v === '') continue;
      set.add(String(v));
    }
    return set.size;
  }
  if (agg === 'non_empty') {
    const arr = Array.isArray(rawValues) ? rawValues : values;
    return arr.filter((v) => v !== null && v !== undefined && v !== '').length;
  }
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
      if (!buckets.has(key)) buckets.set(key, { __x: key, __metrics: {}, __raw: {} });
      const b = buckets.get(key);
      for (const y of ys) {
        if (!b.__metrics[y]) b.__metrics[y] = [];
        if (!b.__raw[y]) b.__raw[y] = [];
        b.__metrics[y].push(num(r[y]));
        b.__raw[y].push(r[y]);
      }
    }
    const data = [];
    for (const b of buckets.values()) {
      const out = { name: b.__x };
      for (const y of ys) {
        out[y] = reduce(b.__metrics[y] || [], aggregation, b.__raw[y]);
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
    if (!buckets.has(key)) buckets.set(key, { __x: key, __groups: {}, __groupsRaw: {}, __raw: [] });
    const b = buckets.get(key);
    if (groupBy) {
      const g = String(r[groupBy] ?? 'unknown');
      if (!b.__groups[g]) b.__groups[g] = [];
      if (!b.__groupsRaw[g]) b.__groupsRaw[g] = [];
      b.__groups[g].push(num(r[yField]));
      b.__groupsRaw[g].push(r[yField]);
    } else {
      if (!b.__values) b.__values = [];
      b.__values.push(yField ? num(r[yField]) : 1);
      if (yField) b.__raw.push(r[yField]);
    }
  }
  const rowsOut = [];
  const groupSet = new Set();
  for (const b of buckets.values()) {
    const out = { name: b.__x };
    if (groupBy) {
      for (const g of Object.keys(b.__groups)) {
        out[g] = reduce(b.__groups[g], aggregation, b.__groupsRaw[g]);
        groupSet.add(g);
      }
    } else {
      out.value = reduce(b.__values || [], aggregation, b.__raw);
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

// ────────────────────────────────────────────────────────────────────────────
// Cap + bucket pass for chart "view" objects produced by the builders above.
//
// Rules per spec:
//   line / area    → ≤ 12 points (date-bucket by week/month/year if X looks
//                    like a date; else keep the last 12)
//   bar / hbar /
//   stackedBar /
//   table          → top 10 by value
//   donut / radial
//   / funnel       → top 5 + "Others" merging the tail
//   treemap        → top 5 + "Others"
//   scatter        → stride-sampled to 30 points per series
//   heatmap /
//   waterfall      → unchanged (heatmap is a grid, waterfall implies sequence)
//
// Long X labels are also truncated to keep axes/legends readable.
// ────────────────────────────────────────────────────────────────────────────

const NAME_LIMIT = 18;
const OTHERS_COLOR = '#94a3b8';

function looksDate(s) {
  if (s === null || s === undefined) return false;
  const str = String(s).trim();
  if (!str) return false;
  // A bare 4-digit year is ambiguous (could be a category code) — only
  // accept it when the input contains explicit date separators.
  if (/^\d{4}$/.test(str)) return false;
  return Number.isFinite(Date.parse(str));
}

function pickGranularity(spanMs) {
  const DAY = 86400000;
  if (spanMs <= 90 * DAY) return 'week';
  if (spanMs <= 36 * 30 * DAY) return 'month';
  return 'year';
}

function bucketLabel(ts, granularity) {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  if (granularity === 'year') return String(y);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  if (granularity === 'month') return `${y}-${m}`;
  // weekly: ISO Monday start
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate() + diff));
  return monday.toISOString().slice(0, 10);
}

function bucketByDate(data, groups, gran) {
  const buckets = new Map();
  for (const r of data) {
    const t = Date.parse(r.name);
    if (!Number.isFinite(t)) continue;
    const key = bucketLabel(t, gran);
    if (!buckets.has(key)) {
      const tmpl = { name: key };
      if (groups.length) for (const g of groups) tmpl[g] = 0;
      else tmpl.value = 0;
      buckets.set(key, tmpl);
    }
    const b = buckets.get(key);
    if (groups.length) {
      for (const g of groups) b[g] = (b[g] || 0) + (Number(r[g]) || 0);
    } else {
      b.value = (b.value || 0) + (Number(r.value) || 0);
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function rankByValue(data, groups) {
  const valueOf = groups.length
    ? (r) => groups.reduce((s, g) => s + (Number(r[g]) || 0), 0)
    : (r) => Number(r.value) || 0;
  return data.slice().sort((a, b) => valueOf(b) - valueOf(a));
}

function truncateName(name) {
  const s = String(name ?? '');
  return s.length > NAME_LIMIT ? `${s.slice(0, NAME_LIMIT - 1)}…` : s;
}

export function simplifyForChart(view, chart) {
  const type = chart?.type;
  if (!view) return view;

  // Scatter: deterministic stride sample to ≤ 30 points per series.
  if (type === 'scatter' && Array.isArray(view.series)) {
    const series = view.series.map((s) => {
      const pts = Array.isArray(s.data) ? s.data : [];
      if (pts.length <= 30) return s;
      const stride = pts.length / 30;
      const sampled = [];
      for (let i = 0; i < 30; i++) sampled.push(pts[Math.floor(i * stride)]);
      return { ...s, data: sampled };
    });
    return { ...view, series };
  }

  if (!Array.isArray(view.data)) return view;
  let data = view.data;
  const groups = Array.isArray(view.groups) ? view.groups : [];

  switch (type) {
    case 'line':
    case 'area': {
      if (data.length <= 12) break;
      const dateHits = data.filter((r) => looksDate(r.name)).length;
      if (dateHits / data.length >= 0.7) {
        const times = data.map((r) => Date.parse(r.name)).filter(Number.isFinite);
        const span = Math.max(...times) - Math.min(...times);
        let gran = pickGranularity(span);
        let bucketed = bucketByDate(data, groups, gran);
        // If still > 12 buckets (e.g. 5y of monthly = 60), bump granularity.
        while (bucketed.length > 12 && gran !== 'year') {
          gran = gran === 'week' ? 'month' : 'year';
          bucketed = bucketByDate(data, groups, gran);
        }
        if (bucketed.length > 12) bucketed = bucketed.slice(-12);
        data = bucketed;
      } else {
        data = data.slice(-12);
      }
      break;
    }
    case 'bar':
    case 'horizontalBar':
    case 'stackedBar':
    case 'table': {
      if (data.length <= 10) break;
      data = rankByValue(data, groups).slice(0, 10);
      break;
    }
    case 'donut':
    case 'radial':
    case 'funnel': {
      if (data.length <= 6) break;
      const sorted = rankByValue(data, groups);
      const top = sorted.slice(0, 5);
      const tail = sorted.slice(5);
      if (groups.length === 0) {
        const tailValue = tail.reduce((s, r) => s + (Number(r.value) || 0), 0);
        if (tailValue > 0) {
          top.push({ name: 'Others', value: tailValue, fill: OTHERS_COLOR });
        }
      } else {
        const others = { name: 'Others' };
        let any = false;
        for (const g of groups) {
          const v = tail.reduce((s, r) => s + (Number(r[g]) || 0), 0);
          others[g] = v;
          if (v > 0) any = true;
        }
        if (any) top.push(others);
      }
      data = top;
      break;
    }
    case 'treemap': {
      if (data.length <= 6) break;
      const sorted = data.slice().sort(
        (a, b) => (Number(b.size) || 0) - (Number(a.size) || 0)
      );
      const top = sorted.slice(0, 5);
      const tailSize = sorted.slice(5).reduce((s, r) => s + (Number(r.size) || 0), 0);
      if (tailSize > 0) top.push({ name: 'Others', size: tailSize });
      data = top;
      break;
    }
    default:
      break;
  }

  data = data.map((r) => (r && r.name != null ? { ...r, name: truncateName(r.name) } : r));
  return { ...view, data };
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
