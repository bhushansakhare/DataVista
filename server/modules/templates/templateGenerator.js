import { callStructured, isAiAvailable } from '../claude-ai/services/claude.service.js';

// Generates a dashboard template's slot config from a user-supplied design
// reference (free-form description, HTML snippet, or URL). The AI's job is
// to turn the user's intent into a valid layoutConfig + chartSlots.
//
// SAFETY CONTRACT:
//   - The HTML reference is NEVER rendered. It is sanitised here, then only
//     fed as text to the AI prompt. The AI's output is structured JSON that
//     drives our React components.
//   - This module NEVER throws on AI failure. It validates, retries once,
//     and falls back to FALLBACK_INTERNAL so the API can't 502 the caller.

// ── External schema (the contract with the AI) ──────────────────────────────
//
// Matches the spec exactly:
//   { template: { name, layout, slots: [{ id, type:"chart", chartType, position, purpose }] } }
//
// Kept separate from the internal storage shape so we can change the prompt
// contract without migrating Mongo data, and vice-versa.
const AI_SCHEMA = {
  type: 'object',
  properties: {
    template: {
      type: 'object',
      properties: {
        name:   { type: 'string' },
        layout: { type: 'string', enum: ['hero-grid', 'dense-grid', 'sidebar'] },
        style: {
          type: 'object',
          properties: {
            density:   { type: 'string', enum: ['compact', 'airy'] },
            cardStyle: { type: 'string', enum: ['soft', 'sharp'] },
            accent:    { type: 'string', enum: ['brand', 'emerald', 'purple', 'amber'] },
            mode:      { type: 'string', enum: ['light', 'dark'] },
          },
          required: ['density', 'cardStyle', 'accent', 'mode'],
          additionalProperties: false,
        },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:        { type: 'string' },
              type:      { type: 'string', enum: ['chart'] },
              chartType: { type: 'string', enum: ['line', 'bar', 'donut', 'area'] },
              position:  { type: 'string', enum: ['hero', 'primary', 'grid'] },
              purpose:   { type: 'string', enum: ['trend', 'comparison', 'distribution'] },
            },
            required: ['id', 'type', 'chartType', 'position', 'purpose'],
            additionalProperties: false,
          },
        },
      },
      required: ['name', 'layout', 'style', 'slots'],
      additionalProperties: false,
    },
  },
  required: ['template'],
  additionalProperties: false,
};

// ── Internal shape (what the rest of the app already consumes) ──────────────

const FALLBACK_INTERNAL = Object.freeze({
  layoutType: 'hero-grid',
  layoutConfig: { layout: 'hero-grid', sections: ['kpis', 'hero', 'grid', 'insights'] },
  styleConfig: { density: 'airy', cardStyle: 'soft', accent: 'brand', mode: 'light' },
  chartSlots: [
    {
      id: 's1', position: 'hero', type: 'line', purpose: 'trend',
      title: 'Trend Overview',
      hint: 'Pick a date / month / time-like xField and the most important numeric yField.',
    },
    {
      id: 's2', position: 'grid', type: 'bar', purpose: 'comparison',
      title: 'Top Comparison',
      hint: 'Pick a category xField (top values matter) and a numeric yField.',
    },
    {
      id: 's3', position: 'grid', type: 'donut', purpose: 'distribution',
      title: 'Distribution',
      hint: 'Pick a category xField with a few dominant values and a numeric yField.',
    },
  ],
});

// ── Sanitisation ────────────────────────────────────────────────────────────

/**
 * Strip executable / styling / framing parts of any pasted HTML before the
 * AI sees it. We never render this text — but we still don't want the AI's
 * prompt to contain script content that could leak into its output.
 */
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

function isUrl(s) {
  if (typeof s !== 'string') return false;
  return /^https?:\/\/\S+$/i.test(s.trim());
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You design dashboard templates for a SaaS analytics product. Output is structured JSON ONLY — no commentary, no explanation, no prose.

OUTPUT CONTRACT (return EXACTLY this JSON shape, every field required):
{
  "template": {
    "name": "string",
    "layout": "hero-grid" | "dense-grid" | "sidebar",
    "style": {
      "density":   "compact" | "airy",
      "cardStyle": "soft" | "sharp",
      "accent":    "brand" | "emerald" | "purple" | "amber",
      "mode":      "light" | "dark"
    },
    "slots": [
      {
        "id": "string",
        "type": "chart",
        "chartType": "line" | "bar" | "donut" | "area",
        "position": "hero" | "primary" | "grid",
        "purpose": "trend" | "comparison" | "distribution"
      }
    ]
  }
}

LAYOUT RULES — choose based on cues in description/HTML/URL:
- "hero-grid": one large headline chart full width, then a 2-col grid of secondary charts. First slot is "hero".
   USE WHEN: description mentions "hero", "headline chart", "main chart", "lead with"; OR HTML has a class/section like "hero", "feature", "lead", "header-chart"; OR URL path suggests a single-feature dashboard like /analytics, /overview, /dashboard.
- "dense-grid": no hero — every chart equal weight in a 3-col grid.
   USE WHEN: description mentions "dense", "compact", "monitoring", "status board", "many cards", "equal cards", "grid"; OR HTML has "grid-cols-3", "grid-cols-4", or many sibling cards without a hero; OR URL path suggests /monitoring, /status, /metrics, /ops.
- "sidebar": tall primary chart on the LEFT, stacked secondaries on the RIGHT. First slot is "primary".
   USE WHEN: description mentions "sidebar", "side panel", "left rail", "split view"; OR HTML has class "sidebar", "aside", "left-rail", or a 1+2 / 1+3 column layout; OR URL path suggests /admin, /workspace, /reports with side navigation.

If multiple cues conflict, pick the layout that matches the STRONGEST cue (an explicit "sidebar" in HTML beats a generic /analytics URL).

STYLE RULES (infer all four from the same cues):
- "density": compact when description mentions "compact / dense / tight / monitoring / packed" or HTML uses small gap/padding utilities like gap-1, gap-2, p-2, text-xs. Otherwise airy.
- "cardStyle": sharp when description mentions "sharp / boxy / monitoring / status / flat" or HTML uses rounded-md, rounded-lg, border-2. Otherwise soft (rounded-2xl + soft gradient).
- "accent":
   - "brand" (indigo) — sales, marketing, revenue, default.
   - "emerald" — finance, growth, money, profit, KPI-positive theme.
   - "purple" — product, design, customer, engagement.
   - "amber" — operations, alerts, monitoring, warnings, status.
- "mode":
   - "dark" — description mentions "dark", "executive", "navy", "midnight"; OR HTML uses bg-slate-900, bg-gray-900, bg-black, text-white; OR URL hints at /admin, /command-center.
   - "light" — default for general reports.

SLOT RULES:
- 3 to 6 slots. Quality over quantity.
- For hero-grid: first slot position="hero" with chartType "line" or "bar"; rest "grid".
- For dense-grid: all slots position="grid".
- For sidebar: first slot position="primary"; rest "grid".
- Mix bar / donut / line / area so the dashboard feels designed.
- chartType + purpose: line→trend, area→trend, bar→comparison, donut→distribution.

NO extra fields. NO extra text. JSON only.`;

function buildUserPrompt({ name, category, description, designReference, retryHint }) {
  const ref = (designReference || '').trim();
  const refBlock = !ref
    ? ''
    : isUrl(ref)
      ? `\nDESIGN REFERENCE (URL — DO NOT fetch, just infer intent from the URL itself): ${ref}\nThe URL hostname / path likely hints at the dashboard's purpose. Design accordingly without scraping.`
      : `\nDESIGN REFERENCE (sanitised, structural only — do not echo back):\n${ref}`;

  const retryBlock = retryHint
    ? `\n\nNOTE: Your previous attempt did not match the contract. Return EXACTLY the JSON shape above. No extra fields. No prose.`
    : '';

  return (
    `TEMPLATE NAME: ${name}\n` +
    `CATEGORY: ${category || 'Custom'}\n` +
    `DESCRIPTION: ${description || '(none — infer from name and reference)'}` +
    refBlock +
    retryBlock +
    `\n\nReturn the slot config JSON now.`
  );
}

// ── Validation + mapping ────────────────────────────────────────────────────

function isValidAiOutput(out) {
  if (!out || typeof out !== 'object') return false;
  const t = out.template;
  if (!t || typeof t !== 'object') return false;
  if (typeof t.name !== 'string' || !t.name) return false;
  if (!['hero-grid', 'dense-grid', 'sidebar'].includes(t.layout)) return false;

  if (!t.style || typeof t.style !== 'object') return false;
  if (!['compact', 'airy'].includes(t.style.density)) return false;
  if (!['soft', 'sharp'].includes(t.style.cardStyle)) return false;
  if (!['brand', 'emerald', 'purple', 'amber'].includes(t.style.accent)) return false;
  if (!['light', 'dark'].includes(t.style.mode)) return false;

  if (!Array.isArray(t.slots) || t.slots.length === 0) return false;

  const validChartTypes = new Set(['line', 'bar', 'donut', 'area']);
  const validPositions  = new Set(['hero', 'primary', 'grid']);
  const validPurposes   = new Set(['trend', 'comparison', 'distribution']);

  for (const s of t.slots) {
    if (!s || typeof s !== 'object') return false;
    if (typeof s.id !== 'string' || !s.id) return false;
    if (s.type !== 'chart') return false;
    if (!validChartTypes.has(s.chartType)) return false;
    if (!validPositions.has(s.position)) return false;
    if (!validPurposes.has(s.purpose)) return false;
  }
  return true;
}

/**
 * Convert the AI's external slot shape into the internal shape the rest of
 * the app already understands. Adds sensible defaults for `title` and
 * `hint`, and normalises positions: `top → hero`, `left|right → grid` (we
 * don't ship a sidebar layout yet).
 */
function mapAiToInternal(aiOut) {
  const t = aiOut.template;
  const layoutType = t.layout;  // 'hero-grid' | 'dense-grid' | 'sidebar'
  const sections = ['kpis', 'hero', 'grid', 'insights'];
  const styleConfig = { ...t.style };

  const titleFor = (slot) => {
    const p = slot.purpose;
    if (p === 'trend') return 'Trend Overview';
    if (p === 'comparison') return 'Top Comparison';
    if (p === 'distribution') return 'Distribution';
    return 'Chart';
  };
  const hintFor = (slot) => {
    if (slot.purpose === 'trend') return 'Pick a date / month / time-like xField and a numeric yField.';
    if (slot.purpose === 'comparison') return 'Pick a category xField (top values matter) and a numeric yField.';
    if (slot.purpose === 'distribution') return 'Pick a category xField with a few dominant values and a numeric yField.';
    return 'Pick the most relevant columns for this slot.';
  };
  // Position semantics differ by layoutType. Normalise to the union the
  // renderer understands: "hero" (full-width / tall), "grid" (default).
  const normalisePosition = (p) => (p === 'hero' || p === 'primary' ? 'hero' : 'grid');

  const chartSlots = t.slots.map((s) => ({
    id: s.id,
    position: normalisePosition(s.position),
    type: s.chartType,
    purpose: s.purpose,
    title: titleFor(s),
    hint: hintFor(s),
  }));

  // Layout-specific invariant: hero-grid and sidebar require exactly one
  // featured slot; dense-grid wants none. Enforce here so the renderer
  // doesn't have to second-guess the AI.
  if (layoutType === 'dense-grid') {
    chartSlots.forEach((s) => { s.position = 'grid'; });
  } else if (!chartSlots.some((s) => s.position === 'hero')) {
    chartSlots[0].position = 'hero';
  }

  return {
    layoutType,
    layoutConfig: { layout: layoutType, sections },
    styleConfig,
    chartSlots,
  };
}

// ── Public entry point — never throws on AI failure ─────────────────────────

/**
 * Try the AI once, validate; retry once with a stronger nudge; finally
 * fall back to FALLBACK_INTERNAL. The caller can unconditionally trust
 * the returned object's shape.
 *
 * @returns {Promise<{ layoutConfig, chartSlots, source: 'ai' | 'ai-retry' | 'fallback' }>}
 */
export async function generateTemplateConfigSafe({ name, category, description, designReference }) {
  if (!isAiAvailable()) {
    console.warn('[template-generator] AI not configured — using fallback config.');
    return { ...FALLBACK_INTERNAL, source: 'fallback' };
  }

  const baseArgs = { name, category, description, designReference };

  // First attempt.
  try {
    const out = await callStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({ ...baseArgs, retryHint: false }),
      schema: AI_SCHEMA,
    });
    if (isValidAiOutput(out)) {
      return { ...mapAiToInternal(out), source: 'ai' };
    }
    console.warn('[template-generator] first attempt returned invalid shape — retrying once.');
  } catch (err) {
    console.warn('[template-generator] first attempt threw:', err?.message || err);
  }

  // Retry with a stronger nudge.
  try {
    const out = await callStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt({ ...baseArgs, retryHint: true }),
      schema: AI_SCHEMA,
    });
    if (isValidAiOutput(out)) {
      return { ...mapAiToInternal(out), source: 'ai-retry' };
    }
    console.warn('[template-generator] retry also invalid — using fallback.');
  } catch (err) {
    console.warn('[template-generator] retry threw:', err?.message || err);
  }

  return { ...FALLBACK_INTERNAL, source: 'fallback' };
}
