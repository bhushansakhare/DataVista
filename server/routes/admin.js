import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  stats, listUsers, listWorkspaces, updateUserRole, updateWorkspacePlan,
} from '../controllers/adminController.js';

const r = Router();
r.use(requireAuth, requireRole('superadmin'));
r.get('/stats', stats);
r.get('/users', listUsers);
r.get('/workspaces', listWorkspaces);
r.patch('/users/:id/role', updateUserRole);
r.patch('/workspaces/:id/plan', updateWorkspacePlan);
export default r;
