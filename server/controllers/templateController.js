import Template from '../models/Template.js';
import Sheet from '../models/Sheet.js';
import { listTemplates as listBuiltIn, getTemplate as getBuiltIn } from '../modules/templates/registry.js';
import {
  generateTemplateConfigSafe, sanitiseDesignReference,
} from '../modules/templates/templateGenerator.js';
import { applyTemplate as applyHtmlTemplate } from '../modules/templates/templateApply.js';

/**
 * GET /api/templates — built-in templates merged with the workspace's user
 * templates. Built-ins are flagged `builtIn: true` so the UI can suppress
 * the delete button on them.
 */
export async function listAllTemplates(req, res, next) {
  try {
    const builtIn = listBuiltIn().map((t) => ({ ...t, builtIn: true }));
    const userTpls = await Template.find({ workspaceId: req.user.workspaceId })
      .sort({ createdAt: -1 })
      .lean();
    const user = userTpls.map((t) => ({
      id: String(t._id),
      name: t.name,
      category: t.category,
      description: t.description,
      previewImage: t.previewImage || '',
      chartCount: Array.isArray(t.chartSlots) ? t.chartSlots.length : 0,
      templateType: t.templateType || 'slots',
      // Don't surface the full templateCode here — that's potentially MB of HTML.
      // The list endpoint stays light; getTemplateById returns the full code.
      hasCode: Boolean(t.templateCode),
      templateUrl: t.templateUrl || '',
      layoutType: t.layoutType || 'hero-grid',
      styleConfig: t.styleConfig,
      sourceType: t.sourceType,
      builtIn: false,
      createdAt: t.createdAt,
    }));
    res.json({ templates: [...builtIn, ...user] });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/templates/:id — return the full template (built-in or user).
 * Used by the AI Assistant page to show the slot details and by the
 * generator to know which slots to fill.
 */
export async function getTemplateById(req, res, next) {
  try {
    const builtIn = getBuiltIn(req.params.id);
    if (builtIn) return res.json({ template: { ...builtIn, builtIn: true } });

    const tpl = await Template.findOne({
      _id: req.params.id,
      workspaceId: req.user.workspaceId,
    }).lean();
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json({
      template: {
        id: String(tpl._id),
        name: tpl.name,
        category: tpl.category,
        description: tpl.description,
        previewImage: tpl.previewImage || '',
        templateType: tpl.templateType || 'slots',
        templateCode: tpl.templateCode || '',
        templateUrl: tpl.templateUrl || '',
        layoutType: tpl.layoutType || 'hero-grid',
        layoutConfig: tpl.layoutConfig,
        styleConfig: tpl.styleConfig,
        chartSlots: tpl.chartSlots,
        sourceType: tpl.sourceType,
        builtIn: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/templates — create a user template. The body provides the
 * intent (name, category, description, designReference, sourceType); the AI
 * turns that intent into a slot config which we persist alongside.
 *
 * Body: { name, category?, description?, designReference?, sourceType? }
 */
export async function createTemplate(req, res, next) {
  try {
    const {
      name, category, description, designReference, sourceType,
      templateType, templateCode, templateUrl,
    } = req.body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    // ── Branch by templateType ───────────────────────────────────────────
    // 'html' / 'url': store verbatim. NO sanitisation. NO slot AI. The
    // iframe sandbox enforces safety at render time, not at storage time.
    // 'slots' / undefined: legacy path — AI generates slot config.
    const tType = templateType === 'html' ? 'html'
                : templateType === 'url'  ? 'url'
                : 'slots';

    if (tType === 'html') {
      if (typeof templateCode !== 'string' || !templateCode.trim()) {
        return res.status(400).json({ error: 'templateCode is required for HTML templates.' });
      }
      console.log('RECEIVED TEMPLATE LENGTH:', templateCode.length);
      if (templateCode.length < 200) {
        return res.status(400).json({
          error: 'Template HTML not properly captured (under 200 chars). Re-paste the full HTML — the editor may have lost focus mid-paste.',
        });
      }
      const tpl = await Template.create({
        workspaceId: req.user.workspaceId,
        ownerId: req.user._id,
        name: name.trim(),
        category: (typeof category === 'string' && category.trim()) || 'Custom',
        description: typeof description === 'string' ? description.trim() : '',
        previewImage: '',
        templateType: 'html',
        templateCode,
        templateUrl: '',
        sourceType: 'html',
      });
      return res.status(201).json({
        template: {
          id: String(tpl._id),
          name: tpl.name,
          category: tpl.category,
          description: tpl.description,
          previewImage: tpl.previewImage,
          chartCount: 0,
          templateType: 'html',
          builtIn: false,
        },
      });
    }

    if (tType === 'url') {
      const url = String(templateUrl || '').trim();
      if (!/^https?:\/\/\S+$/i.test(url)) {
        return res.status(400).json({ error: 'templateUrl must be http(s)://… for URL templates.' });
      }
      const tpl = await Template.create({
        workspaceId: req.user.workspaceId,
        ownerId: req.user._id,
        name: name.trim(),
        category: (typeof category === 'string' && category.trim()) || 'Custom',
        description: typeof description === 'string' ? description.trim() : '',
        previewImage: '',
        templateType: 'url',
        templateCode: '',
        templateUrl: url,
        sourceType: 'description',
      });
      return res.status(201).json({
        template: {
          id: String(tpl._id),
          name: tpl.name,
          category: tpl.category,
          description: tpl.description,
          previewImage: tpl.previewImage,
          chartCount: 0,
          templateType: 'url',
          templateUrl: url,
          builtIn: false,
        },
      });
    }

    // ── Legacy slot-based path (description / HTML-as-design-reference) ──
    const cleanRef = sanitiseDesignReference(designReference || '');

    const cfg = await generateTemplateConfigSafe({
      name: name.trim(),
      category: typeof category === 'string' ? category : 'Custom',
      description: typeof description === 'string' ? description : '',
      designReference: cleanRef || undefined,
    });

    const safeSourceType =
      sourceType === 'html' ? 'html'
      : sourceType === 'manual' ? 'manual'
      : 'description';

    const tpl = await Template.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      name: name.trim(),
      category: (typeof category === 'string' && category.trim()) || 'Custom',
      description: typeof description === 'string' ? description.trim() : '',
      previewImage: '',
      templateType: 'slots',
      sourceType: safeSourceType,
      sourceReference: cleanRef,
      layoutType: cfg.layoutType || 'hero-grid',
      layoutConfig: cfg.layoutConfig,
      styleConfig: cfg.styleConfig || {
        density: 'airy', cardStyle: 'soft', accent: 'brand', mode: 'light',
      },
      chartSlots: cfg.chartSlots,
    });

    res.status(201).json({
      template: {
        id: String(tpl._id),
        name: tpl.name,
        category: tpl.category,
        description: tpl.description,
        previewImage: tpl.previewImage,
        chartCount: tpl.chartSlots.length,
        layoutType: tpl.layoutType,
        styleConfig: tpl.styleConfig,
        sourceType: tpl.sourceType,
        builtIn: false,
      },
      // Tells the UI which path produced the slot config so it can show a
      // soft "we used a default layout — refine the description for a
      // tighter fit" notice when source === 'fallback'.
      generationSource: cfg.source,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/templates/:id — edit a user-created template.
 *
 * Editable fields: name, category, description, layoutConfig.layout,
 * chartSlots (full replacement). Each slot is sanitised so callers can't
 * inject unknown chart types or positions, and at least one hero slot is
 * enforced — every dashboard needs a headline.
 *
 * Built-in templates are immutable; editing one returns 403.
 */
export async function updateTemplate(req, res, next) {
  try {
    if (getBuiltIn(req.params.id)) {
      return res.status(403).json({ error: 'Built-in templates cannot be edited.' });
    }
    const tpl = await Template.findOne({
      _id: req.params.id,
      workspaceId: req.user.workspaceId,
    });
    if (!tpl) return res.status(404).json({ error: 'Template not found' });

    const { name, category, description, layoutType, layoutConfig, styleConfig, chartSlots } = req.body || {};

    if (typeof name === 'string' && name.trim()) tpl.name = name.trim().slice(0, 80);
    if (typeof category === 'string') tpl.category = category.trim().slice(0, 40) || 'Custom';
    if (typeof description === 'string') tpl.description = description.trim().slice(0, 500);

    if (typeof layoutType === 'string' && ['hero-grid', 'dense-grid', 'sidebar'].includes(layoutType)) {
      tpl.layoutType = layoutType;
      tpl.layoutConfig = {
        layout: layoutType,
        sections: tpl.layoutConfig?.sections || ['kpis', 'hero', 'grid', 'insights'],
      };
    } else if (layoutConfig && typeof layoutConfig === 'object') {
      const layout = ['hero-grid', 'dense-grid', 'sidebar'].includes(layoutConfig.layout)
        ? layoutConfig.layout : 'hero-grid';
      tpl.layoutType = layout;
      tpl.layoutConfig = {
        layout,
        sections: Array.isArray(layoutConfig.sections) && layoutConfig.sections.length
          ? layoutConfig.sections.map(String)
          : tpl.layoutConfig?.sections || ['kpis', 'hero', 'grid', 'insights'],
      };
    }

    if (styleConfig && typeof styleConfig === 'object') {
      const next = { ...(tpl.styleConfig || {}) };
      if (['compact', 'airy'].includes(styleConfig.density)) next.density = styleConfig.density;
      if (['soft', 'sharp'].includes(styleConfig.cardStyle)) next.cardStyle = styleConfig.cardStyle;
      if (['brand', 'emerald', 'purple', 'amber'].includes(styleConfig.accent)) next.accent = styleConfig.accent;
      if (['light', 'dark'].includes(styleConfig.mode)) next.mode = styleConfig.mode;
      tpl.styleConfig = next;
    }

    if (Array.isArray(chartSlots)) {
      const validTypes     = new Set(['line', 'bar', 'donut', 'area']);
      const validPositions = new Set(['hero', 'grid']);
      const validPurposes  = new Set(['trend', 'comparison', 'distribution', 'growth']);
      const cleaned = chartSlots
        .filter((s) => s && typeof s === 'object' && validTypes.has(s.type))
        .slice(0, 8)
        .map((s, i) => ({
          id: typeof s.id === 'string' && s.id ? s.id : `s${i + 1}`,
          position: validPositions.has(s.position) ? s.position : 'grid',
          type: s.type,
          purpose: validPurposes.has(s.purpose) ? s.purpose : 'comparison',
          title: typeof s.title === 'string' ? s.title.slice(0, 60) : '',
          hint: typeof s.hint === 'string' ? s.hint.slice(0, 200) : '',
        }));
      if (cleaned.length === 0) {
        return res.status(400).json({ error: 'At least one valid chart slot is required.' });
      }
      // Force exactly one hero slot — the renderer needs a headline.
      if (!cleaned.some((s) => s.position === 'hero')) {
        cleaned[0].position = 'hero';
      }
      tpl.chartSlots = cleaned;
    }

    await tpl.save();
    res.json({
      template: {
        id: String(tpl._id),
        name: tpl.name,
        category: tpl.category,
        description: tpl.description,
        previewImage: tpl.previewImage || '',
        layoutConfig: tpl.layoutConfig,
        chartSlots: tpl.chartSlots,
        chartCount: tpl.chartSlots.length,
        sourceType: tpl.sourceType,
        builtIn: false,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/templates/:id/apply — render an HTML/URL template against a
 * sheet's data. Returns the rendered HTML (for html templates) or the
 * stored URL (for url templates) so the client can drop it into an iframe.
 *
 * For slot-based templates, callers should keep using the existing AI
 * dashboard generator path; this endpoint is HTML-specific.
 *
 * Body: { sheetId }
 */
export async function applyTemplateRoute(req, res, next) {
  try {
    const { sheetId } = req.body || {};
    if (!sheetId) return res.status(400).json({ error: 'sheetId is required' });

    // Resolve template (built-in or DB).
    const built = getBuiltIn(req.params.id);
    let tpl = null;
    if (built) {
      tpl = built;
    } else {
      const dbTpl = await Template.findOne({
        _id: req.params.id,
        workspaceId: req.user.workspaceId,
      }).lean();
      if (!dbTpl) return res.status(404).json({ error: 'Template not found' });
      tpl = {
        id: String(dbTpl._id),
        name: dbTpl.name,
        templateType: dbTpl.templateType,
        templateCode: dbTpl.templateCode,
        templateUrl: dbTpl.templateUrl,
      };
    }

    if (tpl.templateType === 'url') {
      return res.json({
        applied: { templateType: 'url', templateUrl: tpl.templateUrl, source: 'url' },
      });
    }
    if (tpl.templateType !== 'html') {
      return res.status(400).json({
        error: 'This template uses the slot-based flow — call /api/ai/generate-dashboard instead.',
      });
    }

    const sheet = await Sheet.findOne({ _id: sheetId, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

    console.log('APPLY TEMPLATE — code length:', (tpl.templateCode || '').length,
      '| sheet rows:', (sheet.rawData || []).length);

    const { html, source } = await applyHtmlTemplate({
      templateCode: tpl.templateCode,
      sheetData: sheet.rawData || [],
    });

    res.json({
      applied: {
        templateType: 'html',
        templateCode: html,
        source,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/templates/:id — only deletes user-created templates. Built-in
 * templates from the registry are immutable; trying to delete one returns
 * 403 with a clear message.
 */
export async function deleteTemplate(req, res, next) {
  try {
    if (getBuiltIn(req.params.id)) {
      return res.status(403).json({ error: 'Built-in templates cannot be deleted.' });
    }
    const tpl = await Template.findOneAndDelete({
      _id: req.params.id,
      workspaceId: req.user.workspaceId,
    });
    if (!tpl) return res.status(404).json({ error: 'Template not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
