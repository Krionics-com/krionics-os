import { OperatorToken } from "./auth";

export type Role = 
  | "super_admin" 
  | "admin" 
  | "campaign_manager" 
  | "reply_reviewer" 
  | "analyst" 
  | "support_operator";

const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 100,
  admin: 80,
  campaign_manager: 60,
  reply_reviewer: 40,
  analyst: 20,
  support_operator: 10
};

export function requireRole(token: OperatorToken | null, requiredRole: Role): boolean {
  if (!token) return false;
  const userRole = token.role as Role;
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || Infinity;
  return userLevel >= requiredLevel;
}

export function hasPermission(token: OperatorToken | null, action: string, resource: string): boolean {
  if (!token) return false;
  if (token.role === "super_admin" || token.role === "admin") return true;

  // Granular checks
  if (token.role === "reply_reviewer" && resource === "replies" && ["read", "update"].includes(action)) return true;
  if (token.role === "campaign_manager" && ["campaigns", "replies", "clients"].includes(resource)) return true;
  if (token.role === "analyst" && action === "read") return true;

  return false;
}

export function canAccessClient(token: OperatorToken | null, clientId: string): boolean {
  if (!token) return false;
  if (token.role === "super_admin") return true;
  if (!token.client_access || token.client_access.length === 0) {
    // If not super_admin and no client_access is defined, default to no access (or all access depending on business logic)
    // The spec doesn't say, but usually if client_access is null for an admin, they have global access.
    // For safety, require client_access for non-admins.
    return token.role === "admin";
  }
  return token.client_access.includes(clientId);
}
