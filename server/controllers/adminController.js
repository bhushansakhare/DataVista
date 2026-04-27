import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Sheet from '../models/Sheet.js';
import Dashboard from '../models/Dashboard.js';
import Share from '../models/Share.js';

export async function stats(_req, res, next) {
  try {
    const [users, workspaces, sheets, dashboards, shares] = await Promise.all([
      User.countDocuments(),
      Workspace.countDocuments(),
      Sheet.countDocuments(),
      Dashboard.countDocuments(),
      Share.countDocuments(),
    ]);
    const planAgg = await Workspace.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);
    const plans = { free: 0, pro: 0, enterprise: 0 };
    for (const p of planAgg) plans[p._id] = p.count;

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newUsers = await User.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      counts: { users, workspaces, sheets, dashboards, shares },
      plans,
      newUsers,
    });
  } catch (err) {
    next(err);
  }
}

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).populate('workspaceId', 'name plan');
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

export async function listWorkspaces(_req, res, next) {
  try {
    const workspaces = await Workspace.find().sort({ createdAt: -1 }).populate('ownerId', 'name email');
    res.json({ workspaces });
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!['superadmin', 'admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function updateWorkspacePlan(req, res, next) {
  try {
    const { plan } = req.body;
    if (!['free', 'pro', 'enterprise'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    const ws = await Workspace.findByIdAndUpdate(req.params.id, { plan }, { new: true });
    if (!ws) return res.status(404).json({ error: 'Workspace not found' });
    res.json({ workspace: ws });
  } catch (err) {
    next(err);
  }
}
