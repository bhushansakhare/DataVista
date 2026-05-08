import { detectUnit, getFormatter, formatInteger } from './formatValue.js';
import { fmtDate } from './format.js';
import { applyFilters } from './chartTransform.js';

function num(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function summarizeColumn(rows, column, type) {
  const values = rows.map((r) => r[column]).filter((v) => v !== null && v !== undefined && v !== '');
  if (type === 'number') {
    const nums = values.map(num).filter((v) => v !== null);
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = nums.length ? sum / nums.length : 0;
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;
    return { kind: 'number', count: nums.length, sum, avg, min, max };
  }
  if (type === 'date') {
    const ts = values.map((v) => Date.parse(v)).filter((t) => Number.isFinite(t));
    const min = ts.length ? new Date(Math.min(...ts)) : null;
    const max = ts.length ? new Date(Math.max(...ts)) : null;
    return { kind: 'date', count: ts.length, min, max };
  }
  // string
  const set = new Set(values.map((v) => String(v)));
  return { kind: 'string', count: values.length, unique: set.size };
}

/**
 * Pick up to 4 high-signal stat cards for the top of a dashboard.
 * - Always shows Total rows
 * - Picks the most populated numeric column for Sum/Avg
 * - Picks the most diverse categorical for Unique counts
 * - Picks the widest date column for Coverage range
 */
export function summarizeSheet(sheet) {
  if (!sheet) return [];
  const rows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const cols = Array.isArray(sheet.columns) ? sheet.columns : [];
  const types = sheet.detectedTypes || {};
  const selected =
    Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : cols;
  const visible = cols.filter((c) => selected.includes(c));

  const stats = [];

  stats.push({
    icon: 'rows',
    label: 'Total rows',
    value: formatInteger(rows.length),
    sublabel: `${visible.length} column${visible.length === 1 ? '' : 's'}`,
  });

  // Best numeric column = most non-null values
  const numericCols = visible.filter((c) => types[c] === 'number');
  if (numericCols.length) {
    let best = numericCols[0];
    let bestCount = -1;
    for (const c of numericCols) {
      const s = summarizeColumn(rows, c, 'number');
      if (s.count > bestCount) { best = c; bestCount = s.count; }
    }
    const s = summarizeColumn(rows, best, 'number');
    const sample = rows.slice(0, 50).map((r) => r[best]);
    const unit = detectUnit(best, sample);
    const fmt = getFormatter(unit);
    stats.push({
      icon: 'sum',
      label: `Sum · ${best}`,
      value: fmt(s.sum),
      sublabel: `avg ${fmt(s.avg)} · ${formatInteger(s.count)} rows`,
    });
  }

  // Best categorical column = highest non-trivial unique count
  const stringCols = visible.filter((c) => types[c] === 'string');
  if (stringCols.length) {
    let best = stringCols[0];
    let bestUnique = -1;
    for (const c of stringCols) {
      const s = summarizeColumn(rows, c, 'string');
      if (s.unique > bestUnique && s.unique <= rows.length) {
        best = c; bestUnique = s.unique;
      }
    }
    const s = summarizeColumn(rows, best, 'string');
    stats.push({
      icon: 'unique',
      label: `Unique · ${best}`,
      value: formatInteger(s.unique),
      sublabel: 'distinct values',
    });
  }

  // Widest date column
  const dateCols = visible.filter((c) => types[c] === 'date');
  if (dateCols.length) {
    let best = dateCols[0];
    let bestSpan = -1;
    for (const c of dateCols) {
      const s = summarizeColumn(rows, c, 'date');
      const span = s.min && s.max ? s.max - s.min : 0;
      if (span > bestSpan) { best = c; bestSpan = span; }
    }
    const s = summarizeColumn(rows, best, 'date');
    if (s.min && s.max) {
      stats.push({
        icon: 'date',
        label: 'Data coverage',
        value: `From ${fmtDate(s.min)}`,
        sublabel: `to ${fmtDate(s.max)}`,
      });
    }
  }

  // Pad to 4 cards if we have fewer
  while (stats.length < 4 && visible.length > stats.length - 1) {
    const idx = stats.length - 1;
    const candidate = visible[idx];
    if (!candidate) break;
    stats.push({
      icon: 'col',
      label: candidate,
      value: types[candidate] || 'string',
      sublabel: 'detected type',
    });
  }

  return stats.slice(0, 4);
}

/* ─────────── advanced KPI surface ─────────── */

function notEmpty(v) {
  return v !== null && v !== undefined && v !== '';
}

/**
 * Filter-aware data-quality summary used by KpiGrid and the column-profile table.
 * @returns {{
 *   totalRows, totalColumns,
 *   filteredFromRows,            // original (unfiltered) row count for context
 *   duplicates, missingTotal, completeness,
 *   topNumeric, topCategorical, dateRange,
 *   perColumn: Object<string, { type, total, missing, missingPct, unique, uniquePct }>
 * }}
 */
export function summarizeAdvanced(sheet, filters = []) {
  if (!sheet) return null;
  const allRows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const rows = applyFilters(allRows, filters || []);
  const allCols = Array.isArray(sheet.columns) ? sheet.columns : [];
  const selected =
    Array.isArray(sheet.selectedColumns) && sheet.selectedColumns.length
      ? sheet.selectedColumns
      : allCols;
  const cols = allCols.filter((c) => selected.includes(c));
  const types = sheet.detectedTypes || {};

  const perColumn = {};
  let missingTotal = 0;

  for (const col of cols) {
    const vals = rows.map((r) => r?.[col]);
    const nonEmptyVals = vals.filter(notEmpty);
    const unique = new Set(nonEmptyVals.map(String)).size;
    const missing = vals.length - nonEmptyVals.length;
    missingTotal += missing;
    perColumn[col] = {
      type: types[col] || 'string',
      total: vals.length,
      missing,
      missingPct: vals.length ? missing / vals.length : 0,
      unique,
      uniquePct: vals.length ? unique / vals.length : 0,
    };
  }

  // Duplicates (over visible columns)
  let duplicates = 0;
  if (cols.length > 0) {
    const fps = new Map();
    for (const r of rows) {
      const key = cols.map((c) => String(r?.[c] ?? '')).join('||');
      fps.set(key, (fps.get(key) || 0) + 1);
    }
    for (const count of fps.values()) if (count > 1) duplicates += count - 1;
  }

  const totalCells = rows.length * cols.length;
  const completeness = totalCells ? 1 - missingTotal / totalCells : 1;

  // Surface a "best metric" / "best categorical" / "date range" so KpiGrid
  // can show one extra signal beyond the data-quality basics.
  const numericCols = cols.filter((c) => types[c] === 'number');
  const stringCols = cols.filter((c) => types[c] === 'string');
  const dateCols = cols.filter((c) => types[c] === 'date');

  let topNumeric = null;
  if (numericCols.length) {
    let best = numericCols[0];
    let bestSum = -Infinity;
    for (const c of numericCols) {
      const sum = rows.reduce((s, r) => {
        const n = Number(r?.[c]);
        return s + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (sum > bestSum) { best = c; bestSum = sum; }
    }
    const sample = rows.slice(0, 80).map((r) => r?.[best]);
    const unit = detectUnit(best, sample);
    const fmt = getFormatter(unit);
    topNumeric = { name: best, sum: bestSum, formatted: fmt(bestSum) };
  }

  let topCategorical = null;
  if (stringCols.length) {
    let best = stringCols[0];
    let bestUnique = -1;
    for (const c of stringCols) {
      const u = perColumn[c]?.unique ?? 0;
      if (u > bestUnique && u <= rows.length) { best = c; bestUnique = u; }
    }
    topCategorical = { name: best, unique: perColumn[best]?.unique ?? 0 };
  }

  let dateRange = null;
  if (dateCols.length) {
    let best = dateCols[0];
    let bestSpan = -1;
    let bestMin = null;
    let bestMax = null;
    for (const c of dateCols) {
      const ts = rows
        .map((r) => Date.parse(r?.[c]))
        .filter((t) => Number.isFinite(t));
      if (!ts.length) continue;
      const min = Math.min(...ts);
      const max = Math.max(...ts);
      const span = max - min;
      if (span > bestSpan) {
        bestSpan = span;
        best = c;
        bestMin = min;
        bestMax = max;
      }
    }
    if (bestMin && bestMax) {
      dateRange = {
        name: best,
        from: fmtDate(new Date(bestMin)),
        to: fmtDate(new Date(bestMax)),
      };
    }
  }

  return {
    totalRows: rows.length,
    totalColumns: cols.length,
    filteredFromRows: allRows.length,
    duplicates,
    missingTotal,
    completeness,
    topNumeric,
    topCategorical,
    dateRange,
    perColumn,
  };
}
