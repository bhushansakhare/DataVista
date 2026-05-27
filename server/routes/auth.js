import { Router } from 'express';
import {
  register, login, me, updateApiKeys, forgotPassword, resetPassword, updateProfile,
} from '../controllers/authController.js';
import { selfDelete } from '../controllers/adminController.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.post('/register', register);
r.post('/login', login);
r.post('/forgot-password', forgotPassword);
r.post('/reset-password', resetPassword);
r.get('/me', requireAuth, me);
r.patch('/api-keys', requireAuth, updateApiKeys);
r.patch('/profile', requireAuth, updateProfile);
r.delete('/account', requireAuth, selfDelete);
export default r;
