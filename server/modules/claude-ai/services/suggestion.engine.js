import { callStructured, buildDatasetBlock, isAiAvailable } from './claude.service.js';
import { SUGGESTION_SYSTEM_PROMPT } from '../prompts/suggestion.prompt.js';

// NOTE: Anthropic structured outputs reject `minItems` > 1 and any `maxItems`
// on arrays. Counts are guided by the system prompt + clamped post-call.
const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    dashboards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          useCase: { type: 'string' },
          charts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['line', 'bar', 'donut', 'area', 'scatter', 'table'],
                },
                xField: { type: 'string' },
                yField: { type: 'string' },
                groupBy: { type: 'string' },
                aggregation: {
                  type: 'string',
                  enum: ['sum', 'avg', 'count', 'min', 'max'],
                },
              },
              required: ['type', 'xField', 'yField'],
              additionalProperties: false,
            },
          },
          kpis: { type: 'array', items: { type: 'string' } },
          insight: { type: 'string' },
        },
        required: ['title', 'useCase', 'charts', 'kpis', 'insight'],
        additionalProperties: false,
      },
    },
  },
  required: ['dashboards'],
  additionalProperties: false,
};

const DASHBOARD_MAX = 5;
const CHART_MAX = 5;

export async function generateSuggestions(sheetData) {
  if (!isAiAvailable()) {
    return { dashboards: heuristicSuggestions(sheetData), source: 'fallback' };
  }
  const datasetBlock = buildDatasetBlock(sheetData);
  const userPrompt =
    `${datasetBlock}\n\n` +
    `Produce 4–${DASHBOARD_MAX} dashboard suggestions following the schema. ` +
    `Each dashboard should have 3–${CHART_MAX} charts and 2–4 KPI labels.`;
  const result = await callStructured({
    systemPrompt: SUGGESTION_SYSTEM_PROMPT,
    userPrompt,
    schema: SUGGESTION_SCHEMA,
  });
  return { dashboards: clampSuggestions(result.dashboards), source: 'claude' };
}

/** Truncate to spec — defense in depth in case the model overshoots. */
function clampSuggestions(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, DASHBOARD_MAX).map((d) => ({
    ...d,
    charts: Array.isArray(d.charts) ? d.charts.slice(0, CHART_MAX) : [],
    kpis: Array.isArray(d.kpis) ? d.kpis.slice(0, 6) : [],
  }));
}

/* ─── Heuristic fallback (used when ANTHROPIC_API_KEY is missing) ─── */

function heuristicSuggestions(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData : [];
  if (rows.length === 0) return [];
  const cols = Object.keys(rows[0] || {});
  const numeric = cols.filter((c) => Number.isFinite(Number(rows[0]?.[c])));
  const categorical = cols.filter((c) => !numeric.includes(c));
  const x = categorical[0] || cols[0];
  const y = numeric[0] || cols[1] || cols[0];
  const types = ['bar', 'line', 'donut', 'area'];
  return types.map((type) => ({
    title: `${y} by ${x} (${type})`,
    useCase: `Compare ${y} across ${x}`,
    charts: [
      { type, xField: x, yField: y, aggregation: 'sum' },
      { type: 'table', xField: x, yField: y, aggregation: 'count' },
      { type: 'donut', xField: x, yField: y, aggregation: 'sum' },
    ],
    kpis: [`Total ${y}`, `Average ${y}`, `Unique ${x}`],
    insight: `Distribution of ${y} across ${x} (heuristic — AI unavailable).`,
    _fallback: true,
  }));
}
