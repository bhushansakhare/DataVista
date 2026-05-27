import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { connect, list, remove, fetchData } from './integration.controller.js';

const r = Router();
r.use(requireAuth);

r.post('/connect', connect);
r.get('/', list);
r.delete('/:id', remove);
// Both verbs are accepted so callers can use either:
//   fetch('/api/integrations/:id/fetch-data')             (GET, default)
//   api.post('/integrations/:id/fetch-data')              (POST, our client)
r.post('/:id/fetch-data', fetchData);
r.get('/:id/fetch-data',  fetchData);

export default r;
