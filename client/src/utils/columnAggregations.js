// Role-aware aggregation options. Drives the Aggregation dropdowns so users
// only see operations that make sense for the column they picked as Y.

import { ROLES } from './columnReasoning.js';

export const AGG_LABEL = {
  sum:       'Sum',
  avg:       'Average',
  count:     'Count of rows',
  min:       'Minimum',
  max:       'Maximum',
  unique:    'Unique values',
  non_empty: 'Non-empty values',
  none:      'Latest value',
};

export const AGG_OPTIONS_FOR_ROLE = {
  metric:   ['sum', 'avg', 'min', 'max', 'count', 'none'],
  time:     ['count', 'unique'],
  category: ['count', 'unique'],
  text:     ['unique', 'count', 'non_empty'],
  id:       ['unique', 'count'],
  url:      ['count', 'non_empty'],
};

export const DEFAULT_AGG_FOR_ROLE = {
  metric:   'sum',
  time:     'count',
  category: 'count',
  text:     'unique',
  id:       'unique',
  url:      'count',
};

/**
 * Returns the list of aggregations that make sense for a given column.
 * Falls back to a safe set when no reasoning is available.
 */
export function aggOptionsFor(column, reasoning) {
  if (!column) return ['count'];
  const role = reasoning?.[column]?.role;
  return AGG_OPTIONS_FOR_ROLE[role] || ['sum', 'avg', 'count', 'min', 'max'];
}

export function defaultAggFor(column, reasoning) {
  if (!column) return 'count';
  const role = reasoning?.[column]?.role;
  return DEFAULT_AGG_FOR_ROLE[role] || 'sum';
}

/** Heal a chart config whose aggregation no longer matches the Y column type. */
export function reconcileAggregation(chart, reasoning) {
  const yField = chart.yField || (Array.isArray(chart.yFields) && chart.yFields[0]) || null;
  if (!yField) return chart.aggregation || 'count';
  const opts = aggOptionsFor(yField, reasoning);
  if (opts.includes(chart.aggregation)) return chart.aggregation;
  return defaultAggFor(yField, reasoning);
}

export { ROLES };
