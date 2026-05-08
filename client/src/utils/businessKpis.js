// Business-friendly KPI builder.
//
// Important: the server pre-coerces unit-suffixed strings (e.g. "416 MB" →
// 436207616 raw bytes, "120:15:14" → 7514 seconds) when storing rows. By the
// time we see the data on the client, unit context is lost — values look like
// plain numbers. So column-kind detection cannot rely on cell parsing alone;
// it must also use column-name patterns and value-range heuristics.

import { applyFilters } from './chartTransform.js';

/* ─── parsers (for raw-string columns that escaped server coercion) ─── */

const BYTE_RE       = /^(-?\d+(?:[.,]\d+)?)\s*(B|KB|MB|GB|TB|PB)\b/i;
const BYTE_MULT     = { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 };
const HHMMSS_RE     = /^(\d{1,5}):([0-5]?\d)(?::([0-5]?\d))?$/;
const SECONDS_RE    = /^(-?\d+(?:[.,]\d+)?)\s*s(?:ec|econds?)?$/i;
const MINUTES_RE    = /^(-?\d+(?:[.,]\d+)?)\s*m(?:in|inutes?)?$/i;
const HOURS_RE      = /^(-?\d+(?:[.,]\d+)?)\s*h(?:r|rs|ours?)?$/i;
const DAYS_RE       = /^(-?\d+(?:[.,]\d+)?)\s*d(?:ays?)?$/i;
const CURRENCY_RE   = /^([$€£¥₹])\s*(-?[\d,]+(?:\.\d+)?)$/;
const PERCENT_RE    = /^(-?\d+(?:[.,]\d+)?)\s*%$/;
const MAGNITUDE_RE  = /^(-?\d+(?:[.,]\d+)?)\s*([kKmMbBtT])$/;
const MAGNITUDE_MULT = { k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9, t: 1e12, T: 1e12 };

/* ─── column name hints ─── */

const BYTE_NAME_HINT     = /\b(size|bytes?|storage|disk|memory|capacity|volume|filesize|bandwidth)\b/i;
const DURATION_NAME_HINT = /\b(duration|elapsed|seconds?|minutes?|hours?|days?|length|runtime|playtime|watchtime|time(?:taken)?)\b/i;
const CURRENCY_NAME_HINT = /\b(price|cost|revenue|profit|sales|amount|fee|salary|budget|usd|inr|eur|gbp|spend|mrr|arr|earnings?|income)\b/i;
const ITEM_NAME_HINT     = /\b(title|name|video|item|product|article|asset|customer|user|email|track|song|episode)\b/i;
const URL_NAME_HINT      = /\b(url|link|href|file|drive|source|page|website)\b/i;

/**
 * Parse a raw string cell into a base-unit numeric value.
 * Returns null when the value can't be parsed or is empty.
 */
export function parseCellToBase(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { kind: 'number', base: v } : null;

  const s = String(v).trim();
  if (!s) return null;
  let m;

  if ((m = s.match(BYTE_RE))) {
    const n = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return { kind: 'bytes', base: n * BYTE_MULT[m[2].toUpperCase()] };
  }
  if ((m = s.match(HHMMSS_RE))) {
    const h = Number(m[1]);
    const mn = Number(m[2]);
    const sec = m[3] !== undefined ? Number(m[3]) : 0;
    if (![h, mn, sec].every(Number.isFinite)) return null;
    return { kind: 'duration', base: h * 3600 + mn * 60 + sec };
  }
  if ((m = s.match(SECONDS_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'duration', base: n } : null;
  }
  if ((m = s.match(MINUTES_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'duration', base: n * 60 } : null;
  }
  if ((m = s.match(HOURS_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'duration', base: n * 3600 } : null;
  }
  if ((m = s.match(DAYS_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'duration', base: n * 86400 } : null;
  }
  if ((m = s.match(CURRENCY_RE))) {
    const n = Number(m[2].replace(/,/g, ''));
    return Number.isFinite(n) ? { kind: 'currency', base: n } : null;
  }
  if ((m = s.match(PERCENT_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'percent', base: n } : null;
  }
  if ((m = s.match(MAGNITUDE_RE))) {
    const n = Number(m[1].replace(',', '.'));
    return Number.isFinite(n) ? { kind: 'magnitude', base: n * MAGNITUDE_MULT[m[2]] } : null;
  }
  const plain = Number(s.replace(/,/g, ''));
  if (Number.isFinite(plain)) return { kind: 'number', base: plain };
  return null;
}

/**
 * Detect the dominant kind for a column. Tries cell parsing first, then falls
 * back to column-name + value-range heuristics for server-coerced numeric data.
 *
 * Returns: 'bytes' | 'duration' | 'currency' | 'percent' | 'magnitude' | 'number' | null
 */
export function detectColumnKind(rows, column) {
  if (!Array.isArray(rows) || !column) return null;

  // ─── pass 1: parse cells ───
  const counts = { bytes: 0, duration: 0, currency: 0, percent: 0, magnitude: 0, number: 0 };
  let parsed = 0;
  let total = 0;
  let numericMax = 0;
  let allNumeric = true;

  for (let i = 0; i < rows.length && total < 200; i++) {
    const v = rows[i]?.[column];
    if (v === null || v === undefined || v === '') continue;
    total++;
    if (typeof v !== 'number' && typeof v !== 'string') { allNumeric = false; continue; }
    const r = parseCellToBase(v);
    if (!r) { allNumeric = false; continue; }
    parsed++;
    counts[r.kind]++;
    if (r.kind === 'number' && Math.abs(r.base) > numericMax) numericMax = Math.abs(r.base);
    if (typeof v === 'string' && r.kind === 'number') {
      // pure numeric strings are fine
    }
  }

  if (total === 0) return null;

  // Strong signal: ≥50% of cells parsed as a unit-bearing kind.
  for (const k of ['bytes', 'duration', 'currency', 'percent', 'magnitude']) {
    if (counts[k] / Math.max(parsed, 1) >= 0.5) return k;
  }

  // ─── pass 2: name-based override for server-coerced numeric columns ───
  if (counts.number > 0 && counts.number / Math.max(parsed, 1) >= 0.5) {
    if (BYTE_NAME_HINT.test(column)) return 'bytes';
    if (DURATION_NAME_HINT.test(column)) return 'duration';
    if (CURRENCY_NAME_HINT.test(column)) return 'currency';

    // Range heuristic — values ≥ 1 MB and column has no other hint? Probably bytes.
    // Tightened to avoid misclassifying generic large numbers.
    return 'number';
  }

  return null;
}

/**
 * Sum every cell in `column` whose parsed kind matches `kind`. For
 * server-coerced rows the cell is already a plain number — we accept it as
 * matching when the column was classified by name (kind passed in is bytes /
 * duration / currency).
 */
export function sumColumnByKind(rows, column, kind) {
  if (!Array.isArray(rows) || !column || !kind) return null;
  let total = 0;
  let count = 0;
  for (const r of rows) {
    const v = r?.[column];
    if (v === null || v === undefined || v === '') continue;

    if (typeof v === 'number') {
      // Server already coerced this — trust the column-level classification.
      if (Number.isFinite(v)) { total += v; count++; }
      continue;
    }

    const parsed = parseCellToBase(v);
    if (!parsed) continue;
    // Allow magnitude → number bucket and same-kind matches.
    const compatible =
      parsed.kind === kind ||
      (kind === 'number' && parsed.kind === 'magnitude') ||
      (kind === 'bytes' && parsed.kind === 'number') ||
      (kind === 'duration' && parsed.kind === 'number') ||
      (kind === 'currency' && parsed.kind === 'number');
    if (!compatible) continue;
    total += parsed.base;
    count++;
  }
  return count > 0 ? { total, count, kind } : null;
}

/* ─── formatters ─── */

/**
 * Round to at most `digits` decimals and drop trailing zeros so 349.10 → 349.1
 * and 100.00 → 100. Returns a plain locale-formatted string.
 */
function trimNum(n, digits = 2) {
  if (!Number.isFinite(n)) return '–';
  const rounded = Math.round(n * 10 ** digits) / 10 ** digits;
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

/** "349.9 GB" — picks best-fit unit ≥ 1.0 and trims trailing zeros. */
export function formatBytesTotal(bytes) {
  if (!Number.isFinite(bytes) || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.min(units.length - 1, Math.max(0, Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))));
  const v = bytes / Math.pow(k, i);
  return `${trimNum(v, i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Strict HH:MM:SS format. Hours can exceed 99 (e.g. "120:15:14") because we
 * never roll into days — totals like a 5-day backlog should still read as a
 * sum of hours, the way a stopwatch shows it.
 */
export function formatDurationTotal(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00:00';
  const s = Math.round(Math.abs(seconds));
  const hours = Math.floor(s / 3600);
  const mins  = Math.floor((s % 3600) / 60);
  const secs  = s % 60;
  const pad = (n) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

/** Currency with thousands separator. No compaction. */
export function formatCurrencyTotal(n) {
  if (!Number.isFinite(n)) return '–';
  return `$${trimNum(n, 2)}`;
}

/** Plain numeric total with thousands separator. No compaction. */
export function formatNumberTotal(n) {
  if (!Number.isFinite(n)) return '–';
  return trimNum(n, 2);
}

export function formatInteger(n) {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toLocaleString();
}

/** Percent with trimmed zeros: 23.6% / 100% (not 100.0%). */
export function formatPercent(n) {
  if (!Number.isFinite(n)) return '–';
  return `${trimNum(n, 1)}%`;
}

/* ─── KPI builder ─── */

function notEmpty(v) {
  return v !== null && v !== undefined && v !== '';
}

/**
 * Returns a list of business-friendly KPI tiles for the given sheet + filters.
 * Tiles are stable in order so the dashboard layout doesn't jump around.
 */
export function buildKpis(sheet, filters = []) {
  if (!sheet) return null;
  const allRows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const rows = applyFilters(allRows, filters || []);
  const cols = Array.isArray(sheet.columns) ? sheet.columns : [];
  const selected =
    Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : cols;
  const visible = cols.filter((c) => selected.includes(c));

  const colKinds = {};
  for (const c of visible) {
    const k = detectColumnKind(rows.length ? rows : allRows, c);
    if (k) colKinds[c] = k;
  }

  function bestColumnForKind(kind, namePattern) {
    const matches = visible.filter((c) => colKinds[c] === kind);
    if (matches.length === 0) return null;
    if (namePattern) {
      const named = matches.find((c) => namePattern.test(c));
      if (named) return named;
    }
    let best = matches[0];
    let bestSum = -Infinity;
    for (const c of matches) {
      const r = sumColumnByKind(rows, c, kind);
      const total = r?.total ?? 0;
      if (total > bestSum) { best = c; bestSum = total; }
    }
    return best;
  }

  function bestCategoricalColumn() {
    const candidates = visible.filter((c) => {
      const k = colKinds[c];
      if (k && k !== 'number') return false;
      // Skip URL columns
      if (URL_NAME_HINT.test(c)) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    const named = candidates.find((c) => ITEM_NAME_HINT.test(c));
    const ordered = named ? [named, ...candidates.filter((c) => c !== named)] : candidates;
    let best = null;
    let bestUnique = -1;
    for (const c of ordered) {
      const set = new Set();
      for (const r of rows) {
        const v = r?.[c];
        if (notEmpty(v)) set.add(String(v));
      }
      const u = set.size;
      // Prefer columns where unique > 1 and not 100% per-row (which would mean an ID column).
      const uniquenessOk = rows.length === 0 || u <= rows.length;
      if (u > bestUnique && u > 1 && uniquenessOk) {
        best = c; bestUnique = u;
      }
    }
    return best ? { column: best, unique: bestUnique } : null;
  }

  const tiles = [];

  // 1. Total Records — always present
  const filterActive = allRows.length !== rows.length;
  tiles.push({
    key: 'records',
    icon: 'records',
    accent: 'brand',
    label: 'Total Records',
    value: formatInteger(rows.length),
    sublabel: filterActive
      ? `filtered from ${formatInteger(allRows.length)}`
      : `${visible.length} column${visible.length === 1 ? '' : 's'}`,
  });

  // 2. Total Data Size
  const bytesCol = bestColumnForKind('bytes', BYTE_NAME_HINT);
  if (bytesCol) {
    const r = sumColumnByKind(rows, bytesCol, 'bytes');
    if (r) {
      tiles.push({
        key: 'data-size',
        icon: 'data-size',
        accent: 'emerald',
        label: 'Total Data Size',
        value: formatBytesTotal(r.total),
        sublabel: bytesCol,
      });
    }
  }

  // 3. Total Duration
  const durCol = bestColumnForKind('duration', DURATION_NAME_HINT);
  if (durCol) {
    const r = sumColumnByKind(rows, durCol, 'duration');
    if (r) {
      tiles.push({
        key: 'duration',
        icon: 'duration',
        accent: 'amber',
        label: 'Total Duration',
        value: formatDurationTotal(r.total),
        sublabel: durCol,
      });
    }
  }

  // 4. Total Revenue / sum
  const moneyCol = bestColumnForKind('currency', CURRENCY_NAME_HINT);
  if (moneyCol) {
    const r = sumColumnByKind(rows, moneyCol, 'currency');
    if (r) {
      tiles.push({
        key: 'currency',
        icon: 'currency',
        accent: 'emerald',
        label: 'Total Revenue',
        value: formatCurrencyTotal(r.total),
        sublabel: moneyCol,
      });
    }
  } else if (tiles.length < 4) {
    const numCol = bestColumnForKind('magnitude') || bestColumnForKind('number');
    if (numCol && !BYTE_NAME_HINT.test(numCol) && !DURATION_NAME_HINT.test(numCol)) {
      const kind = colKinds[numCol];
      const r = sumColumnByKind(rows, numCol, kind);
      if (r && r.total > 0) {
        tiles.push({
          key: 'numeric-total',
          icon: 'sum',
          accent: 'emerald',
          label: `Total ${numCol}`,
          value: formatNumberTotal(r.total),
          sublabel: numCol,
        });
      }
    }
  }

  // 5. Unique Items
  const cat = bestCategoricalColumn();
  if (cat) {
    tiles.push({
      key: 'unique',
      icon: 'unique',
      accent: 'purple',
      label: `Unique ${cat.column}`,
      value: formatInteger(cat.unique),
      sublabel: 'distinct values',
    });
  }

  // 6. Missing Data — "3,823 (23.6%)" — short form so it fits
  const totalCells = rows.length * visible.length;
  let missingTotal = 0;
  for (const c of visible) {
    for (const r of rows) {
      if (!notEmpty(r?.[c])) missingTotal++;
    }
  }
  const missingPct = totalCells ? (missingTotal / totalCells) * 100 : 0;
  tiles.push({
    key: 'missing',
    icon: 'missing',
    accent: missingPct > 5 ? 'amber' : 'emerald',
    label: 'Missing Data',
    value: totalCells === 0
      ? '—'
      : (missingTotal === 0
          ? '0'
          : `${formatInteger(missingTotal)} (${formatPercent(missingPct)})`),
    sublabel: totalCells === 0
      ? 'no rows yet'
      : (missingTotal === 0 ? 'fully populated' : 'empty cells'),
  });

  // 7. Duplicate Records
  let duplicates = 0;
  if (visible.length > 0 && rows.length > 0) {
    const fps = new Map();
    for (const r of rows) {
      const key = visible.map((c) => String(r?.[c] ?? '')).join('||');
      fps.set(key, (fps.get(key) || 0) + 1);
    }
    for (const c of fps.values()) if (c > 1) duplicates += c - 1;
  }
  tiles.push({
    key: 'duplicates',
    icon: 'duplicates',
    accent: duplicates ? 'amber' : 'emerald',
    label: 'Duplicate Records',
    value: formatInteger(duplicates),
    sublabel: duplicates ? 'across visible columns' : 'every row is unique',
  });

  return {
    tiles: tiles.slice(0, 6),
    meta: {
      totalRows: rows.length,
      filteredFromRows: allRows.length,
      totalColumns: visible.length,
      missingTotal,
      missingPct,
      duplicates,
      colKinds,
      filterActive,
    },
  };
}

/**
 * Pick a formatter for a chart's value axis / tooltip / heatmap cells.
 *
 * Decision order:
 *  1. If the chart's aggregation reduces to a count (count / unique /
 *     non_empty), force integer — even on a "File Size" column, a row count
 *     should never read as "5 MB".
 *  2. If the Y column is classified as bytes/duration/currency, use the
 *     matching unit-aware formatter so axes auto-pick KB/MB/GB/TB.
 *  3. Otherwise, full comma-formatted numbers (no compaction).
 *
 * Returns a single (n) => string fn safe to drop into Recharts'
 * `tickFormatter` or tooltip `formatter`.
 */
export function formatterForChart(chart, rows) {
  const agg = chart?.aggregation;
  if (agg === 'count' || agg === 'unique' || agg === 'non_empty') {
    return (n) => formatInteger(Number(n));
  }
  const ys = Array.isArray(chart?.yFields) && chart.yFields.length > 0
    ? chart.yFields
    : (chart?.yField ? [chart.yField] : []);
  if (ys.length === 0) return (n) => formatInteger(Number(n));
  const primary = ys[0];
  const safeRows = Array.isArray(rows) ? rows : [];
  const kind = detectColumnKind(safeRows, primary);
  if (kind === 'bytes')    return (n) => formatBytesTotal(Number(n));
  if (kind === 'duration') return (n) => formatDurationTotal(Number(n));
  if (kind === 'currency') return (n) => formatCurrencyTotal(Number(n));
  return (n) => formatNumberTotal(Number(n));
}

/**
 * Convenience: returns the kind override map keyed by column. Useful for the
 * source-data table so it can format byte/duration columns even when the
 * server marked them as `number`.
 */
export function getColumnKindMap(sheet) {
  if (!sheet) return {};
  const rows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const cols = Array.isArray(sheet.columns) ? sheet.columns : [];
  const map = {};
  for (const c of cols) {
    const k = detectColumnKind(rows, c);
    if (k) map[c] = k;
  }
  return map;
}

/**
 * Build one KPI tile per visible column. The shape matches `buildKpis().tiles`
 * so the same `KpiTile` component can render them.
 *
 * Heuristics:
 *  - bytes / duration / currency / magnitude / number → "Total <col>: <formatted>"
 *  - URL columns                                       → "Links · <col>" with count
 *  - date columns                                      → "<col>" with coverage range
 *  - high-uniqueness text (≈row count)                 → "Total <col>: <count>"
 *  - low-uniqueness text (categorical)                 → "<col>: N categories"
 */
export function buildPerColumnKpis(sheet, filters = []) {
  if (!sheet) return [];
  const allRows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const rows = applyFilters(allRows, filters || []);
  const cols = Array.isArray(sheet.columns) ? sheet.columns : [];
  const selected =
    Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : cols;
  const visible = cols.filter((c) => selected.includes(c));
  const types = sheet.detectedTypes || {};
  const colKinds = {};
  for (const c of visible) {
    const k = detectColumnKind(rows.length ? rows : allRows, c);
    if (k) colKinds[c] = k;
  }

  const tiles = [];
  for (const c of visible) {
    const kind = colKinds[c];
    const t = types[c];

    if (kind === 'bytes') {
      const r = sumColumnByKind(rows, c, 'bytes');
      tiles.push({
        key: `col-${c}`, icon: 'data-size', accent: 'emerald',
        label: `Total ${c}`,
        value: r ? formatBytesTotal(r.total) : '—',
        sublabel: r ? `${formatInteger(r.count)} values` : 'no data',
      });
      continue;
    }
    if (kind === 'duration') {
      const r = sumColumnByKind(rows, c, 'duration');
      tiles.push({
        key: `col-${c}`, icon: 'duration', accent: 'amber',
        label: `Total ${c}`,
        value: r ? formatDurationTotal(r.total) : '—',
        sublabel: r ? `${formatInteger(r.count)} values` : 'no data',
      });
      continue;
    }
    if (kind === 'currency') {
      const r = sumColumnByKind(rows, c, 'currency');
      tiles.push({
        key: `col-${c}`, icon: 'currency', accent: 'emerald',
        label: `Total ${c}`,
        value: r ? formatCurrencyTotal(r.total) : '—',
        sublabel: r ? `${formatInteger(r.count)} values` : 'no data',
      });
      continue;
    }
    if (kind === 'magnitude' || kind === 'number') {
      const r = sumColumnByKind(rows, c, kind);
      tiles.push({
        key: `col-${c}`, icon: 'sum', accent: 'brand',
        label: `Total ${c}`,
        value: r ? formatNumberTotal(r.total) : '—',
        sublabel: r ? `${formatInteger(r.count)} values` : 'no data',
      });
      continue;
    }
    if (URL_NAME_HINT.test(c)) {
      let count = 0;
      for (const r of rows) if (notEmpty(r?.[c])) count++;
      tiles.push({
        key: `col-${c}`, icon: 'link', accent: 'purple',
        label: c,
        value: formatInteger(count),
        sublabel: 'links',
      });
      continue;
    }
    if (t === 'date') {
      const ts = rows.map((r) => Date.parse(r?.[c])).filter((n) => Number.isFinite(n));
      if (ts.length) {
        const min = new Date(Math.min(...ts));
        const max = new Date(Math.max(...ts));
        const fmt = (d) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        tiles.push({
          key: `col-${c}`, icon: 'date', accent: 'amber',
          label: c,
          value: fmt(min),
          sublabel: `to ${fmt(max)}`,
        });
      } else {
        tiles.push({
          key: `col-${c}`, icon: 'date', accent: 'amber',
          label: c, value: '—', sublabel: 'no dates',
        });
      }
      continue;
    }

    // Default — categorize by uniqueness
    const set = new Set();
    let nonEmpty = 0;
    for (const r of rows) {
      const v = r?.[c];
      if (notEmpty(v)) { set.add(String(v)); nonEmpty++; }
    }
    const unique = set.size;
    const uniquenessRatio = rows.length > 0 ? unique / rows.length : 0;

    if (unique > 0 && uniquenessRatio >= 0.8) {
      // Mostly unique → "Total <col>" with count
      tiles.push({
        key: `col-${c}`, icon: 'unique', accent: 'brand',
        label: `Total ${c}`,
        value: formatInteger(nonEmpty),
        sublabel: `${formatInteger(unique)} unique`,
      });
    } else if (unique > 0) {
      // Few categories → "<col>: N categories"
      tiles.push({
        key: `col-${c}`, icon: 'category', accent: 'purple',
        label: c,
        value: `${formatInteger(unique)} ${unique === 1 ? 'category' : 'categories'}`,
        sublabel: `${formatInteger(nonEmpty)} values`,
      });
    } else {
      tiles.push({
        key: `col-${c}`, icon: 'unique', accent: 'ink',
        label: c, value: '—', sublabel: 'no values',
      });
    }
  }
  return tiles;
}
