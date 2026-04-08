// =============================================================================
// Angsana Exchange — Shared User Context Utilities
// Slice 7A Step 4: Extracted from route handlers for reuse
//
// Extracts user claims from request headers (set by Next.js middleware)
// and provides common permission checks.
//
// Used by all /api/clients/{clientId}/* document routes.
// =============================================================================

import { NextRequest } from 'next/server';

/**
 * User context extracted from request headers.
 * Headers are set by the Next.js middleware after JWT validation.
 */
export interface RequestUserContext {
  uid: string;
  role: string;
  tenantId: string;
  email: string;
  clientId: string | null;
  assignedClients: string[];
}

/**
 * Extract user claims from request headers (set by middleware).
 * Same pattern used across all /api/clients/{clientId}/* routes.
 */
export function getUserFromHeaders(request: NextRequest): RequestUserContext {
  return {
    uid: request.headers.get('x-user-uid') || '',
    role: request.headers.get('x-user-role') || '',
    tenantId: request.headers.get('x-user-tenant') || 'angsana',
    email: request.headers.get('x-user-email') || '',
    clientId: request.headers.get('x-user-client') || null,
    assignedClients: JSON.parse(request.headers.get('x-assigned-clients') || '[]') as string[],
  };
}

/**
 * Check whether a user has access to a specific client.
 * - Client users: clientId claim must match
 * - Internal admin with ["*"]: access to all clients
 * - Internal user: must have clientId in assignedClients array
 */
export function hasClientAccess(user: RequestUserContext, clientId: string): boolean {
  if (user.clientId) return user.clientId === clientId;
  if (user.assignedClients?.includes('*')) return true;
  return user.assignedClients?.includes(clientId) ?? false;
}

/**
 * Check whether a user has an internal role (internal-admin or internal-user).
 */
export function isInternal(role: string): boolean {
  return role === 'internal-admin' || role === 'internal-user';
}

/**
 * Check whether a user is a client-approver.
 */
export function isClientApprover(role: string): boolean {
  return role === 'client-approver';
}
