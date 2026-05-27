import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSettings, updateSettings } from '../controllers/systemSettingsController.js';

function requireSuperadmin(req, res, next) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin only.' });
  }
  next();
}

const r = Router();
r.use(requireAuth, requireSuperadmin);
r.get('/', getSettings);
r.patch('/', updateSettings);

export default r;
