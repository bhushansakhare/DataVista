import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateShare, getShare, listShares, revokeShare,
} from '../controllers/shareController.js';

const r = Router();
r.get('/:token', getShare);
r.post('/generate', requireAuth, generateShare);
r.get('/', requireAuth, listShares);
r.delete('/:id', requireAuth, revokeShare);
export default r;
