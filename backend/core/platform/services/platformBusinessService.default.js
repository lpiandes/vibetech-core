/**
 * Backend-owned platform business service singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "../persistence/platformStore.js";
import { createAndDeliverInvitation } from "./invitationService.default.js";
import {
  createPlatformBusinessService,
  provisionEmptyBusinessWorkspace,
} from "./PlatformBusinessService.js";

const platformBusinessService = createPlatformBusinessService({
  store: platformStore,
  createAndDeliverInvitation,
});

export const createBusinessWithOwnerInvite = platformBusinessService.createBusinessWithOwnerInvite;
export { provisionEmptyBusinessWorkspace, createPlatformBusinessService };
