// Single source of truth for "why was this column classified this way".
// Pure function — every UI element that explains a column reads from here.

import { analyzeSheet } from './columnInsights.js';

export const ROLES = {
  TIME: 'time',           // X-axis time-series candidate
  CATEGORY: 'category',   // X-axis or groupBy
  METRIC: 'metric',       // Y-axis numeric value
  IDENTIFIER: 'id',       // Table-only
  LINK: 'url',            // Clickable link in the table
  TEXT: 'text',           // High-cardinality text — table-only
};

const ROLE_LABEL = {
  time:     'Best for X-axis (time series)',
  category: 'Best for X-axis or grouping',
  metric:   'Best for Y-axis (numeric value)',
  id:       'Identifier — shown in table only',
  url:      'Link — clickable in the data table',
  text:     'Free-form text — shown in table only',
};

/**
 * @param {object} sheet
 * @returns {Object<string, { role: string, label: string, why: string,
 *                            sample: any[], confidence: number }>}
 */
export function reasonColumns(sheet) {
  if (!sheet) return {};
  const a = analyzeSheet(sheet);
  const rows = Array.isArray(sheet.rawData) ? sheet.rawData : [];
  const out = {};

  const sampleOf = (col) =>
    rows
      .slice(0, 8)
      .map((r) => r?.[col])
      .filter((v) => v !== null && v !== undefined && v !== '')
      .slice(0, 3);

  const make = (role, why, sample, confidence) => ({
    role,
    label: ROLE_LABEL[role] || role,
    why,
    sample,
    confidence,
  });

  for (const c of a.numeric) {
    out[c.name] = make(
      ROLES.METRIC,
      'Detected as numeric — supports sum, average, min, max.',
      sampleOf(c.name),
      0.95
    );
  }
  for (const c of a.date) {
    out[c.name] = make(
      ROLES.TIME,
      'Values parse as dates — ideal X-axis for time-series.',
      sampleOf(c.name),
      0.95
    );
  }
  for (const c of a.category) {
    out[c.name] = make(
      ROLES.CATEGORY,
      `Only ${c.cardinality} distinct values — good for grouping or distribution.`,
      sampleOf(c.name),
      0.85
    );
  }
  for (const c of a.text) {
    out[c.name] = make(
      ROLES.TEXT,
      `${c.cardinality} distinct values — too many to chart cleanly.`,
      sampleOf(c.name),
      0.9
    );
  }
  for (const c of a.id) {
    out[c.name] = make(
      ROLES.IDENTIFIER,
      'Values are unique per row — looks like an identifier.',
      sampleOf(c.name),
      0.9
    );
  }
  for (const c of a.url) {
    out[c.name] = make(
      ROLES.LINK,
      'Values look like http(s) URLs — kept out of charts.',
      sampleOf(c.name),
      0.95
    );
  }
  return out;
}

/** Returns columns whose role matches one of `roles`. */
export function colsByRole(reasoning, ...roles) {
  return Object.entries(reasoning || {})
    .filter(([, r]) => roles.includes(r.role))
    .map(([col]) => col);
}

export function pickFirstByRole(reasoning, role) {
  const entry = Object.entries(reasoning || {}).find(([, r]) => r.role === role);
  return entry ? entry[0] : null;
}
