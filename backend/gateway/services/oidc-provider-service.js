'use strict';

/**
 * Segmento Embedded OIDC & OAuth 2.0 Provider Service
 * Issues RS256-signed JWT Access Tokens, ID Tokens, and handles standard RFC grant types.
 */

const crypto = require('crypto');
const keyManager = require('../crypto/key-manager');
const { signRS256, decode } = require('../crypto/jwt-helper');
const config = require('../config/gateway.config');

class OIDCProviderService {
  constructor() {
    this.authCodes = new Map();     // code -> { client, user, codeChallenge, scopes, expiresAt }
    this.refreshTokens = new Map(); // token -> { client, user, scopes, expiresAt }
    this.revokedTokens = new Set();  // token / jti blacklist
  }

  /**
   * Authenticates a client via client_secret or body params
   */
  authenticateClient(clientId, clientSecret) {
    if (!clientId) {
      throw new Error('invalid_client: client_id is required');
    }

    const client = config.clients.find(c => c.clientId === clientId);
    if (!client) {
      throw new Error('invalid_client: Unknown client_id');
    }

    if (clientSecret && client.clientSecret && client.clientSecret !== clientSecret) {
      throw new Error('invalid_client: Invalid client_secret');
    }

    return client;
  }

  /**
   * Handles POST /oauth/token for all grant types
   */
  async handleTokenRequest(body, reqHeaders, baseUrl) {
    const grantType = body.grant_type;
    const issuer = baseUrl || config.gateway.issuer;

    if (!grantType) {
      throw new Error('invalid_request: grant_type is required');
    }

    // Extract client credentials (from header or body)
    let clientId = body.client_id;
    let clientSecret = body.client_secret;

    if (reqHeaders && reqHeaders.authorization && reqHeaders.authorization.startsWith('Basic ')) {
      const b64 = reqHeaders.authorization.split(' ')[1];
      const decoded = Buffer.from(b64, 'base64').toString('utf8');
      const parts = decoded.split(':');
      clientId = parts[0];
      clientSecret = parts[1];
    }

    const privateKey = keyManager.getPrivateKey();
    const now = Math.floor(Date.now() / 1000);
    const ttl = config.crypto.tokenTtlSeconds;

    // ── 1. Client Credentials Grant (M2M) ──────────────────────────────────
    if (grantType === 'client_credentials') {
      const client = this.authenticateClient(clientId, clientSecret);
      
      const requestedScopes = body.scope ? body.scope.split(' ') : client.defaultScopes;
      const allowedScopes = requestedScopes.filter(s => client.defaultScopes.includes(s));
      const scopesStr = allowedScopes.join(' ');
      const jti = 'jwt_' + crypto.randomUUID();

      const payload = {
        iss: issuer,
        sub: client.clientId,
        aud: config.gateway.audience,
        client_id: client.clientId,
        client_name: client.name,
        scope: scopesStr,
        roles: client.defaultRoles,
        tenant_id: client.tenantId,
        iat: now,
        exp: now + ttl,
        jti: jti
      };

      const accessToken = signRS256(payload, privateKey, { kid: config.crypto.keyId });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ttl,
        scope: scopesStr,
        tenant_id: client.tenantId
      };
    }

    // ── 2. Authorization Code Grant (with PKCE) ────────────────────────────
    if (grantType === 'authorization_code') {
      const code = body.code;
      const codeVerifier = body.code_verifier;

      if (!code) throw new Error('invalid_request: code is required');
      const authData = this.authCodes.get(code);

      if (!authData || Date.now() > authData.expiresAt) {
        throw new Error('invalid_grant: Authorization code is invalid or expired');
      }

      // Verify PKCE if present
      if (authData.codeChallenge) {
        if (!codeVerifier) throw new Error('invalid_grant: code_verifier is required for PKCE');
        const calculatedChallenge = crypto
          .createHash('sha256')
          .update(codeVerifier)
          .digest('base64url');

        if (calculatedChallenge !== authData.codeChallenge && codeVerifier !== authData.codeChallenge) {
          throw new Error('invalid_grant: Invalid PKCE code_verifier');
        }
      }

      // Burn code (one-time use)
      this.authCodes.delete(code);

      const client = authData.client;
      const user = authData.user || {
        sub: 'usr_dpo_8842',
        name: 'Manojya Sharma',
        email: 'dpo@segmento.com',
        department: 'Privacy & Compliance',
        roles: ['DPO_LEAD', 'PRIVACY_ADMIN']
      };

      const jti = 'jwt_' + crypto.randomUUID();
      const scopesStr = authData.scopes ? authData.scopes.join(' ') : client.defaultScopes.join(' ');

      // Access Token
      const accessPayload = {
        iss: issuer,
        sub: user.sub,
        aud: config.gateway.audience,
        client_id: client.clientId,
        scope: scopesStr,
        roles: user.roles,
        tenant_id: client.tenantId,
        user: {
          name: user.name,
          email: user.email,
          department: user.department
        },
        iat: now,
        exp: now + ttl,
        jti: jti
      };
      const accessToken = signRS256(accessPayload, privateKey, { kid: config.crypto.keyId });

      // OIDC ID Token
      const idPayload = {
        iss: issuer,
        sub: user.sub,
        aud: client.clientId,
        name: user.name,
        email: user.email,
        department: user.department,
        roles: user.roles,
        tenant_id: client.tenantId,
        iat: now,
        exp: now + ttl
      };
      const idToken = signRS256(idPayload, privateKey, { kid: config.crypto.keyId });

      // Refresh Token
      const refreshToken = 'rt_' + crypto.randomBytes(32).toString('hex');
      this.refreshTokens.set(refreshToken, {
        client,
        user,
        scopes: authData.scopes || client.defaultScopes,
        expiresAt: Date.now() + config.crypto.refreshTokenTtlSeconds * 1000
      });

      return {
        access_token: accessToken,
        id_token: idToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: ttl,
        scope: scopesStr
      };
    }

    // ── 3. Refresh Token Grant ─────────────────────────────────────────────
    if (grantType === 'refresh_token') {
      const rToken = body.refresh_token;
      if (!rToken) throw new Error('invalid_request: refresh_token is required');

      const refreshData = this.refreshTokens.get(rToken);
      if (!refreshData || Date.now() > refreshData.expiresAt) {
        throw new Error('invalid_grant: Refresh token is invalid or expired');
      }

      const client = refreshData.client;
      const user = refreshData.user;
      const jti = 'jwt_' + crypto.randomUUID();
      const scopesStr = refreshData.scopes.join(' ');

      const accessPayload = {
        iss: issuer,
        sub: user ? user.sub : client.clientId,
        aud: config.gateway.audience,
        client_id: client.clientId,
        scope: scopesStr,
        roles: user ? user.roles : client.defaultRoles,
        tenant_id: client.tenantId,
        user: user ? { name: user.name, email: user.email } : undefined,
        iat: now,
        exp: now + ttl,
        jti: jti
      };

      const accessToken = signRS256(accessPayload, privateKey, { kid: config.crypto.keyId });

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ttl,
        scope: scopesStr
      };
    }

    throw new Error(`unsupported_grant_type: ${grantType} is not supported`);
  }

  createAuthorizationCode(clientId, user, codeChallenge, scopes) {
    const client = config.clients.find(c => c.clientId === clientId) || config.clients[0];
    const code = 'code_' + crypto.randomBytes(24).toString('hex');
    this.authCodes.set(code, {
      client,
      user,
      codeChallenge,
      scopes: scopes || client.defaultScopes,
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    return code;
  }

  revokeToken(token) {
    if (!token) return { success: true };
    this.revokedTokens.add(token);
    this.refreshTokens.delete(token);

    try {
      const decodedPayload = decode(token);
      if (decodedPayload && decodedPayload.jti) {
        this.revokedTokens.add(decodedPayload.jti);
      }
    } catch (_) {}
    return { success: true };
  }

  isTokenRevoked(token, jti) {
    return this.revokedTokens.has(token) || (jti && this.revokedTokens.has(jti));
  }

  async introspectToken(token) {
    if (!token) return { active: false };
    if (this.isTokenRevoked(token)) return { active: false };

    try {
      const decoded = decode(token);
      if (!decoded) return { active: false };

      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return { active: false };
      }
      return {
        active: true,
        scope: decoded.scope,
        client_id: decoded.client_id,
        sub: decoded.sub,
        exp: decoded.exp,
        iat: decoded.iat,
        iss: decoded.iss,
        aud: decoded.aud,
        tenant_id: decoded.tenant_id,
        roles: decoded.roles
      };
    } catch (_) {
      return { active: false };
    }
  }
}

module.exports = new OIDCProviderService();
