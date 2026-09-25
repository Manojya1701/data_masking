'use strict';

/**
 * Native Node.js RS256 JWT Engine
 * Pure Node.js Web Crypto implementation of RFC 7519 (JWT) and RFC 7515 (JWS) with zero dependencies.
 */

const crypto = require('crypto');

function base64UrlEncode(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));
  return buf.toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Signs a JWT with RS256 using Node.js crypto
 */
function signRS256(payload, privateKey, options = {}) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: options.kid || 'segmento-rsa-key-2026-v1'
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto.sign('RSA-SHA256', Buffer.from(dataToSign, 'utf8'), privateKey);
  const signatureB64 = signature.toString('base64url');

  return `${dataToSign}.${signatureB64}`;
}

/**
 * Verifies an RS256 JWT token using Node.js crypto
 */
function verifyRS256(token, publicKey, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token format');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('JWT must have 3 parts separated by dots');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const dataToVerify = `${headerB64}.${payloadB64}`;

  const isValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(dataToVerify, 'utf8'),
    publicKey,
    Buffer.from(signatureB64, 'base64url')
  );

  if (!isValid) {
    throw new Error('Invalid token signature');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (err) {
    throw new Error('Malformed JWT payload');
  }

  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockTolerance || 30;

  if (payload.exp && payload.exp + clockTolerance < now) {
    const error = new Error('Access token has expired');
    error.code = 'ERR_JWT_EXPIRED';
    throw error;
  }

  if (payload.nbf && payload.nbf - clockTolerance > now) {
    throw new Error('Token is not active yet');
  }

  return {
    header: JSON.parse(base64UrlDecode(headerB64)),
    payload: payload
  };
}

/**
 * Decodes a JWT token without verifying its signature
 */
function decode(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (_) {
    return null;
  }
}

module.exports = {
  signRS256,
  verifyRS256,
  decode,
  base64UrlEncode,
  base64UrlDecode
};
