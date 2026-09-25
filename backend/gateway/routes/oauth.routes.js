'use strict';

/**
 * OAuth 2.0 & OIDC Endpoints Router
 * Handles token issuance, revocation, introspection, userinfo, and client registry.
 */

const express = require('express');
const oidcProvider = require('../services/oidc-provider-service');
const config = require('../config/gateway.config');

const router = express.Router();

// ── POST /oauth/token ─────────────────────────────────────────────────────────
router.post('/token', async (req, res) => {
  try {
    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const tokenResponse = await oidcProvider.handleTokenRequest(req.body, req.headers, baseUrl);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json(tokenResponse);
  } catch (err) {
    const status = err.message.startsWith('invalid_client')
      ? 401
      : err.message.startsWith('invalid_grant') || err.message.startsWith('invalid_request')
      ? 400
      : 400;

    const [errorCode, errorDescription] = err.message.split(': ');
    return res.status(status).json({
      error: errorCode || 'invalid_request',
      error_description: errorDescription || err.message
    });
  }
});

// ── POST /oauth/revoke ────────────────────────────────────────────────────────
router.post('/revoke', (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    oidcProvider.revokeToken(token);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: err.message
    });
  }
});

// ── POST /oauth/introspect ───────────────────────────────────────────────────
router.post('/introspect', async (req, res) => {
  try {
    const token = req.body.token;
    const result = await oidcProvider.introspectToken(token);
    return res.json(result);
  } catch (err) {
    return res.json({ active: false });
  }
});

// ── GET /oauth/userinfo ───────────────────────────────────────────────────────
router.get('/userinfo', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Missing bearer token"');
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Bearer token is required to access /oauth/userinfo'
    });
  }

  const token = authHeader.split(' ')[1];
  const introspection = await oidcProvider.introspectToken(token);

  if (!introspection.active) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token", error_description="Token is expired or invalid"');
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token is expired, revoked, or invalid'
    });
  }

  return res.json({
    sub: introspection.sub,
    client_id: introspection.client_id,
    roles: introspection.roles || ['PRIVACY_OPERATOR'],
    tenant_id: introspection.tenant_id,
    scope: introspection.scope,
    email: 'dpo@segmento.com',
    name: 'Manojya Sharma',
    department: 'Privacy & Compliance'
  });
});

// ── GET /oauth/clients ────────────────────────────────────────────────────────
router.get('/clients', (req, res) => {
  const publicClients = config.clients.map(c => ({
    clientId: c.clientId,
    name: c.name,
    allowedGrantTypes: c.allowedGrantTypes,
    defaultScopes: c.defaultScopes,
    tenantId: c.tenantId
  }));
  return res.json({ success: true, count: publicClients.length, clients: publicClients });
});

// ── POST /oauth/authorize (Mock Authorization Endpoint for PKCE testing) ──────
router.post('/authorize', (req, res) => {
  try {
    const { client_id, response_type, code_challenge, scope } = req.body;
    if (response_type !== 'code') {
      return res.status(400).json({ error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' });
    }

    const mockUser = {
      sub: req.body.user_id || 'usr_dpo_8842',
      name: req.body.user_name || 'Manojya Sharma',
      email: req.body.user_email || 'dpo@segmento.com',
      department: 'Privacy & Compliance',
      roles: req.body.roles || ['DPO_LEAD', 'PRIVACY_ADMIN']
    };

    const scopes = scope ? scope.split(' ') : undefined;
    const code = oidcProvider.createAuthorizationCode(client_id, mockUser, code_challenge, scopes);

    return res.json({
      success: true,
      code: code,
      redirect_uri: req.body.redirect_uri || 'http://localhost:3000/callback'
    });
  } catch (err) {
    return res.status(400).json({ error: 'invalid_request', error_description: err.message });
  }
});

module.exports = router;
