'use strict';

/**
 * UDPS Root Entrypoint
 * Forwards execution to backend/server.js for cloud PaaS (Render, Heroku, AWS App Runner)
 * that execute `node server.js` by default.
 */

require('./backend/server.js');
