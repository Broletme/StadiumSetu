import { SetMetadata } from '@nestjs/common';

export type OpsRole = 'admin' | 'zone_lead' | 'medical' | 'security';

export const ROLES_KEY = 'roles';

/**
 * Decorator to restrict a route to specific ops roles.
 * Usage: @Roles('admin', 'zone_lead')
 */
export const Roles = (...roles: OpsRole[]) => SetMetadata(ROLES_KEY, roles);
