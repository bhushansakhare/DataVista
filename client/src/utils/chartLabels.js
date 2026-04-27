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

export function valuePhrase(chart) {
  const y = chart.yField;
  if (!y) return 'Number of rows';
  const a = aggLabel(chart.aggregation);
  if (a === 'Count') return `Count of ${y}`;
  return `${a} of ${y}`;
}

export function describeChart(chart) {
  const x = chart.xField || '';
  const g = chart.groupBy || '';
  const value = valuePhrase(chart);
  const breakdown = x ? ` per ${x}` : '';
  const grouped = g ? ` (split by ${g})` : '';
  const subtitle = `${value}${breakdown}${grouped}`.trim();

  let autoTitle;
  if (chart.yField && chart.xField) autoTitle = `${chart.yField} by ${chart.xField}`;
  else if (chart.xField) autoTitle = `Distribution of ${chart.xField}`;
  else autoTitle = 'Untitled chart';

  const title = isDefaultTitle(chart.title) ? autoTitle : chart.title;
  const typeLabel = CHART_TYPES.find((t) => t.id === chart.type)?.name || chart.type;

  return {
    title,
    autoTitle,
    subtitle,
    typeLabel,
    xAxis: x || null,
    yAxis: chart.yField ? `${aggLabel(chart.aggregation)} of ${chart.yField}` : 'Row count',
    groupBy: g || null,
    aggregation: aggLabel(chart.aggregation),
  };
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
  const y = chart.yField;
  const g = chart.groupBy;
  const a = chart.aggregation;

  let valueText;
  if (!y) valueText = 'how many rows there are';
  else if (a === 'count') valueText = `the count of ${y}`;
  else if (a === 'avg') valueText = `the average ${y}`;
  else if (a === 'min') valueText = `the smallest ${y}`;
  else if (a === 'max') valueText = `the largest ${y}`;
  else if (a === 'none') valueText = `the latest ${y}`;
  else valueText = `the total ${y}`;

  const split = g ? `, broken down by ${g}` : '';
  const hint = readingHint(chart.type);

  return `This chart shows ${valueText} for each ${x}${split}. ${hint}`.trim();
}
