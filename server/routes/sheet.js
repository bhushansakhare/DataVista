import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  importSheet, uploadSheet, listSheets, getSheet, refreshSheet, deleteSheet, updateColumns,
} from '../controllers/sheetController.js';

const r = Router();
r.use(requireAuth);
r.post('/import', importSheet);
r.post('/upload', uploadSheet);
r.get('/', listSheets);
r.get('/:id', getSheet);
r.post('/:id/refresh', refreshSheet);
r.patch('/:id/columns', updateColumns);
r.delete('/:id', deleteSheet);
export default r;
