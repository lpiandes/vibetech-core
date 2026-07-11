/**
 * Backend compatibility entry — wired authorization singleton.
 * Next.js must not import this file (use frontend/lib/server/compose.ts).
 * Pure AuthorizationError / createAuthorizationService live in sibling modules.
 */
export {
  authorizeBusinessAccess,
  authorizePlatformAdmin,
  AuthorizationError,
  hasPermission,
  permissionsForRole,
  createAuthorizationService,
} from "./authorizeBusinessAccess.default.js";
