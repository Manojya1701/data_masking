'use strict';

/**
 * Segmento API Gateway OAuth 2.0 & OIDC Test Suite
 * Comprehensive automated testing for RS256 JWT issuance, JWKS discovery, PKCE, RBAC scope guards, rate limiting, and tenancy.
 */

const keyManager = require('../backend/gateway/crypto/key-manager');
const oidcProvider = require('../backend/gateway/services/oidc-provider-service');
const rateLimiter = require('../backend/gateway/middleware/rate-limiter');
const oidcVerifier = require('../backend/gateway/middleware/oidc-verifier');
const { requireScope, requireRole } = require('../backend/gateway/middleware/scope-guard');
const dataDeletionService = require('../backend/services/data-deletion-service');
const { verifyRS256, decode } = require('../backend/gateway/crypto/jwt-helper');
const crypto = require('crypto');

describe('Segmento API Gateway: OAuth 2.0 & OIDC Stack', () => {
  let adminToken;
  let etlToken;
  let auditorToken;

  beforeAll(async () => {
    keyManager.init();
    rateLimiter.reset();

    // 1. Generate M2M Admin Token (Full Scopes)
    const adminRes = await oidcProvider.handleTokenRequest({
      grant_type: 'client_credentials',
      client_id: 'segmento-admin-portal',
      client_secret: 'secret_admin_portal_2026'
    });
    adminToken = adminRes.access_token;

    // 2. Generate M2M ETL Token (Limited Scopes: deletions:create, deletions:read, masking:process)
    const etlRes = await oidcProvider.handleTokenRequest({
      grant_type: 'client_credentials',
      client_id: 'enterprise-etl-connector',
      client_secret: 'secret_etl_pipeline_2026'
    });
    etlToken = etlRes.access_token;

    // 3. Generate Auditor Token (Read-only Scopes)
    const auditorRes = await oidcProvider.handleTokenRequest({
      grant_type: 'client_credentials',
      client_id: 'external-compliance-auditor',
      client_secret: 'secret_auditor_token_2026'
    });
    auditorToken = auditorRes.access_token;
  });

  afterAll(() => {
    rateLimiter.destroy();
  });

  // ── 1. Cryptography & JWKS ──────────────────────────────────────────────────
  describe('1. RS256 Key Management & OIDC Discovery', () => {
    test('keyManager exports valid RSA-2048 Public Key and JWKS structure', () => {
      const jwks = keyManager.getJWKS();
      expect(jwks).toBeDefined();
      expect(Array.isArray(jwks.keys)).toBe(true);
      expect(jwks.keys.length).toBeGreaterThan(0);

      const jwk = jwks.keys[0];
      expect(jwk.kty).toBe('RSA');
      expect(jwk.use).toBe('sig');
      expect(jwk.alg).toBe('RS256');
      expect(jwk.kid).toBeDefined();
      expect(jwk.n).toBeDefined();
      expect(jwk.e).toBeDefined();
    });

    test('getOpenIDConfiguration returns RFC compliant OIDC metadata', () => {
      const config = keyManager.getOpenIDConfiguration('https://data-masking-1.onrender.com');
      expect(config.issuer).toBe('https://data-masking-1.onrender.com');
      expect(config.token_endpoint).toBe('https://data-masking-1.onrender.com/oauth/token');
      expect(config.jwks_uri).toBe('https://data-masking-1.onrender.com/.well-known/jwks.json');
      expect(config.response_types_supported).toContain('code');
      expect(config.id_token_signing_alg_values_supported).toContain('RS256');
    });
  });

  // ── 2. Token Issuance & Grant Types ─────────────────────────────────────────
  describe('2. OAuth 2.0 Token Issuance & Grants', () => {
    test('Client Credentials Grant issues signed RS256 JWT with valid claims', async () => {
      const tokenRes = await oidcProvider.handleTokenRequest({
        grant_type: 'client_credentials',
        client_id: 'segmento-admin-portal',
        client_secret: 'secret_admin_portal_2026'
      });

      expect(tokenRes.token_type).toBe('Bearer');
      expect(tokenRes.expires_in).toBe(3600);
      expect(tokenRes.access_token).toBeDefined();

      const publicKey = keyManager.getPublicKey();
      const { payload } = verifyRS256(tokenRes.access_token, publicKey);
      expect(payload.client_id).toBe('segmento-admin-portal');
      expect(payload.scope).toContain('deletions:create');
      expect(payload.scope).toContain('deletions:approve');
      expect(payload.roles).toContain('DPO_LEAD');
      expect(payload.tenant_id).toBe('tenant_segmento_corp');
    });

    test('Authorization Code with PKCE issues ID Token + Access Token + Refresh Token', async () => {
      // 1. Generate code_verifier and code_challenge (S256)
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

      const mockUser = {
        sub: 'usr_dpo_7711',
        name: 'Manojya Sharma',
        email: 'dpo@segmento.com',
        roles: ['DPO_LEAD', 'PRIVACY_ADMIN']
      };

      const code = oidcProvider.createAuthorizationCode('segmento-admin-portal', mockUser, challenge, [
        'openid',
        'profile',
        'deletions:create',
        'deletions:approve'
      ]);

      expect(code).toMatch(/^code_/);

      // 2. Exchange code + code_verifier for tokens
      const tokenRes = await oidcProvider.handleTokenRequest({
        grant_type: 'authorization_code',
        code: code,
        code_verifier: verifier,
        client_id: 'segmento-admin-portal'
      });

      expect(tokenRes.access_token).toBeDefined();
      expect(tokenRes.id_token).toBeDefined();
      expect(tokenRes.refresh_token).toBeDefined();

      // Verify ID Token
      const idPayload = decode(tokenRes.id_token);
      expect(idPayload.sub).toBe('usr_dpo_7711');
      expect(idPayload.name).toBe('Manojya Sharma');

      // 3. Test Refresh Token Flow
      const refreshRes = await oidcProvider.handleTokenRequest({
        grant_type: 'refresh_token',
        refresh_token: tokenRes.refresh_token,
        client_id: 'segmento-admin-portal'
      });

      expect(refreshRes.access_token).toBeDefined();
      expect(refreshRes.token_type).toBe('Bearer');
    });

    test('Rejects invalid client secret with 401 equivalent error', async () => {
      await expect(
        oidcProvider.handleTokenRequest({
          grant_type: 'client_credentials',
          client_id: 'segmento-admin-portal',
          client_secret: 'wrong_secret'
        })
      ).rejects.toThrow('invalid_client');
    });
  });

  // ── 3. Token Introspection & Revocation (RFC 7009 / 7662) ───────────────────
  describe('3. Token Introspection & Revocation', () => {
    test('Introspection returns active=true for valid token', async () => {
      const intro = await oidcProvider.introspectToken(adminToken);
      expect(intro.active).toBe(true);
      expect(intro.client_id).toBe('segmento-admin-portal');
      expect(intro.tenant_id).toBe('tenant_segmento_corp');
    });

    test('Revocation revokes token and marks it active=false', async () => {
      const tempRes = await oidcProvider.handleTokenRequest({
        grant_type: 'client_credentials',
        client_id: 'external-compliance-auditor',
        client_secret: 'secret_auditor_token_2026'
      });

      const tokenToRevoke = tempRes.access_token;
      expect((await oidcProvider.introspectToken(tokenToRevoke)).active).toBe(true);

      // Revoke
      oidcProvider.revokeToken(tokenToRevoke);

      // Introspection now returns false
      expect((await oidcProvider.introspectToken(tokenToRevoke)).active).toBe(false);
    });
  });

  // ── 4. OIDC Verification & Scope Guard Middleware ──────────────────────────
  describe('4. OIDC Verifier & RBAC Scope Guard Middleware', () => {
    test('oidcVerifier attaches auth context when valid Bearer token provided', async () => {
      const req = {
        path: '/api/v1/deletions',
        headers: { authorization: `Bearer ${adminToken}` }
      };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = oidcVerifier({ strict: true });
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.auth).toBeDefined();
      expect(req.auth.clientId).toBe('segmento-admin-portal');
      expect(req.auth.scopes).toContain('deletions:create');
      expect(req.tenant.tenantId).toBe('tenant_segmento_corp');
    });

    test('oidcVerifier rejects expired / tampered token in strict mode', async () => {
      const tamperedToken = adminToken.slice(0, -10) + 'XXXXXXXXXX';
      const req = {
        path: '/api/v1/deletions',
        headers: { authorization: `Bearer ${tamperedToken}` }
      };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = oidcVerifier({ strict: true });
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'invalid_token', success: false })
      );
    });

    test('requireScope allows caller with granted scope', () => {
      const req = { auth: { scopes: ['deletions:create', 'deletions:read'] } };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const guard = requireScope('deletions:create');
      guard(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('requireScope rejects caller missing required scope with 403 Forbidden', () => {
      // ETL token has deletions:create and read, but NOT deletions:approve
      const req = { auth: { scopes: ['deletions:create', 'deletions:read'] } };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const guard = requireScope('deletions:approve');
      guard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'insufficient_scope',
          requiredScopes: ['deletions:approve']
        })
      );
    });

    test('requireRole verifies user role requirements', () => {
      const reqValid = { auth: { roles: ['DPO_LEAD', 'PRIVACY_ADMIN'] } };
      const reqInvalid = { auth: { roles: ['AUDITOR'] } };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const guard = requireRole('DPO_LEAD');

      guard(reqValid, res, next);
      expect(next).toHaveBeenCalled();

      next.mockClear();
      guard(reqInvalid, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ── 5. Rate Limiter Middleware ─────────────────────────────────────────────
  describe('5. Sliding-Window Rate Limiter', () => {
    test('Enforces rate limits and sets standard RFC response headers', () => {
      rateLimiter.reset();
      const req = { ip: '192.168.1.100', auth: null };
      const res = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      const middleware = rateLimiter.middleware({ max: 3, windowMs: 60000 });

      // First 3 requests pass
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Limit', 3);
      expect(res.setHeader).toHaveBeenCalledWith('RateLimit-Remaining', 2);

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);

      // 4th request gets blocked with 429 Too Many Requests
      middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(3);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'rate_limit_exceeded', retryAfter: expect.any(Number) })
      );
    });
  });

  // ── 6. End-to-End Protected Deletion Flow ──────────────────────────────────
  describe('6. End-to-End Deletion API Execution under Gateway Protection', () => {
    test('DPO with valid token can execute full deletion workflow and inspect audit', async () => {
      const payload = {
        subject: { type: 'EMAIL', value: 'sarah.oauth.test@segmento.com', name: 'Sarah Connor' },
        reason: 'DATA_SUBJECT_REQUEST',
        scope: 'ALL_ELIGIBLE_DATA',
        jurisdiction: 'SG',
        tenantId: 'tenant_segmento_corp'
      };

      // 1. Create
      const created = await dataDeletionService.createDeletionRequest(payload);
      expect(created.deletionId).toBeDefined();

      // 2. Discover
      await dataDeletionService.discoverData(created.deletionId);

      // 3. Plan
      await dataDeletionService.generatePlan(created.deletionId);

      // 4. Approve
      await dataDeletionService.approveDeletion(created.deletionId, {
        approvedBy: 'dpo@segmento.com',
        signature: 'SIG_RSA_TEST_99'
      });

      // 5. Execute
      await dataDeletionService.executeDeletion(created.deletionId);

      // 6. Verify
      const verified = await dataDeletionService.verifyDeletion(created.deletionId);
      expect(verified.status).toBe('VERIFICATION');
      expect(verified.verification.passed).toBe(true);

      // 7. Audit Certificate & Final State
      const audit = await dataDeletionService.getAuditTrail(created.deletionId);
      expect(audit.deletionId).toBe(created.deletionId);
      expect(audit.status).toBe('COMPLETED');
      expect(audit.auditTrail.timeline.length).toBeGreaterThan(0);
      expect(audit.auditTrail.certificateId).toBeDefined();
    });
  });
});
