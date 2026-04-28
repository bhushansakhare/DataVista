// Builds a professional, opinionated dashboard layout from a sheet's columns.
// Always produces the same four-slot structure (when the data permits):
//   1. Main combined chart  — Bar, X = primary axis, multi-Y of numerics
//   2. Distribution donut    — first low-cardinality category, count
//   3. Distribution bar      — second category, count
//   4. Trend line            — Date × first numeric (or count over time)
//
// Slots that don't fit the dataset are skipped (so a text-only sheet returns
// fewer charts) but the order is stable.

import { looksNumeric } from './chartTransform.js';

function makeId() {
  return Math.random().toString(36).slice(2);
}

function chart(overrides) {
  return {
    id: makeId(),
    type: 'bar',
    title: '',
    xField: '',
    yField: '',
    yFields: [],
    groupBy: '',
    aggregation: 'sum',
    filters: [],
    config: {},
    layout: { x: 0, y: 0, w: 6, h: 4 },
    ...overrides,
  };
}

/**
 * @param {object} args
 * @param {string[]} args.plottableCols  — every selected column except URLs
 * @param {object}   args.types          — sheet.detectedTypes
 * @param {object[]} args.rows           — sheet.rawData (used for `looksNumeric`)
 * @returns {{numerics: string[], dates: string[], texts: string[], slots: object[]}}
 */
export function planProfessionalDashboard({ plottableCols, types, rows }) {
  const numerics = plottableCols.filter(
    (c) => types[c] === 'number' || (types[c] !== 'date' && looksNumeric(rows, c))
  );
  const dates = plottableCols.filter((c) => types[c] === 'date');
  const texts = plottableCols.filter(
    (c) => !numerics.includes(c) && types[c] !== 'date'
  );

  const slots = [];

  // 1. Main combined chart
  const mainX = dates[0] || texts[0] || numerics[0];
  if (mainX) {
    if (numerics.length >= 2) {
      slots.push({
        kind: 'main',
        label: 'Combined metrics',
        chart: chart({
          type: 'bar',
          xField: mainX,
          yFields: numerics,
          aggregation: 'sum',
        }),
      });
    } else if (numerics.length === 1) {
      slots.push({
        kind: 'main',
        label: numerics[0] + ' by ' + mainX,
        chart: chart({
          type: 'bar',
          xField: mainX,
          yField: numerics[0],
          aggregation: 'sum',
        }),
      });
    } else {
      slots.push({
        kind: 'main',
        label: 'Records by ' + mainX,
        chart: chart({
          type: 'bar',
          xField: mainX,
          aggregation: 'count',
        }),
      });
    }
  }

  // 2. Distribution donut on first text (or first date as fallback)
  const donutX = texts[0] || (texts.length === 0 ? dates[0] : null);
  if (donutX) {
    slots.push({
      kind: 'distribution',
      label: donutX + ' distribution',
      chart: chart({
        type: 'donut',
        xField: donutX,
        aggregation: 'count',
      }),
    });
  }

  // 3. Distribution bar on a *different* category
  const secondCat = texts[1] || (texts[0] && dates[0] !== mainX ? dates[0] : null);
  if (secondCat && secondCat !== donutX) {
    slots.push({
      kind: 'distribution',
      label: secondCat + ' breakdown',
      chart: chart({
        type: 'bar',
        xField: secondCat,
        aggregation: 'count',
      }),
    });
  }

  // 4. Trend line
  if (dates[0]) {
    if (numerics[0]) {
      slots.push({
        kind: 'trend',
        label: numerics[0] + ' trend',
        chart: chart({
          type: 'line',
          xField: dates[0],
          yField: numerics[0],
          aggregation: 'sum',
        }),
      });
    } else {
      slots.push({
        kind: 'trend',
        label: 'Records over time',
        chart: chart({
          type: 'line',
          xField: dates[0],
          aggregation: 'count',
        }),
      });
    }
  } else if (numerics[0] && texts[0]) {
    // No date — fall back to category × first numeric
    slots.push({
      kind: 'trend',
      label: numerics[0] + ' over ' + texts[0],
      chart: chart({
        type: 'line',
        xField: texts[0],
        yField: numerics[0],
        aggregation: 'sum',
      }),
    });
  }

  return { numerics, dates, texts, slots };
}

export function buildProfessionalCharts(args) {
  return planProfessionalDashboard(args).slots.map((s) => s.chart);
}
