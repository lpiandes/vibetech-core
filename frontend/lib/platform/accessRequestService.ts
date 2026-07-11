import { createDurableAccessRequestService } from "../../../backend/core/access-requests/AccessRequestService.js";
import { platformStore } from "@/lib/server/platformStore";

/** Shared durable access-request service for the app runtime (survives restart). */
export const accessRequestService = createDurableAccessRequestService(platformStore);
