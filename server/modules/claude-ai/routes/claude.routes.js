import { Router } from 'express';
import { generateSuggestions } from '../services/suggestion.engine.js';
import { generateDashboard } from '../services/dashboard.generator.js';
import { generateInsights } from '../services/insight.engine.js';
import { isAiAvailable, userHasAiAccess } from '../services/claude.service.js';
import { getTemplate as getBuiltInTemplate } from '../../templates/registry.js';
import Template from '../../../models/Template.js';
import { requireAuth } from '../../../middleware/auth.js';
import { consumeCredits } from '../../../middleware/credits.js';

// Block every AI route when the requester has no usable key (neither their
// own nor a server-wide fallback). Returns 402 with a machine-readable
// `code` the client can switch on to redirect to Settings.
function requireAiAccess(req, res, next) {
  if (userHasAiAccess(req.user)) return next();
  return res.status(402).json({
    error: 'Please add your OpenAI or Claude API key in Settings to use AI features.',
    code: 'ai_key_missing',
  });
}

const r = Router();

// All AI routes are auth-gated AND key-gated. Status is the only exception
// — the client uses it to decide which UI to show before the user has logged in.
r.get('/status', (_req, res) => {
  res.json({ available: isAiAvailable(), model: process.env.CLAUDE_MODEL || 'claude-opus-4-7' });
});

r.use(requireAuth, requireAiAccess);

/** POST /api/ai/suggestions — { sheetData } → { dashboards: [...], source } */
r.post('/suggestions', async (req, res, next) => {
  try {
    const sheetData = req.body?.sheetData;
    if (!Array.isArray(sheetData)) {
      return res.status(400).json({ error: 'sheetData must be an array of row objects.' });
    }
    const result = await generateSuggestions(sheetData);
    res.json(result);
  } catch (err) {
    next(translate(err));
  }
});

/** POST /api/ai/generate-dashboard — { sheetData, userQuery, provider? } → full dashboard config */
r.post('/generate-dashboard', consumeCredits(1, 'AI dashboard generation'), async (req, res, next) => {
  try {
    const { sheetData, userQuery, provider, templateId } = req.body || {};
    console.log('REQ PROVIDER:', provider, 'TEMPLATE:', templateId || '—');
    if (!Array.isArray(sheetData)) {
      return res.status(400).json({ error: 'sheetData must be an array of row objects.' });
    }
    const safeProvider =
      provider === 'openai' || provider === 'claude' ? provider : undefined;

    // Resolve the template (if any) before calling the generator: built-in
    // registry first, then a workspace-scoped DB lookup. Unknown ids are
    // silently ignored and the AI falls back to free-design mode.
    let template = null;
    const tid = typeof templateId === 'string' ? templateId.trim() : '';
    if (tid) {
      template = getBuiltInTemplate(tid);
      if (!template && req.user?.workspaceId) {
        try {
          const dbTpl = await Template.findOne({
            _id: tid,
            workspaceId: req.user.workspaceId,
          }).lean();
          if (dbTpl) {
            template = {
              id: String(dbTpl._id),
              name: dbTpl.name,
              category: dbTpl.category,
              description: dbTpl.description,
              layoutConfig: dbTpl.layoutConfig,
              chartSlots: dbTpl.chartSlots,
            };
          }
        } catch {
          // Bad ObjectId etc. — treat as no template.
        }
      }
    }

    const result = await generateDashboard({
      sheetData,
      userQuery: typeof userQuery === 'string' ? userQuery : '',
      provider: safeProvider,
      template,
      user: req.user,
    });
    res.json(result);
  } catch (err) {
    next(translate(err));
  }
});

/** POST /api/ai/insights — { sheetData } → { summary, trends, anomalies, source } */
r.post('/insights', async (req, res, next) => {
  try {
    const sheetData = req.body?.sheetData;
    if (!Array.isArray(sheetData)) {
      return res.status(400).json({ error: 'sheetData must be an array of row objects.' });
    }
    const result = await generateInsights(sheetData);
    res.json(result);
  } catch (err) {
    next(translate(err));
  }
});

// Map AI-layer error codes to HTTP semantics. Anthropic SDK errors have a
// `.status` field; surface that when present so the frontend can react.
function translate(err) {
  if (err?.status) {
    err.statusCode = err.status;
    return err;
  }
  if (err?.code === 'ai_unavailable') {
    err.status = 503;
    return err;
  }
  if (err?.code === 'ai_invalid_json' || err?.code === 'ai_empty_response') {
    err.status = 502;
    return err;
  }
  return err;
}

export default r;
