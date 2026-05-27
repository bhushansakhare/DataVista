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
import { decryptSecret } from '../../../utils/crypto.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-7';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TOKENS = 16000;

/**
 * Resolve the API key for a given provider, preferring the user's
 * encrypted key over the server-wide env var. Decryption returns '' on
 * failure so we fall back cleanly.
 *
 * @param {'openai'|'claude'} provider
 * @param {object} [user] — Mongoose User doc with .aiKeys
 */
export function resolveApiKey(provider, user) {
  const encrypted = user?.aiKeys?.[provider];
  if (encrypted) {
    const decoded = decryptSecret(encrypted);
    if (decoded) return decoded;
  }
  if (provider === 'openai') return process.env.OPENAI_API_KEY || '';
  if (provider === 'claude') return process.env.ANTHROPIC_API_KEY || '';
  return '';
}

/**
 * Truthy when the caller has their OWN AI key configured. Env-level keys are
 * NOT counted — per the multi-tenant rule "no shared admin key usage". This
 * is what gates the AI routes / UI.
 */
export function userHasAiAccess(user) {
  return Boolean(user?.aiKeys?.openai || user?.aiKeys?.claude);
}

// ───────────────────────────────────────────────────────────────────────────
// Lazy clients — construct on first use so the module is importable even when
// keys are missing.
// ───────────────────────────────────────────────────────────────────────────

// Lazy global clients — used when no user-specific key is available.
let _anthropic = null;
function getGlobalAnthropic() {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

let _openai = null;
function getGlobalOpenAI() {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) return null;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/** Per-user client construction — fresh SDK instance per request. Cheap. */
function getAnthropic(user) {
  const userKey = user?.aiKeys?.claude ? decryptSecret(user.aiKeys.claude) : '';
  if (userKey) return new Anthropic({ apiKey: userKey });
  return getGlobalAnthropic();
}
function getOpenAI(user) {
  const userKey = user?.aiKeys?.openai ? decryptSecret(user.aiKeys.openai) : '';
  if (userKey) return new OpenAI({ apiKey: userKey });
  return getGlobalOpenAI();
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
function resolveProvider(override, user) {
  if (override === 'openai' || override === 'claude') return override;

  const env = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (env === 'openai') return 'openai';
  if (env === 'claude') return 'claude';

  if (env === 'auto') {
    // Prefer the provider the user has a key for. If they have both,
    // Claude wins (consistent with the existing global default).
    if (resolveApiKey('claude', user)) return 'claude';
    if (resolveApiKey('openai', user)) return 'openai';
  }
  return null;
}

/** Server-wide availability — does the SaaS have any key at all? */
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
export async function callStructured({ systemPrompt, userPrompt, schema, provider, freeForm, maxTokens, user }) {
  const finalProvider = resolveProvider(provider, user);
  const keyOrigin = user?.aiKeys?.[finalProvider] ? 'user' : 'env';
  console.log('AI PROVIDER USED:', finalProvider || 'none',
    freeForm && finalProvider === 'claude' ? '(free-thinking mode)' : '',
    `[${keyOrigin} key]`);

  if (!finalProvider) {
    const e = new Error('No AI provider is configured. Add a key in Settings.');
    e.code = 'ai_unavailable';
    throw e;
  }

  if (finalProvider === 'claude') return callClaude({ systemPrompt, userPrompt, schema, freeForm, maxTokens, user });
  if (finalProvider === 'openai') return callOpenAI({ systemPrompt, userPrompt, schema, maxTokens, user });

  const e = new Error(`Unknown AI provider: ${finalProvider}`);
  e.code = 'ai_unavailable';
  throw e;
}

// ── Claude ─────────────────────────────────────────────────────────────────

async function callClaude({ systemPrompt, userPrompt, schema, freeForm, maxTokens, user }) {
  const client = getAnthropic(user);
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

async function callOpenAI({ systemPrompt, userPrompt, maxTokens, user }) {
  const openai = getOpenAI(user);
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

// ───────────────────────────────────────────────────────────────────────────
// Raw text call. Returns the model's response as a plain string. Used when
// the caller wants HTML / Markdown / etc. directly, not a structured JSON
// envelope. Both providers respond in plain text mode (no json_object,
// no json_schema).
// ───────────────────────────────────────────────────────────────────────────

export async function callText({ systemPrompt, userPrompt, provider, maxTokens, user }) {
  const finalProvider = resolveProvider(provider, user);
  const keyOrigin = user?.aiKeys?.[finalProvider] ? 'user' : 'env';
  console.log('AI PROVIDER USED:', finalProvider || 'none', '(text mode)', `[${keyOrigin} key]`);

  if (!finalProvider) {
    const e = new Error('No AI provider is configured. Add a key in Settings.');
    e.code = 'ai_unavailable';
    throw e;
  }

  if (finalProvider === 'claude') {
    const client = getAnthropic(user);
    if (!client) {
      const e = new Error('Claude AI is not configured.');
      e.code = 'ai_unavailable';
      throw e;
    }
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : MAX_TOKENS,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
      // No output_config → free-form text response.
    });
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || typeof textBlock.text !== 'string') {
      const e = new Error('Claude returned no text content.');
      e.code = 'ai_empty_response';
      throw e;
    }
    return textBlock.text;
  }

  if (finalProvider === 'openai') {
    const openai = getOpenAI(user);
    if (!openai) {
      const e = new Error('OpenAI is not configured.');
      e.code = 'ai_unavailable';
      throw e;
    }
    const res = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      ...(Number.isFinite(maxTokens) && maxTokens > 0 ? { max_tokens: maxTokens } : {}),
      // No response_format → plain text completion.
    });
    const text = res.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      const e = new Error('OpenAI returned no text content.');
      e.code = 'ai_empty_response';
      throw e;
    }
    return text;
  }

  const e = new Error(`Unknown AI provider: ${finalProvider}`);
  e.code = 'ai_unavailable';
  throw e;
}

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
