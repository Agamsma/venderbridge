// server/index.js — VendorBridge API + static SPA host
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { ping } = require('./db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers (CSP relaxed to allow the SPA's CDN font + jsPDF)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '256kb' }));

// Rate limiting: tight on auth, looser on the rest of the API
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts — please wait a few minutes and try again' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false });

// ---- Health & readiness ----
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'vendorbridge', time: new Date().toISOString() }));
app.get('/api/ready', async (req, res) => {
  try { await ping(); res.json({ status: 'ready', db: 'up' }); }
  catch { res.status(503).json({ status: 'unavailable', db: 'down' }); }
});

// ---- API routes ----
app.use('/api/auth', authLimiter, require('./routes/auth.routes'));
app.use('/api', apiLimiter);
app.use('/api/vendors', require('./routes/vendors.routes'));
app.use('/api/rfqs', require('./routes/rfqs.routes'));
app.use('/api/approvals', require('./routes/approvals.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/activity', require('./routes/activity.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/bootstrap', require('./routes/bootstrap.routes'));

// Unknown API route → JSON 404 (don't fall through to the SPA)
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ---- Static SPA ----
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, { maxAge: config.isProd ? '1h' : 0 }));
app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ---- Central error handler ----
app.use((err, req, res, next) => {
  console.error('[error]', err.code || '', err.message);
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err))
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That record already exists' });
  if (['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'PROTOCOL_CONNECTION_LOST'].includes(err.code))
    return res.status(503).json({ error: 'Database unavailable — check your .env and that MySQL is running' });
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const server = app.listen(config.port, () => {
  console.log(`\n  VendorBridge [${config.env}] → http://localhost:${config.port}`);
  console.log(`  Health: /api/health   Readiness: /api/ready\n`);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { console.log(`\n${sig} received, shutting down…`); server.close(() => process.exit(0)); });
}

module.exports = app;
