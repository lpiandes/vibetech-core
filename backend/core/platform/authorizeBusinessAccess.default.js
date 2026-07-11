/**
 * Backend-owned authorization singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "./persistence/platformStore.js";
import { createDurableSupportAccessService } from "./support/SupportAccessService.js";
import { createAuthorizationService, AuthorizationError, hasPermission, permissionsForRole } from "./createAuthorizationService.js";

const authorizationService = createAuthorizationService({
  store: platformStore,
  createSupportAccessService: () => createDurableSupportAccessService(platformStore),
});

export const authorizeBusinessAccess = authorizationService.authorizeBusinessAccess;
export const authorizePlatformAdmin = authorizationService.authorizePlatformAdmin;
export { AuthorizationError, hasPermission, permissionsForRole, createAuthorizationService };
