import crypto from 'crypto';
import Share from '../models/Share.js';
import Dashboard from '../models/Dashboard.js';
import Sheet from '../models/Sheet.js';

export async function generateShare(req, res, next) {
  try {
    const { dashboardId, permission, expiresInDays } = req.body;
    if (!dashboardId) return res.status(400).json({ error: 'dashboardId is required' });
    const dashboard = await Dashboard.findOne({ _id: dashboardId, workspaceId: req.user.workspaceId });
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });

    const publicToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 24 * 60 * 60 * 1000)
      : undefined;
    const share = await Share.create({
      dashboardId,
      publicToken,
      permission: permission === 'edit' ? 'edit' : 'view',
      expiresAt,
      isPublic: true,
      createdBy: req.user._id,
    });
    res.status(201).json({ share });
  } catch (err) {
    next(err);
  }
}

export async function getShare(req, res, next) {
  try {
    const share = await Share.findOne({ publicToken: req.params.token, isPublic: true });
    if (!share) return res.status(404).json({ error: 'Share link not found' });
    if (share.expiresAt && share.expiresAt < new Date()) {
      return res.status(410).json({ error: 'Share link expired' });
    }
    const dashboard = await Dashboard.findById(share.dashboardId);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    const sheet = await Sheet.findById(dashboard.sheetId);
    res.json({ share, dashboard, sheet });
  } catch (err) {
    next(err);
  }
}

export async function listShares(req, res, next) {
  try {
    const dashboards = await Dashboard.find({ workspaceId: req.user.workspaceId }).select('_id');
    const ids = dashboards.map((d) => d._id);
    const shares = await Share.find({ dashboardId: { $in: ids } }).sort({ createdAt: -1 });
    res.json({ shares });
  } catch (err) {
    next(err);
  }
}

export async function revokeShare(req, res, next) {
  try {
    const share = await Share.findById(req.params.id);
    if (!share) return res.status(404).json({ error: 'Share not found' });
    const dashboard = await Dashboard.findById(share.dashboardId);
    if (!dashboard || String(dashboard.workspaceId) !== String(req.user.workspaceId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await share.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
