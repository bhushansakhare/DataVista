import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createDashboard, listDashboards, getDashboard, updateDashboard, deleteDashboard,
} from '../controllers/dashboardController.js';

const r = Router();
r.use(requireAuth);
r.post('/', createDashboard);
r.get('/', listDashboards);
r.get('/:id', getDashboard);
r.put('/:id', updateDashboard);
r.delete('/:id', deleteDashboard);
export default r;
