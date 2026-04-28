// Smart, column-aware value formatting so chart axes & tooltips read like
// "349.10 GB" / "$1.2M" / "67.3%" instead of "349100000000".

const BYTE_NAMES = /\b(size|bytes?|storage|disk|memory|capacity|volume|filesize)\b/i;
const CURRENCY_NAMES = /\b(price|cost|revenue|profit|sales|amount|total|fee|salary|budget|usd|inr|eur|gbp|spend|mrr|arr)\b/i;
const PERCENT_NAMES = /\b(percent|percentage|ratio|rate|share|pct|conversion)\b/i;
const COUNT_NAMES = /\b(count|qty|quantity|number|items?|orders?|users?|sessions?|visits?|clicks?)\b/i;
const DURATION_NAMES = /\b(duration|elapsed|seconds?|minutes?|hours?|days?|length|runtime|playtime|watchtime)\b/i;

export function detectUnit(columnName, sampleValues) {
  if (!columnName) return 'number';
  const name = String(columnName);
  if (PERCENT_NAMES.test(name)) return 'percent';
  if (BYTE_NAMES.test(name)) {
    const max = (sampleValues || []).reduce(
      (m, v) => Math.max(m, Math.abs(Number(v) || 0)),
      0
    );
    // values ≥ ~1MB look like raw bytes; smaller look like already-converted units
    return max > 1_000_000 ? 'bytes' : 'bytes-small';
  }
  if (CURRENCY_NAMES.test(name)) return 'currency';
  if (DURATION_NAMES.test(name)) return 'duration';
  if (COUNT_NAMES.test(name)) return 'integer';
  return 'number';
}

export function formatBytes(n, decimals = 2) {
  if (!Number.isFinite(n)) return '–';
  if (n === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(Math.abs(n)) / Math.log(k));
  const idx = Math.min(Math.max(i, 0), units.length - 1);
  const v = n / Math.pow(k, idx);
  return `${v.toFixed(idx === 0 ? 0 : decimals)} ${units[idx]}`;
}

export function formatBytesSmall(n) {
  // for values already in MB-ish range
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) >= 1024) return `${(n / 1024).toFixed(2)} GB`;
  return `${n.toFixed(2)} MB`;
}

export function formatCurrency(n) {
  if (!Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

export function formatPercent(n) {
  if (!Number.isFinite(n)) return '–';
  return `${Number(n).toFixed(1)}%`;
}

export function formatInteger(n) {
  if (!Number.isFinite(n)) return '–';
  return Math.round(n).toLocaleString();
}

export function formatDuration(n) {
  if (!Number.isFinite(n)) return '–';
  const s = Math.abs(n);
  if (s >= 86400) return `${(s / 86400).toFixed(1)}d`;
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`;
  if (s >= 60) return `${(s / 60).toFixed(1)}m`;
  return `${s.toFixed(0)}s`;
}

export function formatNumber(n) {
  if (!Number.isFinite(n)) return '–';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

export function getFormatter(unit) {
  switch (unit) {
    case 'bytes': return formatBytes;
    case 'bytes-small': return formatBytesSmall;
    case 'currency': return formatCurrency;
    case 'percent': return formatPercent;
    case 'integer': return formatInteger;
    case 'duration': return formatDuration;
    default: return formatNumber;
  }
}

export function unitLabel(unit) {
  switch (unit) {
    case 'bytes':
    case 'bytes-small': return 'Storage';
    case 'currency': return 'Amount';
    case 'percent': return 'Percentage';
    case 'duration': return 'Time';
    case 'integer': return 'Count';
    default: return 'Value';
  }
}

export function formatterForColumn(columnName, sampleValues) {
  return getFormatter(detectUnit(columnName, sampleValues));
}
