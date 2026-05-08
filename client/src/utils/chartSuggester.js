// Rule-based chart suggester. Picks both a chart TYPE and the X/Y/groupBy/agg
// configuration in a single pass, returning the rationale for every choice so
// the ChartExplanationPanel can show "rule N fired".

import { reasonColumns, ROLES, colsByRole, pickFirstByRole } from './columnReasoning.js';
import { defaultAggFor } from './columnAggregations.js';

/**
 * Profile shape used by the rule predicates:
 *   { numerics, dates, cats, texts }
 * — counts of each role from the live reasoning.
 */
const TYPE_RULES = [
  {
    match: (p) => p.dates >= 1 && p.numerics === 1,
    type: 'line',
    why: 'Date + one metric → trend line over time.',
  },
  {
    match: (p) => p.dates >= 1 && p.numerics >= 2,
    type: 'bar',
    why: 'Date + multiple metrics → grouped bars per period.',
  },
  {
    match: (p) => p.cats === 1 && p.numerics >= 2,
    type: 'stackedBar',
    why: 'One category + multiple metrics → stacked bars.',
  },
  {
    match: (p) => p.cats === 1 && p.numerics === 1,
    type: 'bar',
    why: 'One category + one metric → bar chart.',
  },
  {
    match: (p) => p.cats >= 2 && p.numerics >= 1,
    type: 'stackedBar',
    why: 'Two categories + a metric → stacked bars with grouping.',
  },
  {
    match: (p) => p.cats >= 2 && p.numerics === 0,
    type: 'heatmap',
    why: 'Two categories, no numeric → density heatmap of counts.',
  },
  {
    match: (p) => p.cats === 1 && p.numerics === 0,
    type: 'donut',
    why: 'One category, no numeric → distribution donut of row counts.',
  },
  {
    match: (p) => p.dates >= 1 && p.numerics === 0,
    type: 'line',
    why: 'Date column only → line chart of records over time.',
  },
  {
    match: (p) => p.numerics >= 1,
    type: 'bar',
    why: 'Numeric data only → bar chart.',
  },
  {
    match: () => true,
    type: 'bar',
    why: 'Default fallback chart type.',
  },
];

function pickType(profile) {
  for (const rule of TYPE_RULES) {
    if (rule.match(profile)) return { type: rule.type, why: rule.why };
  }
  return { type: 'bar', why: 'Default fallback chart type.' };
}

/**
 * @param {object} sheet                           Full sheet (columns/types/rawData)
 * @param {object} [opts]
 * @param {object} [opts.reasoning]                Pre-computed reasoning (perf)
 * @returns {{
 *   config: object,
 *   rationale: { field: string, value: any, reason: string }[],
 *   excluded: { col: string, reason: string }[],
 *   profile:  { numerics: number, dates: number, cats: number, texts: number },
 *   ruleFired: string,
 * }}
 */
export function suggestChart(sheet, opts = {}) {
  const reasoning = opts.reasoning || reasonColumns(sheet);
  const time = pickFirstByRole(reasoning, ROLES.TIME);
  const cats = colsByRole(reasoning, ROLES.CATEGORY);
  const metrics = colsByRole(reasoning, ROLES.METRIC);
  const ignored = colsByRole(reasoning, ROLES.LINK, ROLES.IDENTIFIER, ROLES.TEXT);

  const profile = {
    numerics: metrics.length,
    dates: time ? 1 : 0,
    cats: cats.length,
    texts: colsByRole(reasoning, ROLES.TEXT).length,
  };

  // Refuse to chart a sheet with nothing useful
  if (profile.numerics === 0 && profile.dates === 0 && profile.cats === 0) {
    return {
      config: { type: 'bar', xField: '', yField: '', yFields: [], groupBy: '', aggregation: 'count', filters: [] },
      rationale: [{
        field: 'Chart type',
        value: 'none',
        reason: 'No chartable columns found — every column is either a URL, an identifier, or high-cardinality text. Use the data table instead.',
      }],
      excluded: ignored.map((col) => ({ col, reason: reasoning[col]?.why || 'Not suitable for charting.' })),
      profile,
      ruleFired: 'no-chartable-columns',
    };
  }

  const { type, why: typeWhy } = pickType(profile);

  // Pick fields to fit the chosen type.
  let xField = '';
  let yField = '';
  let yFields = [];
  let groupBy = '';

  if (type === 'donut' || type === 'radial' || type === 'treemap' || type === 'funnel') {
    xField = cats[0] || time || metrics[0] || '';
  } else if (type === 'heatmap') {
    xField = cats[0] || time || '';
    groupBy = cats[1] || time || '';
    yField = metrics[0] || '';
  } else if (type === 'stackedBar') {
    xField = time || cats[0] || '';
    if (metrics.length >= 2) {
      yFields = metrics;
    } else if (metrics.length === 1) {
      yField = metrics[0];
      groupBy = cats[1] || cats[0] || '';
      if (groupBy === xField) groupBy = cats[1] || '';
    } else {
      groupBy = cats[1] || '';
    }
  } else if (type === 'scatter') {
    xField = metrics[0] || '';
    yField = metrics[1] || '';
  } else {
    // line / area / bar / horizontalBar
    xField = time || cats[0] || metrics[0] || '';
    if (metrics.length >= 2) yFields = metrics;
    else if (metrics.length === 1) yField = metrics[0];
  }

  // Aggregation respects column role.
  const aggSubject = yField || (yFields.length ? yFields[0] : null);
  const aggregation = aggSubject
    ? defaultAggFor(aggSubject, reasoning)
    : (xField ? 'count' : 'count');

  const rationale = [];
  rationale.push({ field: 'Chart type', value: type, reason: typeWhy });
  if (xField) {
    rationale.push({
      field: 'X-axis',
      value: xField,
      reason: reasoning[xField]?.why || 'Selected as primary axis.',
    });
  }
  if (yFields.length > 0) {
    rationale.push({
      field: 'Y-axis',
      value: yFields,
      reason: 'Numeric columns plotted as separate series.',
    });
  } else if (yField) {
    rationale.push({
      field: 'Y-axis',
      value: yField,
      reason: reasoning[yField]?.why || 'Numeric column plotted as the value.',
    });
  } else {
    rationale.push({
      field: 'Y-axis',
      value: 'Row count',
      reason: 'No numeric column found — chart counts the rows instead.',
    });
  }
  if (groupBy) {
    rationale.push({
      field: 'Group by',
      value: groupBy,
      reason: reasoning[groupBy]?.why || 'Splits each X bucket by this category.',
    });
  }
  rationale.push({
    field: 'Aggregation',
    value: aggregation,
    reason:
      aggregation === 'sum'      ? 'Default for total-style metrics.'
      : aggregation === 'unique' ? 'Counts distinct values — best for text or identifier columns.'
      : aggregation === 'count'  ? 'Counts rows per X-axis value.'
      : 'Picked based on the Y column type.',
  });

  const excluded = ignored.map((col) => ({
    col,
    reason: reasoning[col]?.why || 'Not suitable for charting.',
  }));

  return {
    config: {
      type,
      title: '',
      xField,
      yField,
      yFields,
      groupBy,
      aggregation,
      filters: [],
    },
    rationale,
    excluded,
    profile,
    ruleFired: typeWhy,
  };
}
