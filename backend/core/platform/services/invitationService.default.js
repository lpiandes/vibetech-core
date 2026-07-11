/**
 * Backend-owned invitation service singleton for scripts and Node tests.
 * Next.js must use frontend/lib/server/compose.ts instead.
 */
import { platformStore } from "../persistence/platformStore.js";
import { createInvitationDeliveryProvider } from "../delivery/createInvitationDeliveryProvider.js";
import { recordDevInvitation } from "./DevInvitationMailbox.js";
import {
  createInvitationService,
  buildInvitationUrl,
  validateInvitationForDisplay,
} from "./InvitationService.js";

const invitationService = createInvitationService({
  store: platformStore,
  deliveryProvider: {
    send(input) {
      return createInvitationDeliveryProvider().send(input);
    },
  },
  recordDevInvitation,
});

export const createAndDeliverInvitation = invitationService.createAndDeliverInvitation;
export const resendPendingInvitation = invitationService.resendPendingInvitation;
export { buildInvitationUrl, validateInvitationForDisplay, createInvitationService };
