import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.js';
import sheetRoutes from './routes/sheet.js';
import dashboardRoutes from './routes/dashboard.js';
import shareRoutes from './routes/share.js';
import adminRoutes from './routes/admin.js';
import { startSheetPoller } from './services/sheetPoller.js';

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

const io = new SocketServer(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});

app.set('io', io);

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '5mb' }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/sheet', sheetRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/admin', adminRoutes);

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
server.listen(PORT, () => {
  console.log(`[sheetflow] api listening on :${PORT}`);
  startSheetPoller(io);
});
