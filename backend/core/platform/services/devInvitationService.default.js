/**
 * Backend-owned dev invitation service singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "../persistence/platformStore.js";
import { createAndDeliverInvitation } from "./invitationService.default.js";
import { createDevInvitationService } from "./DevInvitationService.js";

const devInvitationService = createDevInvitationService({
  store: platformStore,
  createAndDeliverInvitation,
});

export const listDevelopmentInvitations = devInvitationService.listDevelopmentInvitations;
export const generateDevelopmentInvitationLink = devInvitationService.generateDevelopmentInvitationLink;
export { createAndDeliverInvitation, createDevInvitationService };
