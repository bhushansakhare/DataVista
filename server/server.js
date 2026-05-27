import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { Server as SocketServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import passport from 'passport';
import authRoutes from './routes/auth.js';
import oauthRoutes from './routes/oauth.js';
import sheetRoutes from './routes/sheet.js';
import dashboardRoutes from './routes/dashboard.js';
import shareRoutes from './routes/share.js';
import adminRoutes from './routes/admin.js';
import systemSettingsRoutes from './routes/systemSettings.js';
import templatesRoutes from './routes/templates.js';
import integrationsRoutes from './modules/integrations/integration.routes.js';
import aiRoutes from './modules/claude-ai/index.js';
import plansRoutes from './routes/plans.js';
import paymentsRoutes from './routes/payments.js';
import { startSheetPoller } from './services/sheetPoller.js';
import { backfillReferralCodes } from './migrations/backfillReferralCodes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

const io = new SocketServer(server, {






  cors: { origin: CLIENT_URL, credentials: true },
});

app.set('io', io);

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Passport handles OAuth strategies without session — JWTs are issued
// directly in the OAuth callback and stored client-side.
app.use(passport.initialize());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/sheet', sheetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/system-settings', systemSettingsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/payments', paymentsRoutes);

// ─── Static + SPA fallback ────────────────────────────────────────────────
// Serves the built React app and routes non-API URLs (including /s/:token,
// /app/*, /dashboard/*) to dist/index.html so React Router can pick them up
// after a hard refresh, direct link open, or QR scan.
//
// Tries several candidate paths because cPanel/Plesk/Render lay out the
// repo differently — some put the server next to client/dist, others inside
// public_html, others alongside a flat dist/ directory.
function findClientDist() {
  const env = process.env.CLIENT_DIST_PATH;
  const candidates = [
    env && path.resolve(env),
    path.resolve(__dirname, '..', 'client', 'dist'),
    path.resolve(__dirname, 'client', 'dist'),
    path.resolve(__dirname, '..', 'dist'),
    path.resolve(__dirname, 'dist'),
    path.resolve(process.cwd(), 'client', 'dist'),
    path.resolve(process.cwd(), 'dist'),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

const CLIENT_DIST = findClientDist();
if (CLIENT_DIST) {
  console.log(`[sheetflow] serving SPA from ${CLIENT_DIST}`);
  app.use(express.static(CLIENT_DIST));
  // Catch-all for non-API paths — must be a regex so `/api/*` is excluded.
  app.get(/^(?!\/api\/).+/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.warn(
    '[sheetflow] client/dist not found — SPA routes (/s/:token, /app/*) will 404. ' +
    'Run `npm run build` in client/, or set CLIENT_DIST_PATH env var.'
  );
}

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

io.on('connection', (socket) => {
  socket.on('subscribe:sheet', (sheetId) => {
    if (sheetId) socket.join(`sheet:${sheetId}`);
  });
  socket.on('unsubscribe:sheet', (sheetId) => {
    if (sheetId) socket.leave(`sheet:${sheetId}`);
  });
  socket.on('subscribe:dashboard', (dashboardId) => {
    if (dashboardId) socket.join(`dashboard:${dashboardId}`);
  });
});

await connectDB(process.env.MONGO_URI);
// Fire-and-forget — backfill must not block server start. If it errors,
// it self-logs and the server still answers requests on fresh codes.
backfillReferralCodes().catch((err) =>
  console.warn('[startup] backfillReferralCodes:', err?.message),
);
server.listen(PORT, () => {
  console.log(`[sheetflow] api listening on :${PORT}`);
  startSheetPoller(io);
});
