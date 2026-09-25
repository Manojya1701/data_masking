'use strict';

/**
 * Distributed Correlation & Request Tracking Middleware
 * Injects and propagates X-Correlation-ID across all inbound requests and outbound responses.
 */

const crypto = require('crypto');

function correlationTracker(req, res, next) {
  const incomingId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId = incomingId || 'req_' + crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  res.setHeader('X-Segmento-Gateway', 'v1.0.0-enterprise');

  // Track request timing
  const startHrTime = process.hrtime();

  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
    res.setHeader('X-Response-Time', `${elapsedTimeInMs}ms`);
  });

  next();
}

module.exports = correlationTracker;
