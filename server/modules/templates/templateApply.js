// Template apply — RAW HTML mode.
//
// The AI's contract: respond with the FINAL HTML page. No JSON envelope,
// no commentary, no fenced code block. Server takes the response text,
// extracts the HTML body (with light tolerance for prose / code fences in
// case the model strays), validates it isn't an echo of the input, and
// returns it.
//
// Same validation gates as the previous turn protect against the
// "AI returned identical HTML" failure: empty, identical, length out of
// range, broken tag count → reject and fall back to original template.

import { callText, isAiAvailable } from '../claude-ai/services/claude.service.js';
import { computeDashboardData } from './deterministicEngine.js';

// ── Legacy placeholder discovery (kept for callers that still use it) ──────

const KPI_RE   = /<([a-zA-Z][\w-]*)([^<>]*?\sdata-kpi=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g;
const CHART_RE = /<([a-zA-Z][\w-]*)([^<>]*?\sdata-chart=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g;

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

export function sanitiseDesignReference(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .slice(0, 8000);
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const REWRITE_SYSTEM_PROMPT = `You are SheetFlow's Universal Dashboard Rendering AI.

INPUT: a TEMPLATE HTML page (any design, any domain) and a DATASET (JSON array, any structure).

OUTPUT: the FINAL HTML page with real data injected.

RESPONSE FORMAT — STRICT:
- Respond with ONLY the HTML. No JSON. No prose. No commentary outside the HTML. No code fences.
- Start with <!DOCTYPE html> (or <html …> if the template starts that way) and END with </html>.
- IMMEDIATELY AFTER <!DOCTYPE html> (before the <html> tag), insert a changelog HTML comment summarising what you replaced:
    <!DOCTYPE html>
    <!-- changed: KPI total files, KPI storage used, chart timeline, chart type distribution, table rows -->
    <html …>
  The comment is REQUIRED. Servers reject output that's missing it.
- The user's browser receives your response verbatim and renders it as the dashboard. The HTML comment is invisible in the browser but is read by our diagnostics.

ABSOLUTE RULES:

1. PRESERVE THE UI STRUCTURE EXACTLY:
   - Keep every HTML tag, attribute (class, id, style, data-*), and DOM structure.
   - Keep every <style> block and CSS class verbatim — same colors, same spacing, same layout.
   - Keep every <script> block's logic intact. Inside scripts you may modify ONLY the data arrays (labels:, data:, datasets:) — never function names, library imports, CDN URLs, or any logic.
   - Do NOT remove sections, cards, or charts.

2. REPLACE all dummy / static data with REAL VALUES from the dataset.

   2a. KPI CARDS — FORCED, every KPI must change.
       For each KPI card in the template, compute its value using one of these patterns:
         • Total Records / Count            = count(rows)
         • Total / Sum / Volume / Storage   = sum(numericColumn)
         • Average / Avg                    = sum(numericColumn) / count(rows)
         • Unique / Distinct / Categories   = distinct count of categoricalColumn
         • Top / Best / Most / Largest      = the single highest-value entry from the relevant column
         • Min / Smallest                   = the single lowest-value entry
         • % / Rate / Share                 = (matching rows / total rows) × 100, formatted with %
       Pick the formula that matches the KPI's visible label (after any domain-adaptation rename). Leaving any KPI card with its dummy template value is INVALID.

   2b. CHART ARRAYS — every chart must update.
       For Chart.js / ApexCharts / Recharts patterns, find labels: [...] and data: [...] arrays inside <script> blocks and replace ONLY their contents:
         • labels[] come from a date/category column.
         • data[] come from a numeric column (sum or count grouped by the label).
       Keep the chart type, options, colours, and JS logic exactly as the template defines them.

       FALLBACK CHART (mandatory — never leave a chart empty):
         If the dataset has no numeric column AND no useful categorical/date
         column to bucket by, fall back to a row-index chart:
           labels = [1, 2, 3, …, N]  (N = row count, capped at 25)
           data   = [1, 1, 1, …, 1]  (one per row)
         This guarantees every chart renders something, never an empty array.

   2c. TABLE — MANDATORY when the dataset has ≥ 5 rows.
       If the template has a <table> already, fill its <tbody> with at least 5 real rows from the dataset (preserve the <tr>/<td> structure; add or remove <tr> elements as needed to reach 5+ rows).
       If the template has no <table> but has a section that's clearly a list / feed / "Recent activity" area, convert it into a real list of dataset rows (still preserving the surrounding card / classes / styles).
       Pick the most informative columns for the visible cells.

   2d. INLINE TEXT VALUES.
       Any visible "₹120,000" / "45%" / "1,234" / similar dummy figures in headings, badges, captions → replace with values computed from the data.

3. ADAPT LABELS TO THE DATASET'S DOMAIN (allowed, encouraged, often REQUIRED):
   - The TEMPLATE may have been built for a different domain than the dataset. When that happens, you MUST adapt ALL label text and meaning — the UI stays identical, the wording changes completely.
   - Concrete example: an AIRPORT template + a FILE dataset becomes a File Analytics Dashboard:
       Flights         → Files
       Passengers      → Records
       Revenue         → Storage Used
       Delays          → Errors
       On-time %       → Healthy %
       Top Airline     → Top File Type
       Departures Trend → Uploads Over Time
   - More short examples:
       • Template "Total Sales" + file dataset       → "Total Files"
       • Template "Revenue"     + user dataset       → "Active Users"
       • Template "Orders"      + log dataset        → "Total Records"
       • Template "Customers"   + product dataset    → "Total Products"
   - Rule: ONLY the visible text content of headings / labels / titles / KPI captions / chart titles / legend labels / table headers changes. Their tags, classes, sizes, colors, positions stay identical.

4. DETECT DATA SHAPE DYNAMICALLY (no hardcoded domain assumptions):
   - Identify numeric columns (sums, averages, counts) for KPIs.
   - Identify date/time columns — use as X-axis for trend charts.
   - Identify categorical columns — use for bar / donut groupings.
   - The dataset can be sales, finance, inventory, users, logs, files, performance metrics, anything. Never assume a domain.

   COLUMN-NAME INTERPRETATION HINTS (use these to pick the right metric):
     • "File Size" / "Bytes" / "Storage"        → numeric, summable (Total Storage, Avg File Size).
     • "Length" / "Duration" / "Runtime"        → duration / numeric (Total Duration, Avg Length).
     • "Date" / "Created" / "Uploaded" / "When" → timeline axis for trend charts.
     • "Data Type" / "Category" / "Kind"        → categorical, group by for bar / donut.
     • "Status" / "State"                       → categorical, often donut for distribution.
     • "Count" / "#" / "Quantity"               → numeric, summable.
     • "Rate" / "%" / "Pct"                     → percent, format with %.
     • "Price" / "Amount" / "Cost" / "Revenue"  → currency, format with currency symbol.

5. NEVER:
   - Return placeholder text like {{title}} or [VALUE].
   - Return prose / explanation / commentary outside the HTML.
   - Wrap the HTML in a JSON object or a code fence.
   - Truncate or summarise the HTML — output must be a complete, valid HTML page roughly the same length as the input.
   - Modify CSS classes, colors, spacing, fonts, structure.
   - Remove or rearrange sections.

6. NO THEMING — STRICT. AI EMITS DATA, NEVER STYLE.
   The frontend owns the dashboard's mode (light/dark) and any colour /
   surface styling. Theming is OUT OF YOUR JOB ENTIRELY.

   Your job is exactly four things and nothing else:
     (1) KPI calculation from the dataset
     (2) Chart label/data arrays from real columns
     (3) Table population from real rows
     (4) Inline-text replacement of dummy figures

   For ANY markup you ADD or MODIFY (table rows, list items, KPI values,
   replacement inline values, newly-injected card structures):

     ✅ DO use class-based markup that matches the template's existing
        class names (\`.card\`, \`.value\`, \`.kpi-label\`, etc.) when injecting.
     ✅ DO keep semantic structure: <h3>, <p>, <table>, <td>, <ul>.

     ❌ DO NOT add inline \`style="..."\` attributes anywhere.
     ❌ DO NOT write hex colours (#fff, #000, #112233), rgb(), hsl(), or
        named colours (white, black, slate, etc.) in injected markup.
     ❌ DO NOT add Tailwind colour utilities (bg-*, text-*, border-*,
        from-*, to-*, dark:*) in injected markup. CSS classes you inject
        must be neutral / structural only — colour stays with the theme.
     ❌ DO NOT set \`background-color\`, \`color\`, \`background\` on <body>
        or on any element you add. Never style <body> at all.
     ❌ DO NOT introduce new <style> blocks, new dark-mode toggles, new
        theme-switching JS, new colour variants, or new CSS variables.
     ❌ DO NOT emit a "theme" / "mode" / "dark" / "light" field in any
        adjacent JSON, comment, or data-attribute.

   Rule of thumb for INJECTIONS: write markup like this, structural-only:
     <div class="card">
       <h3>Total Records</h3>
       <div class="value">120</div>
     </div>

   IMPORTANT separation: Per Rule 1 the template's EXISTING inline styles,
   <style> blocks, and colour classes stay VERBATIM — you do not strip
   them. You just don't ADD new ones. Theming is the frontend's domain;
   data is yours. Strict separation of concerns.

7. DATA PRECISION — STRICT.
   - Compute values from the actual dataset rows. Do NOT invent numbers, do NOT approximate ranges, do NOT make up plausible-sounding figures.
   - Sum, average, count, min, max, distinct-count → use real arithmetic on the rows shown to you.
   - Round to a sensible precision for display (e.g. integers for counts, 1–2 decimals for averages, currency / % formatted with units) — but the underlying value must come from the data.
   - If the dataset doesn't contain a column that fits a particular KPI / chart slot, leave that slot's original template value rather than fabricating a value. Better an unchanged dummy than a hallucinated number.

MINIMUM CHANGE REQUIREMENT — all four are mandatory:
- ✔ Replace EVERY KPI card value with a real computed value (per 2a).
- ✔ Update EVERY chart's labels: [] and data: [] arrays (per 2b).
- ✔ Add or update a table with ≥ 5 real rows when the dataset has ≥ 5 rows (per 2c).
- ✔ Replace at least 5 visible inline values total across the document.
- ✔ Adapt KPI / chart / table / section labels when the template's domain doesn't match the dataset (per rule 3).
- If any of these is skipped → your output is INVALID. Re-do it before responding.

CRITICAL FAILURE CHECK — read this twice before responding:
- If your output is byte-identical to the input → YOU FAILED.
- If you didn't change at least 5 visible values → YOU FAILED.
- If the <!-- changed: ... --> comment is missing or empty → YOU FAILED.

OUTPUT: the modified HTML page. Starts with <!DOCTYPE html>, then the changelog comment, then <html>. Ends with </html>. Nothing before. Nothing after.`;

function buildDatasetBlock(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData.slice(0, 25) : [];
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return (
    `DATASET (${(sheetData || []).length} rows total, sample ${rows.length}):\n` +
    `COLUMNS: ${columns.join(', ')}\n` +
    `SAMPLE: ${JSON.stringify(rows, null, 2)}`
  );
}

// Per-generation variation seed — so two consecutive runs over the same data
// produce subtly different dashboards (different chart-type mix within the
// allowed set, different accent palette, different heading phrasing). The
// template's CSS classes / layout stay locked; only the content varies.
function variationDirective() {
  const HEADINGS = ['Analytics Overview', 'Insights Panel', 'Data Snapshot', 'Performance Pulse', 'Highlights Today'];
  const ACCENTS  = ['indigo', 'emerald', 'amber', 'rose', 'cyan'];
  const CHART_MIX = ['line + bar + donut', 'bar + bar + donut', 'area + bar + donut', 'line + bar + area'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return (
    `\nVARIATION HINT (use these unless the template fixes them):\n` +
    `  • Page heading tone: "${pick(HEADINGS)}"\n` +
    `  • Chart-type mix: ${pick(CHART_MIX)}\n` +
    `  • Accent palette: ${pick(ACCENTS)} (only for stroke/fill colors inside chart data arrays; do NOT change template CSS classes).\n` +
    `Pick something different from a likely previous run so the user sees the dashboard refresh.\n`
  );
}

// ── HTML extraction from the model's free-form text response ───────────────

/**
 * Pull the HTML out of the model's response. The contract says "respond
 * with HTML only", but as a defence-in-depth we tolerate:
 *   - code fences ```html ... ``` or ``` ... ```
 *   - leading prose before <!DOCTYPE / <html / <body
 *   - trailing prose after </html>
 *
 * Returns the HTML string, or '' if nothing usable found.
 */
function extractHtml(text) {
  if (typeof text !== 'string' || !text) return '';

  // Code-fence path
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1].trim();

  // Full document path
  const doctype = text.match(/<!DOCTYPE[\s\S]*?<\/html\s*>/i);
  if (doctype) return doctype[0].trim();
  const htmlTag = text.match(/<html[\s\S]*?<\/html\s*>/i);
  if (htmlTag) return htmlTag[0].trim();

  // Fragment path: find first '<' to last '>'.
  const start = text.indexOf('<');
  const end = text.lastIndexOf('>');
  if (start !== -1 && end > start) return text.slice(start, end + 1).trim();

  return text.trim();
}

// Find the AI's `<!-- changed: ... -->` breadcrumb anywhere in the first
// ~2KB of output. Required by spec — its absence is a failure signal.
const CHANGELOG_RE = /<!--\s*changed\s*:\s*([\s\S]*?)\s*-->/i;

function extractChangelog(html) {
  const head = (html || '').slice(0, 2000);
  const m = head.match(CHANGELOG_RE);
  if (!m) return null;
  const body = m[1].trim();
  return body.length > 0 ? body : null;
}

/** Return a string describing why the rewrite failed, or null if it passed. */
function validateRewrite(originalHtml, candidateHtml) {
  if (typeof candidateHtml !== 'string' || !candidateHtml.length) {
    return 'AI returned empty html.';
  }
  if (candidateHtml === originalHtml) {
    return 'AI returned identical HTML — no values were injected.';
  }
  const ratio = candidateHtml.length / originalHtml.length;
  if (ratio < 0.6) return `Output too short (${(ratio * 100).toFixed(0)}% of input) — likely truncated or summarised.`;
  if (ratio > 1.6) return `Output too long (${(ratio * 100).toFixed(0)}% of input) — likely added unrelated content.`;
  const inTags = (originalHtml.match(/<\w+/g) || []).length;
  const outTags = (candidateHtml.match(/<\w+/g) || []).length;
  if (Math.abs(outTags - inTags) > Math.max(20, inTags * 0.2)) {
    return `Tag count differs significantly (in ${inTags}, out ${outTags}) — structure may be broken.`;
  }
  // Required changelog comment — per spec, its absence makes the output invalid.
  if (!extractChangelog(candidateHtml)) {
    return 'Missing or empty <!-- changed: ... --> comment at the top of the document.';
  }
  return null;
}

// ── Deterministic injection (no AI) ────────────────────────────────────────
//
// Walks the template's `data-kpi="<i>"` / `data-chart="<key>"` / `data-table`
// markers and fills them with values from the deterministic engine. Also
// patches Chart.js-style `labels: [...]` / `data: [...]` arrays in script
// blocks tagged with `data-chart-id="<key>"`. When nothing is tagged, falls
// back to replacing the first 4 visible big numbers in the document.

function buildKpiSvgPlaceholder() { return ''; }

function buildLineSvgFromArrays(labels, data) {
  if (!Array.isArray(data) || data.length < 2) return '';
  const w = 400, h = 160;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = (max - min) || 1;
  const step = (w - 20) / (data.length - 1);
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(10 + i * step).toFixed(1)},${(h - 20 - ((v - min) / span) * (h - 40)).toFixed(1)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none"><path d="${path}" stroke="#6366f1" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function buildBarSvgFromArrays(labels, data) {
  if (!Array.isArray(data) || data.length === 0) return '';
  const w = 400, h = 180;
  const max = Math.max(...data, 1);
  const slot = (w - 20) / data.length;
  const barW = slot * 0.65;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">${
    data.map((v, i) => {
      const x = 10 + i * slot + (slot - barW) / 2;
      const barH = (v / max) * (h - 30);
      const y = h - 10 - barH;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" fill="#6366f1" rx="2"/>`;
    }).join('')
  }</svg>`;
}

function buildDonutSvgFromArrays(labels, data) {
  const total = data.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const palette = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#94a3b8'];
  let acc = 0;
  const segs = data.map((v, i) => {
    const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
    acc += Number(v) || 0;
    const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const cx = 100, cy = 100, r = 75, hole = 40;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end),   y2 = cy + r * Math.sin(end);
    const xi1 = cx + hole * Math.cos(start), yi1 = cy + hole * Math.sin(start);
    const xi2 = cx + hole * Math.cos(end),   yi2 = cy + hole * Math.sin(end);
    return `<path d="M ${xi1.toFixed(1)} ${yi1.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L ${xi2.toFixed(1)} ${yi2.toFixed(1)} A ${hole} ${hole} 0 ${large} 0 ${xi1.toFixed(1)} ${yi1.toFixed(1)} Z" fill="${palette[i % palette.length]}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">${segs}</svg>`;
}

function chartSvg(chart) {
  if (!chart) return '';
  // Match shape to renderer (line is the safe default).
  if (chart === computeDashboardData([]).charts.donut) return buildDonutSvgFromArrays(chart.labels, chart.data);
  return buildLineSvgFromArrays(chart.labels, chart.data);
}

function escapeHtmlText(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function injectDeterministic(html, data) {
  let out = html;

  // 1. Fill data-kpi="i" placeholders with the i-th KPI value (0-indexed)
  //    or by name if data-kpi names a known KPI label.
  out = out.replace(/<([a-zA-Z][\w-]*)([^<>]*?\sdata-kpi=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g,
    (full, tag, attrs, name) => {
      const idx = /^\d+$/.test(name) ? parseInt(name, 10) : data.kpis.findIndex((k) => k.label?.toLowerCase().includes(name.toLowerCase()));
      const kpi = idx >= 0 && idx < data.kpis.length ? data.kpis[idx] : data.kpis[0];
      if (!kpi) return full;
      return `<${tag}${attrs}>${escapeHtmlText(kpi.value)}</${tag}>`;
    });

  // 2. Fill data-chart="key" wrappers with an inline SVG.
  const chartMap = { line: data.charts.line, bar: data.charts.bar, donut: data.charts.donut };
  out = out.replace(/<([a-zA-Z][\w-]*)([^<>]*?\sdata-chart=["']([^"']+)["'][^<>]*?)>([\s\S]*?)<\/\1>/g,
    (full, tag, attrs, key) => {
      const k = key.toLowerCase();
      let chart = chartMap.line;
      let svgFn = buildLineSvgFromArrays;
      if (k.includes('bar') || k.includes('compare') || k.includes('top')) {
        chart = chartMap.bar; svgFn = buildBarSvgFromArrays;
      } else if (k.includes('donut') || k.includes('pie') || k.includes('distrib') || k.includes('share')) {
        chart = chartMap.donut; svgFn = buildDonutSvgFromArrays;
      }
      if (!chart) return full;
      return `<${tag}${attrs}>${svgFn(chart.labels, chart.data)}</${tag}>`;
    });

  // 3. Patch Chart.js / similar `labels: [...]` and `data: [...]` arrays
  //    inside <script> blocks. Best-effort — we only replace if both arrays
  //    are found in proximity (within 200 chars).
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, (block) => {
    let modified = block;
    const labels = JSON.stringify(data.charts.line.labels);
    const dataArr = JSON.stringify(data.charts.line.data);
    modified = modified.replace(/labels\s*:\s*\[[^\]]*\]/, `labels: ${labels}`);
    modified = modified.replace(/data\s*:\s*\[[^\]]*\]/, `data: ${dataArr}`);
    return modified;
  });

  // 4. Fill data-table tbody with real rows.
  out = out.replace(/<tbody([^<>]*\sdata-table=["'][^"']*["'][^<>]*)>([\s\S]*?)<\/tbody>/g,
    (full, attrs) => {
      const rows = data.table.rows.map((row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtmlText(cell)}</td>`).join('')}</tr>`
      ).join('');
      return `<tbody${attrs}>${rows}</tbody>`;
    });

  return out;
}

// ── Main entry ─────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {string} args.templateCode
 * @param {Array<object>} args.sheetData
 * @param {string} [args.userQuery]
 * @returns {Promise<{ html: string, source: 'ai-rewrite' | 'fallback' }>}
 */
export async function applyTemplate({ templateCode, sheetData, userQuery, user }) {
  if (typeof templateCode !== 'string' || !templateCode) {
    return { html: '', source: 'fallback' };
  }

  // ── Deterministic pre-compute ─────────────────────────────────────────
  // ALWAYS compute KPIs / charts / table from the sheet data. Independent
  // of the AI. The AI's job becomes "polish the labels" — the values are
  // already correct. If the AI later fails, we still have a usable
  // dashboard.
  const data = computeDashboardData(sheetData);
  console.log('[template-apply] deterministic engine —',
    `${data.kpis.length} KPIs,`,
    `${Object.keys(data.charts).length} charts,`,
    `${data.table.rows.length} table rows.`);

  if (!isAiAvailable() && !user?.aiKeys?.openai && !user?.aiKeys?.claude) {
    console.warn('[template-apply] AI unavailable — injecting deterministic values only.');
    return {
      html: injectDeterministic(templateCode, data),
      source: 'deterministic',
      deterministic: data,
    };
  }

  // Output tokens scale with input. ~3 chars/token rule for HTML; floor 4K,
  // ceiling 32K so very large templates aren't silently truncated.
  const estimatedOutputTokens = Math.min(
    Math.max(Math.ceil(templateCode.length / 3) + 1500, 4000),
    32000,
  );

  console.log('AI APPLY (rewrite mode, raw HTML) — template length:', templateCode.length,
    '| dataset rows:', Array.isArray(sheetData) ? sheetData.length : 0,
    '| max output tokens:', estimatedOutputTokens);

  const datasetBlock = buildDatasetBlock(sheetData);
  const userPrompt =
    `TEMPLATE HTML (${templateCode.length} chars):\n${templateCode}\n\n` +
    `${datasetBlock}\n\n` +
    (userQuery ? `USER REQUEST: ${userQuery}\n\n` : '') +
    variationDirective() +
    `Now respond with the modified HTML page. Same UI, same CSS, same structure — only the data (and where allowed, headings/accent) changes. ` +
    `Identical output = failed. No JSON, no prose, no code fences. Just the HTML, starting at <!DOCTYPE html> or <html> and ending at </html>.`;

  let rawText;
  try {
    rawText = await callText({
      systemPrompt: REWRITE_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: estimatedOutputTokens,
      user,
    });
  } catch (err) {
    console.warn('[template-apply] AI call failed — using deterministic injection:', err?.message || err);
    return { html: injectDeterministic(templateCode, data), source: 'deterministic', deterministic: data };
  }

  const html = extractHtml(rawText);
  const reason = validateRewrite(templateCode, html);

  if (reason) {
    console.warn('[template-apply] rewrite REJECTED:', reason,
      '| raw response length:', (rawText || '').length,
      '— falling back to deterministic injection.');
    return { html: injectDeterministic(templateCode, data), source: 'deterministic', deterministic: data };
  }

  const changelog = extractChangelog(html);
  console.log('[template-apply] rewrite ACCEPTED — output length:', html.length,
    '| input length:', templateCode.length,
    '| changed:', changelog || '(none)');

  return { html, source: 'ai-rewrite', changelog };
}
