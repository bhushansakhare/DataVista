// Generic AI service. File name kept as `claude.service.js` for backwards
// compatibility with existing imports (engines, routes), but internally this
// is a dual-provider client supporting both Anthropic (Claude) and OpenAI.
//
// Provider selection — controlled by env:
//   AI_PROVIDER=claude  → force Claude
//   AI_PROVIDER=openai  → force OpenAI
//   AI_PROVIDER=auto    → prefer Claude if ANTHROPIC_API_KEY is set,
//                         otherwise OpenAI if OPENAI_API_KEY is set
//   (unset)             → same as auto
//
// If neither key is configured, `isAiAvailable()` returns false and the
// engines fall back to their heuristic dashboards. The module never crashes
// on import — both SDK clients are constructed lazily.

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-7';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 16000;

// ───────────────────────────────────────────────────────────────────────────
// Lazy clients — construct on first use so the module is importable even when
// keys are missing.
// ───────────────────────────────────────────────────────────────────────────

let _anthropic = null;
function getAnthropic() {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

let _openai = null;
function getOpenAI() {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) return null;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/**
 * Resolve which provider to use for this call. Returns one of:
 *   'claude' | 'openai' | null
 *
 * Priority:
 *   1. Explicit `override` from the request — trusted unconditionally so the
 *      UI selection is never silently downgraded.
 *   2. `AI_PROVIDER` env var.
 *   3. Auto mode: Claude if ANTHROPIC_API_KEY is set, else OpenAI if OPENAI_API_KEY.
 *
 * null means no provider is available — caller should fall back to heuristics.
 */
function resolveProvider(override) {
  if (override === 'openai' || override === 'claude') return override;

  const env = String(process.env.AI_PROVIDER || 'auto').toLowerCase();

  if (env === 'openai') return 'openai';
  if (env === 'claude') return 'claude';

  if (env === 'auto') {
    if (process.env.ANTHROPIC_API_KEY) return 'claude';
    if (process.env.OPENAI_API_KEY) return 'openai';
  }

  return null;
}

export function isAiAvailable() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Structured-output call. Returns parsed JSON matching `schema`.
// Provider-aware:
//   Claude → JSON-Schema-constrained output via Anthropic's output_config.
//   OpenAI → response_format: { type: "json_object" } + JSON.parse.
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {object} args
 * @param {string} args.systemPrompt — Stable, cacheable prefix.
 * @param {string} args.userPrompt   — Per-request payload (dataset + query).
 * @param {object} args.schema       — JSON Schema describing the desired output.
 * @param {string} [args.provider]   — 'openai' | 'claude' to force a provider for this call.
 * @param {boolean} [args.freeForm]  — Claude only. Drops the JSON Schema constraint and parses JSON from a fenced ```json code block. OpenAI ignores this.
 * @param {number} [args.maxTokens]  — Override the default output cap. Use for calls that return large payloads (e.g. full-HTML rewrites).
 * @returns {Promise<object>}        — Parsed JSON.
 */
export async function callStructured({ systemPrompt, userPrompt, schema, provider, freeForm, maxTokens }) {
  const finalProvider = resolveProvider(provider);
  console.log('AI PROVIDER USED:', finalProvider || 'none', freeForm && finalProvider === 'claude' ? '(free-thinking mode)' : '');

  if (!finalProvider) {
    const e = new Error('No AI provider is configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
    e.code = 'ai_unavailable';
    throw e;
  }

  if (finalProvider === 'claude') return callClaude({ systemPrompt, userPrompt, schema, freeForm, maxTokens });
  if (finalProvider === 'openai') return callOpenAI({ systemPrompt, userPrompt, schema, maxTokens });

  const e = new Error(`Unknown AI provider: ${finalProvider}`);
  e.code = 'ai_unavailable';
  throw e;
}

// ── Claude ─────────────────────────────────────────────────────────────────

async function callClaude({ systemPrompt, userPrompt, schema, freeForm, maxTokens }) {
  const client = getAnthropic();
  if (!client) {
    const e = new Error('Claude AI is not configured. Set ANTHROPIC_API_KEY.');
    e.code = 'ai_unavailable';
    throw e;
  }

  const args = {
    model: CLAUDE_MODEL,
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  };
  // Free-thinking mode: drop the JSON-Schema constraint so Claude can think
  // before producing output. Adaptive thinking stays on. We extract the final
  // JSON from a fenced ```json code block (preferred) or, as a fallback, the
  // outermost { ... } in the response.
  if (!freeForm) {
    args.output_config = { format: { type: 'json_schema', schema } };
  }

  const response = await client.messages.create(args);
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    const e = new Error('Claude returned no text content.');
    e.code = 'ai_empty_response';
    throw e;
  }

  if (freeForm) return extractJson(textBlock.text);

  try {
    return JSON.parse(textBlock.text);
  } catch (err) {
    const e = new Error('Claude returned non-JSON text.');
    e.code = 'ai_invalid_json';
    e.cause = err;
    throw e;
  }
}

/**
 * Pull a JSON object out of free-form model text. Tries a fenced ```json
 * block first; falls back to the largest brace-balanced object in the text.
 * Throws ai_invalid_json if neither yields parseable JSON.
 */
function extractJson(text) {
  if (!text || typeof text !== 'string') {
    const e = new Error('Empty response from AI.');
    e.code = 'ai_empty_response';
    throw e;
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }
  const e = new Error('AI returned non-JSON text in free-thinking mode.');
  e.code = 'ai_invalid_json';
  throw e;
}

// ── OpenAI ─────────────────────────────────────────────────────────────────

async function callOpenAI({ systemPrompt, userPrompt, maxTokens }) {
  const openai = getOpenAI();
  if (!openai) {
    const e = new Error('OpenAI is not configured. Set OPENAI_API_KEY.');
    e.code = 'ai_unavailable';
    throw e;
  }

  const res = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    ...(Number.isFinite(maxTokens) && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
  });

  const text = res.choices?.[0]?.message?.content;
  if (!text) {
    const e = new Error('OpenAI returned no text content.');
    e.code = 'ai_empty_response';
    throw e;
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const e = new Error('OpenAI returned non-JSON text.');
    e.code = 'ai_invalid_json';
    e.cause = err;
    throw e;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Shared helper.
// ───────────────────────────────────────────────────────────────────────────

/** Compact a sheet-shaped payload into a token-efficient sample for the prompt. */
export function buildDatasetBlock(sheetData) {
  const rows = Array.isArray(sheetData) ? sheetData : [];
  if (rows.length === 0) {
    return 'DATASET: (empty)';
  }
  const columns = Object.keys(rows[0] || {});
  const sample = rows.slice(0, 25);
  return [
    `DATASET (${rows.length} rows total, showing first ${sample.length}):`,
    `COLUMNS: ${columns.join(', ')}`,
    'SAMPLE:',
    JSON.stringify(sample, null, 2),
  ].join('\n');
}
