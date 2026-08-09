'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const processRoutes = require('./routes/process.routes');

const app  = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Security middleware ───────────────────────────────────────────────────────

// Prevent caching of sensitive API responses
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Basic security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('Referrer-Policy', 'no-referrer');
  next();
});

// ── Body parsers ──────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ── Static frontend ───────────────────────────────────────────────────────────

const FRONTEND_DIR = path.join(__dirname, '../frontend/public');
app.use(express.static(FRONTEND_DIR, {
  index: 'index.html',
  etag: true,
}));

// ── API routes ────────────────────────────────────────────────────────────────

app.use('/api', processRoutes);

// ── SPA fallback ──────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  // Do NOT log file contents or passwords
  console.error('[UDPS Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ success: false, error: err.message || 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[UDPS] Server running at http://localhost:${PORT}`);
  console.log(`[UDPS] Frontend: ${FRONTEND_DIR}`);
});

module.exports = app;
