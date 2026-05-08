import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listAllTemplates, getTemplateById, createTemplate, updateTemplate, deleteTemplate,
  applyTemplateRoute,
} from '../controllers/templateController.js';

const r = Router();
r.use(requireAuth);

r.get('/', listAllTemplates);
r.post('/', createTemplate);
r.get('/:id', getTemplateById);
r.put('/:id', updateTemplate);
r.delete('/:id', deleteTemplate);
r.post('/:id/apply', applyTemplateRoute);

export default r;
