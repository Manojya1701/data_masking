'use strict';

/**
 * RBAC & OAuth 2.0 Scope Guard Middleware
 * Enforces fine-grained permission and role authorization for protected endpoints.
 */

function requireScope(...requiredScopes) {
  return (req, res, next) => {
    // If not authenticated, let oidcVerifier handle it (or reject)
    if (!req.auth || !req.auth.scopes) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        error_description: 'Authentication is required before evaluating scopes'
      });
    }

    const clientScopes = req.auth.scopes;
    const missingScopes = requiredScopes.filter(s => !clientScopes.includes(s));

    if (missingScopes.length > 0) {
      res.setHeader('WWW-Authenticate', `Bearer error="insufficient_scope", scope="${requiredScopes.join(' ')}", error_description="The request requires higher privileges."`);
      return res.status(403).json({
        success: false,
        error: 'insufficient_scope',
        error_description: `Access denied. Missing required scope(s): ${missingScopes.join(', ')}`,
        requiredScopes: requiredScopes,
        grantedScopes: clientScopes
      });
    }

    next();
  };
}

function requireAnyScope(...scopes) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.scopes) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        error_description: 'Authentication is required before evaluating scopes'
      });
    }

    const clientScopes = req.auth.scopes;
    const hasAny = scopes.some(s => clientScopes.includes(s));

    if (!hasAny) {
      res.setHeader('WWW-Authenticate', `Bearer error="insufficient_scope", scope="${scopes.join(' ')}"`);
      return res.status(403).json({
        success: false,
        error: 'insufficient_scope',
        error_description: `Access denied. Requires at least one of the following scopes: ${scopes.join(', ')}`,
        requiredScopes: scopes,
        grantedScopes: clientScopes
      });
    }

    next();
  };
}

function requireRole(...requiredRoles) {
  return (req, res, next) => {
    if (!req.auth || !req.auth.roles) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        error_description: 'Authentication is required before evaluating roles'
      });
    }

    const userRoles = req.auth.roles;
    const hasRole = requiredRoles.some(r => userRoles.includes(r));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'forbidden_role',
        error_description: `Access denied. User or client must possess one of the roles: ${requiredRoles.join(', ')}`,
        requiredRoles: requiredRoles,
        assignedRoles: userRoles
      });
    }

    next();
  };
}

module.exports = {
  requireScope,
  requireAnyScope,
  requireRole
};
