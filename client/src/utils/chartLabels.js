import { CHART_TYPES } from './chartTransform.js';

const AGG_LABEL = {
  sum: 'Sum',
  avg: 'Average',
  count: 'Count',
  min: 'Minimum',
  max: 'Maximum',
  none: 'Latest',
};

const FILTER_OP_LABEL = {
  equals: 'equals',
  not_equals: 'is not',
  contains: 'contains',
  gt: 'greater than',
  gte: 'at least',
  lt: 'less than',
  lte: 'at most',
  not_empty: 'is set',
};

const DEFAULT_TITLES = new Set(['', 'Untitled chart', 'Chart', 'New chart']);
const DEFAULT_PREFIX = /^Chart\s+\d+$/i;

function isDefaultTitle(t) {
  if (!t) return true;
  const s = String(t).trim();
  if (DEFAULT_TITLES.has(s)) return true;
  if (DEFAULT_PREFIX.test(s)) return true;
  return false;
}

export function aggLabel(a) {
  return AGG_LABEL[a] || 'Sum';
}

function joinList(arr, max = 3) {
  if (!arr || arr.length === 0) return '';
  if (arr.length <= max) return arr.join(', ');
  return `${arr.slice(0, max).join(', ')} +${arr.length - max} more`;
}

export function valuePhrase(chart) {
  const ys = Array.isArray(chart.yFields) && chart.yFields.length > 0
    ? chart.yFields
    : (chart.yField ? [chart.yField] : []);
  if (ys.length === 0) return 'Number of rows';
  const a = aggLabel(chart.aggregation);
  if (ys.length >= 2) return `${a} of ${joinList(ys)}`;
  if (a === 'Count') return `Count of ${ys[0]}`;
  return `${a} of ${ys[0]}`;
}

export function describeChart(chart) {
  const x = chart.xField || '';
  const g = chart.groupBy || '';
  const ys = Array.isArray(chart.yFields) && chart.yFields.length > 0
    ? chart.yFields
    : (chart.yField ? [chart.yField] : []);
  const isMultiY = ys.length >= 2;
  const value = valuePhrase(chart);
  const breakdown = x ? ` per ${x}` : '';
  const grouped = g && !isMultiY ? ` (split by ${g})` : '';
  const subtitle = `${value}${breakdown}${grouped}`.trim();

  let autoTitle;
  if (isMultiY && x) autoTitle = `${joinList(ys)} by ${x}`;
  else if (ys[0] && x) autoTitle = `${ys[0]} by ${x}`;
  else if (x) autoTitle = `Distribution of ${x}`;
  else autoTitle = 'Untitled chart';

  const title = isDefaultTitle(chart.title) ? autoTitle : chart.title;
  const typeLabel = CHART_TYPES.find((t) => t.id === chart.type)?.name || chart.type;

  const yAxis = ys.length === 0
    ? 'Row count'
    : ys.length === 1
      ? `${aggLabel(chart.aggregation)} of ${ys[0]}`
      : `${aggLabel(chart.aggregation)} of ${joinList(ys)}`;

  return {
    title,
    autoTitle,
    subtitle,
    typeLabel,
    xAxis: x || null,
    yAxis,
    groupBy: g || null,
    aggregation: aggLabel(chart.aggregation),
  };
}

/**
 * Returns the unique list of sheet columns that a chart actually references —
 * used by the dashboard cards to show "Columns used: A · B · C" below each chart.
 */
export function columnsUsed(chart) {
  if (!chart) return [];
  const seen = new Set();
  const out = [];
  const push = (c) => {
    if (!c || seen.has(c)) return;
    seen.add(c);
    out.push(c);
  };
  push(chart.xField);
  push(chart.yField);
  if (Array.isArray(chart.yFields)) chart.yFields.forEach(push);
  push(chart.groupBy);
  if (Array.isArray(chart.filters)) chart.filters.forEach((f) => push(f && f.field));
  return out;
}

export function formatFilter(f) {
  if (!f || !f.field) return '';
  const op = FILTER_OP_LABEL[f.op] || f.op;
  if (f.op === 'not_empty') return `${f.field} ${op}`;
  return `${f.field} ${op} ${f.value ?? ''}`.trim();
}

function readingHint(type) {
  switch (type) {
    case 'bar':
    case 'horizontalBar':
      return 'Taller (or longer) bars mean higher values.';
    case 'stackedBar':
      return 'Each bar is split by category — taller stacks mean a higher total.';
    case 'line':
      return 'Higher peaks mean higher values; the line shows how things change.';
    case 'area':
      return 'Higher and wider areas mean larger values across the range.';
    case 'donut':
      return 'Bigger slices mean a larger share of the total.';
    case 'radial':
      return 'Longer rings mean higher values.';
    case 'scatter':
      return 'Each dot is one row — clusters or trends suggest correlation.';
    case 'treemap':
      return 'Bigger rectangles mean larger values.';
    case 'funnel':
      return 'Wider sections sit at the top — drop-off is the gap to the next layer.';
    case 'heatmap':
      return 'Darker cells mean higher values for that combination.';
    case 'waterfall':
      return 'Green bars are increases, red bars are decreases — the line lands on the running total.';
    default:
      return '';
  }
}

export function explainChart(chart) {
  if (!chart || !chart.xField) {
    return 'Pick a column for the X axis to see what this chart will show.';
  }
  const x = chart.xField;
  const ys = Array.isArray(chart.yFields) && chart.yFields.length > 0
    ? chart.yFields
    : (chart.yField ? [chart.yField] : []);
  const isMultiY = ys.length >= 2;
  const g = chart.groupBy;
  const a = chart.aggregation;

  let valueText;
  if (isMultiY) {
    const verb =
      a === 'count' ? 'count'
      : a === 'avg' ? 'average'
      : a === 'min' ? 'minimum'
      : a === 'max' ? 'maximum'
      : a === 'none' ? 'latest'
      : 'total';
    valueText = `the ${verb} of ${joinList(ys)}`;
  } else if (ys.length === 0) {
    valueText = 'how many rows there are';
  } else {
    const y = ys[0];
    if (a === 'count') valueText = `the count of ${y}`;
    else if (a === 'avg') valueText = `the average ${y}`;
    else if (a === 'min') valueText = `the smallest ${y}`;
    else if (a === 'max') valueText = `the largest ${y}`;
    else if (a === 'none') valueText = `the latest ${y}`;
    else valueText = `the total ${y}`;
  }

  const split = g && !isMultiY ? `, broken down by ${g}` : '';
  const hint = readingHint(chart.type);

  return `This chart shows ${valueText} for each ${x}${split}. ${hint}`.trim();
}
