import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import Sheet from '../models/Sheet.js';
import Dashboard from '../models/Dashboard.js';
import Share from '../models/Share.js';
import Template from '../models/Template.js';
import Referral from '../models/Referral.js';
import { sendPlanExpiryReminderEmail } from '../utils/mailer.js';

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
    const users = await User.find().sort({ createdAt: -1 })
      .populate('workspaceId', 'name plan')
      .populate('planId', 'name slug price currency period credits');
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

/**
 * Cascade-delete a user and everything they own: workspace, sheets,
 * dashboards, shares, templates, referrals. Used by both the admin
 * delete-user endpoint and the self-delete endpoint.
 */
async function cascadeDeleteUser(userId) {
  const user = await User.findById(userId);
  if (!user) return null;
  const wsId = user.workspaceId;
  if (wsId) {
    await Promise.all([
      Sheet.deleteMany({ workspaceId: wsId }),
      Dashboard.deleteMany({ workspaceId: wsId }),
      Share.deleteMany({ workspaceId: wsId }),
      Template.deleteMany({ workspaceId: wsId }),
    ]);
    await Workspace.deleteOne({ _id: wsId });
  }
  await Referral.deleteMany({ $or: [{ referrerId: userId }, { referredUserId: userId }] });
  await User.deleteOne({ _id: userId });
  return user;
}

/**
 * DELETE /api/admin/users/:id — superadmin deletes any user (except
 * themselves — they should use the self-delete endpoint to avoid
 * accidental self-lockout from the admin panel).
 */
export async function deleteUser(req, res, next) {
  try {
    if (String(req.user._id) === String(req.params.id)) {
      return res.status(400).json({ error: 'Use self-delete to remove your own account.' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    // Don't allow deleting the last superadmin — would brick the install.
    if (target.role === 'superadmin') {
      const count = await User.countDocuments({ role: 'superadmin' });
      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin.' });
      }
    }
    await cascadeDeleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admin/send-reminder/:userId — superadmin manually fires a
 * "your plan is expiring" email at a specific user. Useful before the
 * scheduled cron lands, and as a manual override afterwards.
 */
export async function sendExpiryReminder(req, res, next) {
  try {
    const user = await User.findById(req.params.userId).populate('planId');
    if (!user) {
      console.warn(`[reminder] user ${req.params.userId} not found`);
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      console.warn(`[reminder] user ${user._id} has no valid email`);
      return res.status(400).json({
        error: 'User has no valid email address on file.',
        code: 'invalid_email',
      });
    }
    if (!user.planExpiresAt) {
      return res.status(400).json({
        error: 'User has no plan expiry — nothing to remind about.',
        code: 'no_expiry',
      });
    }
    const days = Math.max(0, Math.ceil((new Date(user.planExpiresAt).getTime() - Date.now()) / 86400000));
    console.log(`[reminder] sending plan-expiry email to ${user.email} (${days}d left)`);
    const result = await sendPlanExpiryReminderEmail(user, user.planId, user.planExpiresAt, days);
    if (!result?.sent) {
      console.warn(`[reminder] FAILED for ${user.email}: ${result?.reason || 'unknown'}`);
      return res.status(502).json({
        error: `Email not sent: ${result?.reason || 'SMTP not configured'}. Open Settings → Email (SMTP) to fix.`,
        code: 'email_failed',
      });
    }
    console.log(`[reminder] OK ${user.email}`);
    res.json({ ok: true, sentTo: user.email, daysRemaining: days });
  } catch (err) {
    console.error('[reminder] unexpected error:', err);
    next(err);
  }
}

/**
 * DELETE /api/auth/account — self-delete. Same cascade as admin delete.
 * Mounted on the auth router because it belongs to the signed-in user's
 * own session, not the admin namespace.
 */
export async function selfDelete(req, res, next) {
  try {
    if (req.user.role === 'superadmin') {
      const count = await User.countDocuments({ role: 'superadmin' });
      if (count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last superadmin.' });
      }
    }
    await cascadeDeleteUser(req.user._id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
