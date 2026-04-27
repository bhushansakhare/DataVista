import Dashboard from '../models/Dashboard.js';
import Sheet from '../models/Sheet.js';

export async function createDashboard(req, res, next) {
  try {
    const { sheetId, title, description, charts, layout, theme } = req.body;
    if (!sheetId) return res.status(400).json({ error: 'sheetId is required' });
    const sheet = await Sheet.findOne({ _id: sheetId, workspaceId: req.user.workspaceId });
    if (!sheet) return res.status(404).json({ error: 'Sheet not found' });

    const dashboard = await Dashboard.create({
      workspaceId: req.user.workspaceId,
      ownerId: req.user._id,
      sheetId,
      title: title || 'Untitled dashboard',
      description: description || '',
      charts: charts || [],
      layout: layout || 'grid',
      theme: theme || 'light',
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
    const updates = (({ title, description, charts, layout, theme }) =>
      ({ title, description, charts, layout, theme }))(req.body);
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);
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
