// Apply real sheet data into a raw-HTML template's data-* placeholders.
//
// FLOW:
//   1. Scan templateCode for `data-kpi="<name>"` and `data-chart="<name>"`
//      attributes. Build a list of placeholder names.
//   2. Send (placeholder list + dataset block) to the AI. AI returns a
//      key→value map.
//   3. Server string-replaces the inner content of each tagged element.
//
// IMPORTANT: We do NOT execute the user's HTML server-side. We do NOT
// parse it as a real DOM (that would require jsdom and risks parser-driven
// XSS). We use a tight, anchored regex to find tagged elements and replace
// only their inner content. The original HTML structure is preserved
// byte-for-byte everywhere except inside the matched elements.

import { callStructured, isAiAvailable } from '../claude-ai/services/claude.service.js';

const KPI_RE   = /<([a-zA-Z][\w-]*)([^<>]*?\sdata-kpi=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g;
const CHART_RE = /<([a-zA-Z][\w-]*)([^<>]*?\sdata-chart=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g;

/**
 * Pull every data-kpi / data-chart name out of the template, as a
 * deduplicated set. Used to ask the AI for exactly the values it needs.
 */
export function extractPlaceholders(html) {
  const kpis = new Set();
  const charts = new Set();
  if (typeof html !== 'string' || !html) return { kpis: [], charts: [] };
  let m;
  KPI_RE.lastIndex = 0;
  while ((m = KPI_RE.exec(html))) kpis.add(m[3]);
  CHART_RE.lastIndex = 0;
  while ((m = CHART_RE.exec(html))) charts.add(m[3]);
  return { kpis: Array.from(kpis), charts: Array.from(charts) };
}

const SCHEMA = {
  type: 'object',
  properties: {
    kpis: {
      type: 'object',
      description: 'Map of KPI placeholder name → display string (numbers formatted, currency / % included).',
      additionalProperties: { type: 'string' },
    },
    charts: {
      type: 'object',
      description: 'Map of chart placeholder name → array of {name, value} data points the user can render.',
      additionalProperties: {
        type: 'array',
        items: {
          type: 'object',
          properties: { name: { type: 'string' }, value: { type: 'number' } },
          required: ['name', 'value'],
          additionalProperties: false,
        },
      },
    },
  },
  required: ['kpis', 'charts'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You inject real values into a dashboard template's placeholders.

INPUT: the full template HTML, a list of placeholder names (KPIs and charts) found in it, and a sample of the user's spreadsheet.

OUTPUT: a JSON object with two maps:
  "kpis":   { "<name>": "<short string with units>", ... }
  "charts": { "<name>": [ {"name":"...","value":N}, ... ], ... }

YOUR JOB:
- Look at WHERE each placeholder lives in the template HTML — the surrounding label, the heading, the icon, the column it's in. The placeholder name plus its visual context tells you what business value belongs there.
- Pick the most meaningful column from the spreadsheet for each placeholder. Don't be literal: if the placeholder is named "kpi1" but it sits under a "Total Revenue" label and the data has a Sales column, return total Sales. Use the template's design intent.
- KPI values are short, human-readable strings: "$142,180", "1,274", "38%", "27 min".
- Chart values are arrays of {name, value} pairs. 5–10 entries each. Real numbers from the sample where possible; otherwise reasonable estimates that reflect the data's actual scale.
- For every placeholder NAME in the input, produce a value. Don't add extra keys. If a placeholder genuinely cannot map, return an empty string (KPI) or empty array (chart).

RULES OF THUMB:
- Templates with labels like "Sales / Revenue / GMV / Orders" → fill from the dataset's primary numeric column (revenue, sales, amount).
- Templates with "Customers / Users / Sessions" → fill from a count of unique values or row count.
- Templates with "% / Rate / Share" → fill as a percentage from the data.
- Templates with date-axis charts → use a date / month / week column for the x-series.

DO NOT REDESIGN. DO NOT EXPLAIN. English only. JSON only.`;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSparklineSvg(points, opts = {}) {
  const w = opts.width  || 300;
  const h = opts.height || 80;
  const stroke = opts.stroke || '#6366f1';
  const arr = Array.isArray(points) ? points : [];
  if (arr.length < 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%"><text x="50%" y="50%" text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">no data</text></svg>`;
  }
  const values = arr.map((p) => Number(p.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = (max - min) || 1;
  const step = w / (arr.length - 1);
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`)
    .join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none"><path d="${path}" stroke="${stroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/**
 * Replace the inner content of every tagged element with the AI's value.
 * The tag, attributes, and surrounding HTML stay byte-identical.
 */
function injectIntoHtml(html, kpis, charts) {
  let out = html;

  // KPIs: replace inner text of <tag ... data-kpi="name">…</tag>
  out = out.replace(KPI_RE, (full, tag, attrs, name) => {
    if (!Object.prototype.hasOwnProperty.call(kpis, name)) return full;
    const value = kpis[name];
    return `<${tag}${attrs}>${escapeHtml(value)}</${tag}>`;
  });

  // Charts: replace inner content with an inline SVG sparkline derived from
  // the AI's data points. The user's CSS / sizing on the wrapper element
  // applies to the SVG via 100% width/height.
  out = out.replace(CHART_RE, (full, tag, attrs, name) => {
    if (!Object.prototype.hasOwnProperty.call(charts, name)) return full;
    const svg = buildSparklineSvg(charts[name]);
    return `<${tag}${attrs}>${svg}</${tag}>`;
  });

  return out;
}

// ── Full-HTML rewrite mode ──────────────────────────────────────────────────
//
// The AI receives the FULL template HTML + sample data and returns the FULL
// modified HTML with all visible numbers, KPI cards, chart datasets, and
// table rows replaced with values derived from the data.
//
// This is more general than the placeholder path (works on any HTML, even
// without `data-kpi`/`data-chart` attributes) but is also more expensive
// (output tokens scale with template size) and more brittle (LLMs can break
// HTML or refuse to modify). We validate the output and fall back to the
// placeholder path, then to the original HTML, if rewrite fails.

const REWRITE_SCHEMA = {
  type: 'object',
  properties: {
    html: { type: 'string', description: 'The FULL modified HTML, complete and valid.' },
    changed: {
      type: 'array',
      description: 'Short labels of what you changed (for logging). e.g. ["KPI:Total Sales", "chart:weeklyTrend", "table:topProducts"].',
      items: { type: 'string' },
    },
  },
  required: ['html', 'changed'],
  additionalProperties: false,
};

const REWRITE_SYSTEM_PROMPT = `You inject real business data into an existing dashboard template. You are NOT a designer. You do NOT change layout, CSS, classes, structure, or copy. You ONLY replace visible data values with values derived from the user's spreadsheet.

WHAT TO REPLACE:
1. Numbers in KPI cards (any visible number with a currency / percent / unit / bare integer / float — e.g. ₹120,000  45%  1,234  98.4ms).
2. Chart datasets in <script> blocks (Chart.js / ApexCharts / etc.):
   - "labels": [...] arrays → use real category names or dates from the data.
   - "data": [...] arrays inside datasets → use real numeric values.
3. <table> rows: replace cell contents with rows derived from the data (preserve <tr>/<td> structure exactly; only swap text content).
4. Any other visible text that is clearly a metric / value / count.

WHAT NOT TO TOUCH:
- HTML tags, attributes (class, id, style, data-*), DOM structure.
- CSS (inline or in <style> blocks).
- JavaScript logic, function names, library imports, CDN URLs.
- Static labels / titles / headings ("Total Sales", "Last 30 days", etc. — these stay).
- Color values, sizing, fonts.

CRITICAL RULES:
- If your output HTML is identical to the input → YOU FAILED. The input had placeholder numbers; the output MUST have real values from the data.
- Output MUST be valid HTML, complete, with no truncation. Match the input's <!doctype>, <html>, <head>, <body> structure exactly.
- Output MUST be roughly the same length as the input (within 80%–130%). Don't summarise, don't strip, don't reformat.
- If the data doesn't fit a particular field, leave that field's original value rather than inserting nonsense.

SELF-CHECK BEFORE YOU RETURN:
- Did I change visible numbers? (must be yes, or "changed" array is empty and you should rewrite)
- Did I update Chart.js labels and data arrays? (yes, when present)
- Did I preserve every CSS class, every tag, every script function?
- Is the output the SAME HTML structure as the input?

RETURN: a JSON object with two fields:
  "html":    the FULL modified HTML.
  "changed": short labels listing what you replaced.

No prose outside JSON.`;

function buildDatasetBlock(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData.slice(0, 25) : [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    `DATASET (${(sheetData || []).length} rows total, sample ${rows.length}):\n` +
    `COLUMNS: ${columns.join(', ')}\n` +
    `SAMPLE: ${JSON.stringify(rows, null, 2)}`
  );
}

/**
 * Validate the AI's full-HTML rewrite. Returns a string describing why it
 * failed, or null if it passed.
 */
function validateRewrite(originalHtml, candidateHtml) {
  if (typeof candidateHtml !== 'string' || !candidateHtml.length) {
    return 'AI returned empty html.';
  }
  if (candidateHtml === originalHtml) {
    return 'AI returned identical HTML — no values were injected.';
  }
  const ratio = candidateHtml.length / originalHtml.length;
  if (ratio < 0.6) return `Output is too short (${(ratio * 100).toFixed(0)}% of input) — likely truncated or summarised.`;
  if (ratio > 1.6) return `Output is too long (${(ratio * 100).toFixed(0)}% of input) — likely added unrelated content.`;
  // Lightweight structural check: tag count should be similar.
  const inTags = (originalHtml.match(/<\w+/g) || []).length;
  const outTags = (candidateHtml.match(/<\w+/g) || []).length;
  if (Math.abs(outTags - inTags) > Math.max(20, inTags * 0.2)) {
    return `Tag count differs significantly (in ${inTags}, out ${outTags}) — structure may be broken.`;
  }
  return null;
}

async function rewriteHtmlWithData({ templateCode, sheetData }) {
  // Output token budget — scale with input. ~4 chars/token rule of thumb.
  // We need at least the input size in output, plus headroom for the JSON
  // envelope and any expanded values.
  const estimatedOutputTokens = Math.min(
    Math.max(Math.ceil(templateCode.length / 3) + 1000, 4000),
    32000,  // hard ceiling
  );

  console.log('AI APPLY (rewrite mode) — template length:', templateCode.length,
    '| max output tokens:', estimatedOutputTokens);

  const datasetBlock = buildDatasetBlock(sheetData);
  const userPrompt =
    `TEMPLATE HTML (${templateCode.length} chars):\n${templateCode}\n\n` +
    `${datasetBlock}\n\n` +
    `Now produce the modified HTML with real values injected. Remember: identical output = failed.`;

  try {
    const result = await callStructured({
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userPrompt,
      schema: REWRITE_SCHEMA,
      maxTokens: estimatedOutputTokens,
    });
    const html = result?.html;
    const changed = Array.isArray(result?.changed) ? result.changed : [];
    const reason = validateRewrite(templateCode, html);
    if (reason) {
      console.warn('[template-apply] rewrite rejected:', reason);
      return { html: null, source: null };
    }
    console.log('[template-apply] rewrite accepted —',
      `${changed.length} change${changed.length === 1 ? '' : 's'}:`,
      changed.slice(0, 8).join(', ') + (changed.length > 8 ? '…' : ''));
    return { html, source: 'ai-rewrite' };
  } catch (err) {
    console.warn('[template-apply] rewrite call failed:', err?.message || err);
    return { html: null, source: null };
  }
}

async function applyViaPlaceholders({ templateCode, sheetData, kpiNames, chartNames }) {
  console.log('AI APPLY (placeholder mode) — template length:', templateCode.length,
    '| kpi placeholders:', kpiNames.length,
    '| chart placeholders:', chartNames.length);

  const datasetBlock = buildDatasetBlock(sheetData);
  const userPrompt =
    `TEMPLATE HTML:\n${templateCode}\n\n` +
    `${datasetBlock}\n\n` +
    `PLACEHOLDERS TO FILL:\n` +
    `KPIs: ${JSON.stringify(kpiNames)}\n` +
    `CHARTS: ${JSON.stringify(chartNames)}\n\n` +
    `Look at where each placeholder is positioned in the template HTML above — its surrounding labels and styles tell you what business value belongs there. Return JSON with "kpis" and "charts" keys, each populated for every name above.`;

  try {
    const result = await callStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      schema: SCHEMA,
    });
    const kpis = result?.kpis && typeof result.kpis === 'object' ? result.kpis : {};
    const charts = result?.charts && typeof result.charts === 'object' ? result.charts : {};
    const html = injectIntoHtml(templateCode, kpis, charts);
    if (html === templateCode) return { html: null, source: null };
    return { html, source: 'ai-placeholders' };
  } catch (err) {
    console.warn('[template-apply] placeholder call failed:', err?.message || err);
    return { html: null, source: null };
  }
}

/**
 * Take a raw-HTML template + sheet data, return the same HTML with real
 * values injected. Tries full rewrite first; falls back to placeholder
 * substitution; finally returns the original template if both AI paths
 * fail. Never throws.
 *
 * @param {object} args
 * @param {string} args.templateCode
 * @param {Array<object>} args.sheetData — sample rows for the AI to reason about
 * @returns {Promise<{ html: string, source: 'ai-rewrite' | 'ai-placeholders' | 'fallback' }>}
 */
export async function applyTemplate({ templateCode, sheetData }) {
  if (typeof templateCode !== 'string' || !templateCode) {
    return { html: '', source: 'fallback' };
  }
  if (!isAiAvailable()) {
    console.warn('[template-apply] AI unavailable — returning template untouched.');
    return { html: templateCode, source: 'fallback' };
  }

  // 1. Primary: full HTML rewrite. Works on any template.
  const rewrite = await rewriteHtmlWithData({ templateCode, sheetData });
  if (rewrite.html) return rewrite;

  // 2. Fallback: explicit data-kpi / data-chart placeholders. Works only
  //    when the template has them, but it's cheap and deterministic.
  const { kpis: kpiNames, charts: chartNames } = extractPlaceholders(templateCode);
  if (kpiNames.length > 0 || chartNames.length > 0) {
    const placeholders = await applyViaPlaceholders({ templateCode, sheetData, kpiNames, chartNames });
    if (placeholders.html) return placeholders;
  }

  // 3. Last resort: return the template untouched so the user at least sees
  //    their layout. They can refine the prompt or add explicit placeholders.
  console.warn('[template-apply] all AI paths failed — returning original template.');
  return { html: templateCode, source: 'fallback' };
}
