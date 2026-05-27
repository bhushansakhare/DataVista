import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listPublicPlans, listAllPlans, createPlan, updatePlan, deletePlan,
  getMyPlan, selectMyPlan, getMyCreditHistory,
  regenerateMyReferralCode, getMyReferrals,
} from '../controllers/planController.js';

function requireSuperadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin only.' });
  }
  next();
}

const r = Router();

// Public listing — used by /pricing on the marketing site.
r.get('/', listPublicPlans);

// Authenticated user actions
r.get('/me',                 requireAuth, getMyPlan);
r.post('/me/select',         requireAuth, selectMyPlan);
r.get('/me/credit-history',  requireAuth, getMyCreditHistory);
r.get('/me/referrals',       requireAuth, getMyReferrals);
r.post('/me/regenerate-code', requireAuth, regenerateMyReferralCode);

// Admin plan management
r.get('/admin',       requireAuth, requireSuperadmin, listAllPlans);
r.post('/admin',      requireAuth, requireSuperadmin, createPlan);
r.patch('/admin/:id', requireAuth, requireSuperadmin, updatePlan);
r.delete('/admin/:id',requireAuth, requireSuperadmin, deletePlan);

export default r;
