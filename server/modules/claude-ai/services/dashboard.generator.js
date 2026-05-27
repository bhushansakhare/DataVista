import { callStructured, buildDatasetBlock, isAiAvailable } from './claude.service.js';
import { DASHBOARD_SYSTEM_PROMPT } from '../prompts/dashboard.prompt.js';
import { computeDashboardData } from '../../templates/deterministicEngine.js';

// AI-driven dashboard generator (v4 — column-reference architecture).
//
// THE AI'S JOB: read the dataset, pick the most important columns, and design
// the dashboard structure (KPIs, chart types, x/y column references, insights).
// The AI never invents data points — it only sees a 25-row sample, so any
// "data" array it produced would be hallucinated estimates.
//
// THE FRONTEND'S JOB: aggregate the FULL dataset against the columns the AI
// chose and render real, trustworthy values.
//
// Validation is structural only (handled by `callStructured`). The backend
// does NOT clamp, normalise, or reshape the AI's response.

// AI emits DATA ONLY — no theme, no mode, no colour, no styling. The
// frontend owns appearance entirely.
const DASHBOARD_SCHEMA = {
  type: 'object',
  properties: {
    title:   { type: 'string' },
    summary: { type: 'string' },

    kpis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label:       { type: 'string' },
          value:       { type: 'number' },
          description: { type: 'string' },
          trend:       { type: 'string', enum: ['up', 'down', 'stable'] },
        },
        required: ['label', 'value', 'description', 'trend'],
        additionalProperties: false,
      },
    },

    charts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          simpleTitle: { type: 'string' },
          explanation: { type: 'string' },
          type:        { type: 'string', enum: ['line', 'bar', 'donut', 'area'] },
          // REAL column references. The frontend's aggregation engine reads
          // these and computes values from the full dataset. NO `data` array.
          xField:      { type: 'string' },
          yField:      { type: 'string' },
        },
        required: ['simpleTitle', 'explanation', 'type', 'xField', 'yField'],
        additionalProperties: false,
      },
    },

    insights: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'kpis', 'charts', 'insights'],
  additionalProperties: false,
};

/**
 * When a template is selected, the AI's job changes: instead of designing the
 * whole dashboard, it FILLS the template's slots — each chart's type and
 * purpose are pre-decided; the AI picks xField/yField from the dataset.
 */
function buildTemplatePrompt({ datasetBlock, queryLine, template }) {
  const slots = template.chartSlots
    .map((s, i) => `  ${i + 1}. id="${s.id}", position="${s.position}", type="${s.type}", purpose="${s.purpose}", suggested title="${s.title}". Hint: ${s.hint}`)
    .join('\n');

  return `${datasetBlock}${queryLine}\n\n` +
    `MODE: TEMPLATE (${template.name}).\n` +
    `\n` +
    `You are NOT designing the dashboard from scratch. You are FILLING a fixed template. The chart count, types, and order are already decided.\n` +
    `\n` +
    `Your job:\n` +
    `1. For each slot below, pick the BEST xField and yField from the dataset to fulfil its purpose. Use EXACT column names.\n` +
    `2. Write a short, plain-English explanation per chart (one sentence: WHAT + WHY).\n` +
    `3. Produce 3–5 KPIs that match the template's theme (sales / revenue / growth, etc.).\n` +
    `4. Produce 3–4 insights that highlight specific numbers, proportions, or items from the dataset.\n` +
    `\n` +
    `SLOTS (produce charts in EXACTLY this order, ${template.chartSlots.length} total):\n${slots}\n` +
    `\n` +
    `Return ONE JSON object with: title, summary, theme ("dark"|"light"), kpis[], charts[], insights[]. Each chart MUST keep the slot's "type" verbatim. English only. Real column names only. No "data" array — the frontend computes values.`;
}

function buildUserPrompt({ datasetBlock, queryLine, provider }) {
  const head = `${datasetBlock}${queryLine}\n\n`;

  if (provider === 'claude') {
    return head +
      `MODE: PREMIUM ANALYTICAL DESIGN (Claude).\n` +
      `\n` +
      `STEP 1 — ANALYZE (think before designing).\n` +
      `Read the COLUMNS list above carefully. Understand what each column represents. Identify the most important columns. Decide what to ignore as noise. Decide what a CEO would want to see in 5 seconds.\n` +
      `\n` +
      `STEP 2 — DESIGN.\n` +
      `Build a premium analytical dashboard:\n` +
      `- 3 to 5 KPIs (the headline numbers).\n` +
      `- 4 to 6 charts. The FIRST chart is the headline. Mix bar / line / donut / area.\n` +
      `- 3 to 4 insights, each explaining WHAT is happening + WHY it matters.\n` +
      `\n` +
      `STRICT CHART RULE.\n` +
      `Every chart references REAL column names (verbatim) for xField and yField. NEVER invent column names. NEVER include a "data" array — the frontend computes the values.\n` +
      `Examples:\n` +
      `  { "type": "bar",   "xField": "country", "yField": "sales" }\n` +
      `  { "type": "line",  "xField": "month",   "yField": "revenue" }\n` +
      `  { "type": "donut", "xField": "region",  "yField": "orders" }\n` +
      `Pick xField/yField that actually appear in the COLUMNS list. If the dataset has no good column for a chart you wanted, pick a different chart.\n` +
      `\n` +
      `INSIGHT QUALITY GATE — STRICT.\n` +
      `Generic insights are FAILED output. Use specific numbers, proportions, items, and time windows. "Sales went up" is generic; "Revenue is concentrated in 2 products contributing ~70% of total — pricing changes there move the whole business" is good.\n` +
      `\n` +
      `OUTPUT.\n` +
      `Return ONE JSON object with: title, summary, theme ("dark"|"light"), kpis[], charts[], insights[]. English only. No prose outside the JSON.`;
  }

  // OpenAI / ChatGPT — same rules, more compact.
  return head +
    `MODE: STANDARD ANALYTICAL DASHBOARD (ChatGPT).\n` +
    `Return ONE JSON object with: title, summary, theme ("dark"|"light"), kpis[3–5], charts[4–6], insights[3–4]. English only.\n` +
    `\n` +
    `STRICT CHART RULE.\n` +
    `Every chart specifies xField and yField as EXACT column names from the dataset (verbatim from the COLUMNS list above). NEVER invent column names. NEVER include a "data" array — the frontend's aggregation engine reads the columns you reference and computes the values from the full dataset.\n` +
    `Examples:\n` +
    `  { "type": "bar",   "xField": "country", "yField": "sales" }\n` +
    `  { "type": "line",  "xField": "month",   "yField": "revenue" }\n` +
    `  { "type": "donut", "xField": "region",  "yField": "orders" }\n` +
    `\n` +
    `Chart guidance: line → time trends, bar → category comparisons, donut → distribution, area → growth.\n` +
    `Charts: the FIRST chart is the headline. Mix the types so the dashboard feels designed.\n` +
    `Every chart title is short and human-readable, MAX 6 WORDS.\n` +
    `\n` +
    `INSIGHT QUALITY GATE — STRICT.\n` +
    `Every insight uses specific numbers, proportions, items, or time windows from the data. Generic lines ("sales are increasing", "some variation") are FAILED output. Each insight: WHAT + WHY.`;
}

/**
 * @param {object} args
 * @param {Array<object>} args.sheetData
 * @param {string} [args.userQuery]
 * @param {string} [args.provider] — 'openai' | 'claude' (from UI). If absent, env / auto resolution applies.
 * @param {object} [args.template]  — pre-resolved template (built-in or user-created). When set, the AI fills its slots instead of designing freely. Caller is responsible for the registry/DB lookup.
 */
export async function generateDashboard({ sheetData, userQuery, provider, template, user } = {}) {
  if (!isAiAvailable() && !user?.aiKeys?.openai && !user?.aiKeys?.claude) {
    const e = new Error('No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    e.code = 'ai_unavailable';
    throw e;
  }

  const datasetBlock = buildDatasetBlock(sheetData);
  const queryLine = userQuery
    ? `\nUSER QUERY: ${userQuery}`
    : '\nUSER QUERY: (none — design the most useful general-purpose dashboard)';

  const userPrompt = template
    ? buildTemplatePrompt({ datasetBlock, queryLine, template })
    : buildUserPrompt({ datasetBlock, queryLine, provider });

  const result = await callStructured({
    systemPrompt: DASHBOARD_SYSTEM_PROMPT,
    userPrompt,
    schema: DASHBOARD_SCHEMA,
    provider,
    user,
  });

  // Attach deterministically-computed KPIs/charts/table so the client can
  // ignore AI numbers if it chooses — values always come from real rows.
  // deterministicEngine never returns empty (line/bar/donut have a row-index
  // fallback baked in).
  const deterministic = computeDashboardData(sheetData);

  return {
    ...result,
    source: provider || process.env.AI_PROVIDER || 'auto',
    templateId: template?.id || null,
    layoutType: template?.layoutType || (template?.layoutConfig?.layout) || null,
    styleConfig: template?.styleConfig || null,
    deterministic,
  };
}
