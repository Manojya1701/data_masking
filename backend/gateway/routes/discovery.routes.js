'use strict';

/**
 * OpenID Connect Discovery Routes
 * Exposes standard RFC endpoints for OpenID Configuration and JWKS.
 */

const express = require('express');
const keyManager = require('../crypto/key-manager');

const router = express.Router();

// ── GET /.well-known/openid-configuration ─────────────────────────────────────
router.get('/openid-configuration', (req, res) => {
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  const baseUrl = `${protocol}://${host}`;
  const config = keyManager.getOpenIDConfiguration(baseUrl);
  return res.json(config);
});

// ── GET /.well-known/jwks.json ────────────────────────────────────────────────
router.get('/jwks.json', async (req, res) => {
  try {
    const jwks = await keyManager.getJWKS();
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(jwks);
  } catch (err) {
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to retrieve JWKS: ' + err.message
    });
  }
});

module.exports = router;
