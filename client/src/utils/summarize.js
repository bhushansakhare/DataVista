import { detectUnit, getFormatter, formatInteger } from './formatValue.js';
import { fmtDate } from './format.js';

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
