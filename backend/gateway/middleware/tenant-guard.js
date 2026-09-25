'use strict';

/**
 * Multi-Tenant Boundary & Isolation Guard Middleware
 * Ensures cross-tenant queries cannot access, discover, or delete records from another tenant.
 */

const config = require('../config/gateway.config');

function tenantGuard(options = {}) {
  return (req, res, next) => {
    if (!config.tenancy.enforceIsolation) return next();
    if (!req.auth) return next();

    const tokenTenantId = req.auth.tenantId;
    const headerTenantId = req.headers[config.tenancy.headerKey];

    // If client explicitly passed a tenant header, ensure they have rights to it
    if (headerTenantId && tokenTenantId && headerTenantId !== tokenTenantId) {
      // Super admins or global tenants can cross boundaries
      const isSuperAdmin = req.auth.roles && (req.auth.roles.includes('SUPER_ADMIN') || req.auth.roles.includes('DPO_LEAD'));
      if (!isSuperAdmin) {
        return res.status(403).json({
          success: false,
          error: 'tenant_access_denied',
          error_description: `Token tenant [${tokenTenantId}] is not authorized to act on requested tenant [${headerTenantId}]`
        });
      }
    }

    next();
  };
}

module.exports = tenantGuard;
