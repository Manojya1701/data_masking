'use strict';

/**
 * Segmento Cryptographic Key Manager (Pure Node.js Native RS256)
 * Manages RS256 RSA-2048 keypairs, JWKS formatting, and public key distribution using native Node.js crypto.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/gateway.config');

class KeyManager {
  constructor() {
    this.keyId = config.crypto.keyId;
    this.algorithm = config.crypto.algorithm;
    this.privateKeyPem = null;
    this.publicKeyPem = null;
    this.publicKeyObject = null;
    this.privateKeyObject = null;
    this.jwk = null;
    this.jwks = null;
    this.initialized = false;
  }

  /**
   * Initializes the RSA-2048 keypair (loads existing or generates new)
   */
  init() {
    if (this.initialized) return;

    const keysDir = config.crypto.keysDirectory;
    if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
    }

    const privateKeyPath = path.join(keysDir, 'oidc-private.key');
    const publicKeyPath = path.join(keysDir, 'oidc-public.key');

    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      try {
        this.privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
        this.publicKeyPem = fs.readFileSync(publicKeyPath, 'utf8');
        this.privateKeyObject = crypto.createPrivateKey(this.privateKeyPem);
        this.publicKeyObject = crypto.createPublicKey(this.publicKeyPem);
      } catch (err) {
        this._generateAndSaveKeys(privateKeyPath, publicKeyPath);
      }
    } else {
      this._generateAndSaveKeys(privateKeyPath, publicKeyPath);
    }

    // Export JWK using native Node crypto
    const rawJwk = this.publicKeyObject.export({ format: 'jwk' });
    this.jwk = {
      kty: rawJwk.kty,
      use: 'sig',
      alg: this.algorithm,
      kid: this.keyId,
      n: rawJwk.n,
      e: rawJwk.e
    };

    this.jwks = {
      keys: [this.jwk]
    };

    this.initialized = true;
  }

  _generateAndSaveKeys(privateKeyPath, publicKeyPath) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    this.privateKeyPem = privateKey;
    this.publicKeyPem = publicKey;
    this.privateKeyObject = crypto.createPrivateKey(privateKey);
    this.publicKeyObject = crypto.createPublicKey(publicKey);

    try {
      fs.writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
      fs.writeFileSync(publicKeyPath, publicKey, { mode: 0o644 });
    } catch (_) {
      // In-memory fallback if file system is read-only
    }
  }

  /**
   * Returns the RS256 Private Key object
   */
  getPrivateKey() {
    if (!this.initialized) this.init();
    return this.privateKeyObject;
  }

  /**
   * Returns the RS256 Public Key object
   */
  getPublicKey() {
    if (!this.initialized) this.init();
    return this.publicKeyObject;
  }

  /**
   * Returns the JWKS response structure for /.well-known/jwks.json
   */
  getJWKS() {
    if (!this.initialized) this.init();
    return this.jwks;
  }

  /**
   * Returns standard OIDC Discovery metadata for /.well-known/openid-configuration
   */
  getOpenIDConfiguration(baseUrl) {
    const issuer = baseUrl || config.gateway.issuer;
    return {
      issuer: issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      userinfo_endpoint: `${issuer}/oauth/userinfo`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      revocation_endpoint: `${issuer}/oauth/revoke`,
      introspection_endpoint: `${issuer}/oauth/introspect`,
      response_types_supported: ['code', 'token', 'id_token', 'code id_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: [
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
      token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic', 'none'],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'name',
        'email',
        'roles',
        'tenant_id',
        'scope'
      ],
      code_challenge_methods_supported: ['S256', 'plain']
    };
  }
}

module.exports = new KeyManager();
