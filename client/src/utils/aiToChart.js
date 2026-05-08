// Translate the AI's dashboard suggestion into the dashboard model shape.
//
// v4 — column-reference architecture.
// The AI specifies each chart with EXACT column names (xField/yField). The
// frontend's aggregation engine reads the full dataset and computes the
// real values at render time. The AI never embeds chart data — its 25-row
// sample isn't enough to compute trustworthy totals.
//
// VALIDATION (kept minimal):
//   - `type` must be in the renderer's allow-list.
//   - `xField` AND `yField` must reference real columns from `sheet.columns`.
//
// FILTERING:
//   - Drop charts whose type is invalid or whose xField/yField aren't in the
//     dataset (i.e. AI hallucinations).
//
// Everything else passes through. Title/label truncation, count clamping,
// "Others" merging — none of that happens here. The AI is the designer; the
// renderer's `simplifyForChart` enforces visual caps.

const ALLOWED_CHART_TYPES = new Set([
  'bar',
  'line',
  'donut',
  'area',
  'stackedBar',
  'horizontalBar',
  'scatter',
  'treemap',
  'funnel',
  'radial',
  'heatmap',
  'waterfall',
]);

let _idCounter = 0;
function chartId() {
  _idCounter += 1;
  return `ai-${Date.now().toString(36)}-${_idCounter}`;
}

/**
 * Translate one AI chart spec into a dashboard chart object.
 *
 * Returns null (chart dropped) when:
 *   - `type` is not in ALLOWED_CHART_TYPES, or
 *   - `xField` / `yField` don't reference real columns in the sheet.
 *
 * The dashboard model needs a few extra fields (`yFields`, `groupBy`,
 * `aggregation`, `filters`, `config`) that the AI doesn't emit — those are
 * filled with neutral defaults so the chart renders.
 */
export function aiChartToDashboard(aiChart, validColumns) {
  if (!aiChart || typeof aiChart !== 'object') return null;
  if (!ALLOWED_CHART_TYPES.has(aiChart.type)) return null;

  const cols = new Set(validColumns || []);
  const xField = aiChart.xField && cols.has(aiChart.xField) ? aiChart.xField : '';
  const yField = aiChart.yField && cols.has(aiChart.yField) ? aiChart.yField : '';
  if (!xField || !yField) return null;

  const groupBy = aiChart.groupBy && cols.has(aiChart.groupBy) ? aiChart.groupBy : '';
  const title = aiChart.simpleTitle || aiChart.title || `${yField} by ${xField}`;
  const config = {};
  if (aiChart.explanation) config.explanation = aiChart.explanation;

  return {
    id: chartId(),
    type: aiChart.type,
    title,
    xField,
    yField,
    yFields: [yField],
    groupBy,
    aggregation: aiChart.aggregation || 'sum',
    filters: [],
    config,
  };
}

/**
 * Translate a full AI suggestion (or generated dashboard) into a dashboard
 * payload. KPIs and insights are passed through verbatim.
 *
 * The first chart is marked `config.hero = true` — the dashboard view
 * renders it full-width as the headline; the rest go into a 2-col grid.
 */
export function aiSuggestionToDashboard(suggestion, sheet) {
  const validColumns = Array.isArray(sheet?.columns) ? sheet.columns : [];
  const charts = (suggestion?.charts || [])
    .map((c) => aiChartToDashboard(c, validColumns))
    .filter(Boolean);
  if (charts[0]) {
    charts[0].config = { ...(charts[0].config || {}), hero: true };
  }

  return {
    sheetId: sheet?._id,
    title: suggestion?.title || 'AI Dashboard',
    description: suggestion?.summary || suggestion?.description || suggestion?.useCase || '',
    charts,
    kpis: Array.isArray(suggestion?.kpis) ? suggestion.kpis : [],
    insights: Array.isArray(suggestion?.insights) ? suggestion.insights : [],
    templateId: typeof suggestion?.templateId === 'string' ? suggestion.templateId : '',
    layoutType: typeof suggestion?.layoutType === 'string' ? suggestion.layoutType : '',
    styleConfig: (suggestion?.styleConfig && typeof suggestion.styleConfig === 'object')
      ? suggestion.styleConfig : undefined,
    // Raw-HTML / URL template snapshot — when set, the saved dashboard view
    // renders these via a sandboxed iframe instead of the chart pipeline.
    templateType: typeof suggestion?.templateType === 'string' ? suggestion.templateType : '',
    templateCode: typeof suggestion?.templateCode === 'string' ? suggestion.templateCode : '',
    templateUrl:  typeof suggestion?.templateUrl  === 'string' ? suggestion.templateUrl  : '',
    layout: 'grid',
    theme: suggestion?.theme === 'dark' ? 'dark' : 'light',
  };
}
