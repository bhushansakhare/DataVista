// Smart chart recommender. Analyses a sheet's columns and proposes
// 4-6 *distinct, meaningful* charts — each using a different combination of
// fields. Never proposes "by Date" for every chart, never uses URLs or IDs.

import { analyzeSheet } from './columnInsights.js';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function dedupKey(c) {
  return [c.type, c.xField || '', c.yField || '', c.groupBy || '', c.aggregation || ''].join('|');
}

function chartTemplate(overrides) {
  return {
    id: makeId(),
    type: 'bar',
    title: '',
    xField: '',
    yField: '',
    groupBy: '',
    aggregation: 'sum',
    filters: [],
    config: {},
    layout: { x: 0, y: 0, w: 6, h: 4 },
    insight: '',
    ...overrides,
  };
}

/**
 * @param {object} sheet
 * @param {object} [opts]
 * @param {number} [opts.max=6]  upper bound on returned charts
 * @returns {Array} chart configs ready to insert
 */
export function recommendCharts(sheet, opts = {}) {
  const max = opts.max ?? 6;
  const a = analyzeSheet(sheet);
  const { numeric, date, category } = a;
  const recs = [];
  const seen = new Set();

  function add(chart) {
    if (recs.length >= max) return;
    if (!chart.xField) return;
    const key = dedupKey(chart);
    if (seen.has(key)) return;
    seen.add(key);
    recs.push(chartTemplate(chart));
  }

  const numA = numeric[0]?.name || '';
  const numB = numeric[1]?.name || '';
  const numC = numeric[2]?.name || '';
  const dateA = date[0]?.name || '';
  const catA = category[0]?.name || '';
  const catB = category[1]?.name || '';
  const catC = category[2]?.name || '';

  // 1. Trend over time — date × top numeric, line chart
  if (dateA && numA) {
    add({
      type: 'line',
      xField: dateA,
      yField: numA,
      aggregation: 'sum',
      insight: `Trend of ${numA} over ${dateA}`,
    });
  }

  // 2. Top categories by primary metric — vertical bar
  if (catA && numA) {
    add({
      type: 'bar',
      xField: catA,
      yField: numA,
      aggregation: 'sum',
      insight: `${numA} broken down by ${catA}`,
    });
  }

  // 3. Distribution of records — donut, COUNT (different aggregation)
  if (catA) {
    add({
      type: 'donut',
      xField: catA,
      yField: '',
      aggregation: 'count',
      insight: `Share of records by ${catA}`,
    });
  }

  // 4. Secondary lens — second category × top numeric
  // (different X column from #2, so not a duplicate "by X" pattern)
  if (catB && numA) {
    add({
      type: 'horizontalBar',
      xField: catB,
      yField: numA,
      aggregation: 'sum',
      insight: `${numA} by ${catB}`,
    });
  } else if (catA && numB) {
    // Fallback: same X, *different* numeric metric
    add({
      type: 'horizontalBar',
      xField: catA,
      yField: numB,
      aggregation: 'sum',
      insight: `${numB} by ${catA}`,
    });
  } else if (catB) {
    add({
      type: 'bar',
      xField: catB,
      yField: '',
      aggregation: 'count',
      insight: `Count of records by ${catB}`,
    });
  }

  // 5. Cross-tab — primary category × top numeric, grouped by another category
  if (catA && numA && catB) {
    add({
      type: 'stackedBar',
      xField: catA,
      yField: numA,
      groupBy: catB,
      aggregation: 'sum',
      insight: `${numA} per ${catA}, split by ${catB}`,
    });
  }

  // 6. Treemap — biggest contributors view (different chart type, same intent as #2)
  if (catA && numA && recs.length < max) {
    add({
      type: 'treemap',
      xField: catA,
      yField: numA,
      aggregation: 'sum',
      insight: `Largest ${catA} buckets by ${numA}`,
    });
  }

  // Fallbacks if we still have room
  if (recs.length < 4) {
    if (dateA && numB) {
      add({
        type: 'area',
        xField: dateA,
        yField: numB,
        aggregation: 'sum',
        insight: `Trend of ${numB} over ${dateA}`,
      });
    }
    if (catC) {
      add({
        type: 'donut',
        xField: catC,
        yField: '',
        aggregation: 'count',
        insight: `Share of records by ${catC}`,
      });
    }
    if (numC && catA) {
      add({
        type: 'bar',
        xField: catA,
        yField: numC,
        aggregation: 'avg',
        insight: `Average ${numC} by ${catA}`,
      });
    }
  }

  return recs;
}
