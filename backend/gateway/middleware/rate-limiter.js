'use strict';

/**
 * Sliding-Window Token Bucket Rate Limiting Middleware
 * Enforces per-client / per-IP rate limits with standard RFC RateLimit headers.
 */

const config = require('../config/gateway.config');

class RateLimiter {
  constructor() {
    this.hits = new Map(); // key -> array of timestamps
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    if (this.cleanupInterval && this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  cleanup() {
    const now = Date.now();
    const windowMs = config.rateLimiting.windowMs;
    for (const [key, timestamps] of this.hits.entries()) {
      const valid = timestamps.filter(t => now - t < windowMs);
      if (valid.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, valid);
      }
    }
  }

  reset() {
    this.hits.clear();
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.hits.clear();
  }

  middleware(options = {}) {
    return (req, res, next) => {
      if (!config.rateLimiting.enabled) return next();

      const now = Date.now();
      const windowMs = options.windowMs || config.rateLimiting.windowMs;
      
      const clientKey = (req.auth && req.auth.clientId) 
        ? `client:${req.auth.clientId}` 
        : `ip:${req.ip || req.connection.remoteAddress || '127.0.0.1'}`;

      const maxLimit = (req.auth && req.auth.clientId)
        ? (options.max || config.rateLimiting.authenticatedMax)
        : (options.max || config.rateLimiting.defaultMax);

      const timestamps = this.hits.get(clientKey) || [];
      const windowStart = now - windowMs;
      const recentHits = timestamps.filter(t => t > windowStart);

      const remaining = Math.max(0, maxLimit - (recentHits.length + 1));
      const oldestHit = recentHits[0] || now;
      const resetSeconds = Math.ceil((oldestHit + windowMs - now) / 1000);

      // Set RFC Standard Headers
      res.setHeader('RateLimit-Limit', maxLimit);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetSeconds > 0 ? resetSeconds : Math.ceil(windowMs / 1000));

      if (recentHits.length >= maxLimit) {
        res.setHeader('Retry-After', resetSeconds > 0 ? resetSeconds : 1);
        return res.status(429).json({
          success: false,
          error: 'rate_limit_exceeded',
          error_description: `Rate limit of ${maxLimit} requests per minute exceeded. Please retry in ${resetSeconds}s.`,
          retryAfter: resetSeconds
        });
      }

      recentHits.push(now);
      this.hits.set(clientKey, recentHits);
      next();
    };
  }
}

const rateLimiterInstance = new RateLimiter();
module.exports = rateLimiterInstance;
