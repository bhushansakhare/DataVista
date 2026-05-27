import Dashboard from '../models/Dashboard.js';
import Sheet from '../models/Sheet.js';

const THEME_MODES = ['light', 'dark'];

export async function createDashboard(req, res, next) {
  try {
    const {
      sheetId, title, description, charts, insights,
      templateId, layoutType, styleConfig, layout, theme,
      templateType, templateCode, templateUrl,
    } = req.body;
    if (!sheetId) return res.status(400).json({ error: 'sheetId is required' });
    const sheet = await Sheet.findOne({ _id: sheetId, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

    const validLayout = ['hero-grid', 'dense-grid', 'sidebar'].includes(layoutType) ? layoutType : '';
    const cleanStyle = (styleConfig && typeof styleConfig === 'object') ? {
      density:   ['compact', 'airy'].includes(styleConfig.density) ? styleConfig.density : '',
      cardStyle: ['soft', 'sharp'].includes(styleConfig.cardStyle) ? styleConfig.cardStyle : '',
      accent:    ['brand', 'emerald', 'purple', 'amber'].includes(styleConfig.accent) ? styleConfig.accent : '',
      mode:      ['light', 'dark'].includes(styleConfig.mode) ? styleConfig.mode : '',
    } : { density: '', cardStyle: '', accent: '', mode: '' };

    const validTemplateType = ['slots', 'html', 'url'].includes(templateType) ? templateType : '';

    const dashboard = await Dashboard.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      sheetId,
      title: title || 'Untitled dashboard',
      description: description || '',
      charts: charts || [],
      insights: Array.isArray(insights) ? insights : [],
      templateId: typeof templateId === 'string' ? templateId : '',
      templateType: validTemplateType,
      templateCode: typeof templateCode === 'string' ? templateCode : '',
      templateUrl:  typeof templateUrl  === 'string' ? templateUrl  : '',
      layoutType: validLayout,
      styleConfig: cleanStyle,
      layout: layout || 'grid',
      theme: THEME_MODES.includes(theme) ? theme : 'light',
    });
    res.status(201).json({ dashboard });
  } catch (err) {
    next(err);
  }
}

export async function listDashboards(req, res, next) {
  try {
    const dashboards = await Dashboard.find({ workspaceId: req.user.workspaceId })
      .sort({ updatedAt: -1 })
      .populate('sheetId', 'title rowCount columns');
    res.json({ dashboards });
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const dashboard = await Dashboard.findOne({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    const sheet = await Sheet.findById(dashboard.sheetId);
    res.json({ dashboard, sheet });
  } catch (err) {
    next(err);
  }
}

export async function updateDashboard(req, res, next) {
  try {
    const updates = (({ title, description, charts, insights, layout, theme }) =>
      ({ title, description, charts, insights, layout, theme }))(req.body);
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
    if (updates.theme !== undefined && !THEME_MODES.includes(updates.theme)) updates.theme = 'light';
    const dashboard = await Dashboard.findOneAndUpdate(
      { _id: req.params.id, workspaceId: req.user.workspaceId },
      updates,
      { new: true }
    );
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    const io = req.app.get('io');
    if (io) io.to(`dashboard:${dashboard._id}`).emit('dashboard:updated', { dashboardId: dashboard._id });
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
}

export async function deleteDashboard(req, res, next) {
  try {
    const d = await Dashboard.findOneAndDelete({ _id: req.params.id, workspaceId: req.user.workspaceId });
    if (!d) return res.status(404).json({ error: 'Dashboard not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/history — chronological list of dashboards in the
 * workspace, optionally filtered by `?sheetId=`. Returns a lightweight
 * projection (id, title, sheetId, chart count, timestamps) so the history
 * panel renders fast even when there are hundreds of past dashboards.
 */
export async function dashboardHistory(req, res, next) {
  try {
    const query = { workspaceId: req.user.workspaceId };
    if (req.query.sheetId) query.sheetId = req.query.sheetId;
    const docs = await Dashboard.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500))
      .select('title sheetId charts createdAt updatedAt theme')
      .populate('sheetId', 'title')
      .lean();
    const history = docs.map((d) => ({
      _id: d._id,
      title: d.title,
      sheetId: d.sheetId?._id || d.sheetId,
      sheetTitle: d.sheetId?.title || null,
      chartCount: Array.isArray(d.charts) ? d.charts.length : 0,
      theme: d.theme,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
    res.json({ history });
  } catch (err) {
    next(err);
  }
}
