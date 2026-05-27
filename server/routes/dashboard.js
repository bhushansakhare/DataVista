import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createDashboard, listDashboards, getDashboard, updateDashboard, deleteDashboard,
  dashboardHistory,
} from '../controllers/dashboardController.js';

const r = Router();
r.use(requireAuth);

r.post('/', createDashboard);
r.get('/', listDashboards);
// /history must be declared before /:id so Express doesn't treat "history" as an :id.
r.get('/history', dashboardHistory);
r.get('/:id', getDashboard);
r.put('/:id', updateDashboard);
r.delete('/:id', deleteDashboard);
export default r;
