'use strict';

/**
 * Segmento Enterprise API Gateway Entry Point
 * Wires together OIDC Discovery, OAuth2 Endpoints, RS256 Verification, Rate Limiting, RBAC, and Tenancy.
 */

const discoveryRoutes = require('./routes/discovery.routes');
const oauthRoutes = require('./routes/oauth.routes');
const correlationTracker = require('./middleware/correlation-tracker');
const rateLimiter = require('./middleware/rate-limiter');
const oidcVerifier = require('./middleware/oidc-verifier');
const scopeGuard = require('./middleware/scope-guard');
const tenantGuard = require('./middleware/tenant-guard');
const keyManager = require('./crypto/key-manager');
const oidcProvider = require('./services/oidc-provider-service');
const config = require('./config/gateway.config');

function setupGateway(app) {
  // 1. Inbound Distributed Correlation Tracing
  app.use(correlationTracker);

  // 2. OpenID Connect Discovery & JWKS (Public RFC Endpoints)
  app.use('/.well-known', discoveryRoutes);

  // 3. OAuth 2.0 & OIDC Token Issuer Endpoints
  app.use('/oauth', oauthRoutes);

  // 4. Rate Limiting Middleware (Applied to /api endpoints)
  app.use('/api', rateLimiter.middleware());

  console.log('[Segmento Gateway] OAuth 2.0 / OIDC Gateway Pipeline Initialized');
  console.log('[Segmento Gateway] Discovery: /.well-known/openid-configuration | JWKS: /.well-known/jwks.json');
}

module.exports = {
  setupGateway,
  discoveryRoutes,
  oauthRoutes,
  correlationTracker,
  rateLimiter,
  oidcVerifier,
  scopeGuard,
  tenantGuard,
  keyManager,
  oidcProvider,
  config
};
