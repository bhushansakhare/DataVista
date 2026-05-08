// Plug-and-play AI module. Mount with one line in server.js:
//
//     import aiRoutes from './modules/claude-ai/index.js';
//     app.use('/api/ai', aiRoutes);
//
// Configuration:
//     ANTHROPIC_API_KEY   required — without it, endpoints fall back to a
//                         deterministic heuristic so the system never breaks.
//     CLAUDE_MODEL        optional — defaults to 'claude-opus-4-7'.

export { default } from './routes/claude.routes.js';
export { isAiAvailable } from './services/claude.service.js';
