'use strict';

/**
 * Segmento API Gateway Configuration
 * Defines OIDC Issuer metadata, rate limiting rules, public routes whitelist, and RBAC policies.
 */

const path = require('path');
require('dotenv').config();

module.exports = {
  // Gateway General Settings
  gateway: {
    enabled: process.env.GATEWAY_ENABLED !== 'false',
    name: 'Segmento Enterprise API Gateway',
    version: '1.0.0',
    issuer: process.env.OIDC_ISSUER_URL || 'https://data-masking-1.onrender.com',
    audience: process.env.OIDC_AUDIENCE || 'segmento-api-gateway',
    jwksUri: process.env.OIDC_JWKS_URI || '/.well-known/jwks.json',
    tokenUri: process.env.OIDC_TOKEN_URI || '/oauth/token',
    userInfoUri: process.env.OIDC_USERINFO_URI || '/oauth/userinfo'
  },

  // Cryptographic Key Management
  crypto: {
    algorithm: 'RS256',
    keyId: 'segmento-rsa-key-2026-v1',
    tokenTtlSeconds: 3600, // 1 hour
    refreshTokenTtlSeconds: 86400 * 30, // 30 days
    keysDirectory: path.join(__dirname, '..', 'keys')
  },

  // Rate Limiting Policy
  rateLimiting: {
    enabled: true,
    windowMs: 60 * 1000, // 1 minute window
    defaultMax: 120,      // 120 req/min for general callers
    authenticatedMax: 600, // 600 req/min for authenticated M2M connectors
    burstMax: 30          // Burst limit per 5 seconds
  },

  // Multi-Tenant Isolation Defaults
  tenancy: {
    defaultTenantId: 'tenant_default',
    headerKey: 'x-tenant-id',
    enforceIsolation: true
  },

  // Route Whitelist (Routes that do NOT require Bearer Token authentication)
  publicRoutes: [
    '/',
    '/api/health',
    '/.well-known/openid-configuration',
    '/.well-known/jwks.json',
    '/oauth/token',
    '/oauth/revoke',
    '/api/dsar/intake/submit' // Public citizen submission endpoint
  ],

  // Registered M2M Clients for local testing / development
  clients: [
    {
      clientId: 'segmento-admin-portal',
      clientSecret: 'secret_admin_portal_2026',
      name: 'Segmento Web Portal & DPO Console',
      allowedGrantTypes: ['authorization_code', 'client_credentials', 'refresh_token'],
      defaultScopes: [
        'openid',
        'profile',
        'email',
        'deletions:create',
        'deletions:read',
        'deletions:write',
        'deletions:approve',
        'deletions:execute',
        'deletions:verify',
        'deletions:cancel',
        'audit:read',
        'webhooks:manage',
        'dsar:operator',
        'dsar:admin',
        'masking:process'
      ],
      defaultRoles: ['DPO_LEAD', 'PRIVACY_ADMIN'],
      tenantId: 'tenant_segmento_corp'
    },
    {
      clientId: 'enterprise-etl-connector',
      clientSecret: 'secret_etl_pipeline_2026',
      name: 'Automated ETL & Data Lake Connector',
      allowedGrantTypes: ['client_credentials'],
      defaultScopes: [
        'deletions:create',
        'deletions:read',
        'deletions:write',
        'deletions:execute',
        'masking:process'
      ],
      defaultRoles: ['CONNECTOR_SERVICE'],
      tenantId: 'tenant_enterprise_dw'
    },
    {
      clientId: 'external-compliance-auditor',
      clientSecret: 'secret_auditor_token_2026',
      name: 'Independent Regulatory Auditor',
      allowedGrantTypes: ['client_credentials'],
      defaultScopes: [
        'deletions:read',
        'audit:read'
      ],
      defaultRoles: ['AUDITOR'],
      tenantId: 'tenant_regulatory_sg'
    }
  ]
};
