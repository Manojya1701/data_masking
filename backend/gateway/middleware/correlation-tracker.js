'use strict';

/**
 * Distributed Correlation & Request Tracking Middleware
 * Injects and propagates X-Correlation-ID across all inbound requests and outbound responses.
 */

const crypto = require('crypto');

function correlationTracker(req, res, next) {
  const incomingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId = incomingId || 'req_' + (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex'));

  req.correlationId = correlationId;

  if (!res.headersSent) {
    try {
      res.setHeader('X-Correlation-ID', correlationId);
      res.setHeader('X-Segmento-Gateway', 'v1.0.0-enterprise');
    } catch (_) {
      // Ignore if headers already sent
    }
  }

  // Safely hook writeHead before response headers are sent to the client
  const startHrTime = process.hrtime();
  const originalWriteHead = res.writeHead;

  res.writeHead = function(...args) {
    if (!res.headersSent) {
      const elapsedHrTime = process.hrtime(startHrTime);
      const elapsedTimeInMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
      try {
        res.setHeader('X-Response-Time', `${elapsedTimeInMs}ms`);
      } catch (_) {
        // Safe fail-silent if headers already committed
      }
    }
    return originalWriteHead.apply(this, args);
  };

  next();
}

module.exports = correlationTracker;
