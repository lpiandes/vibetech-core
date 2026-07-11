import { AccessRequestService } from "../../../backend/core/access-requests/AccessRequestService.js";

/** Shared in-process access-request service for the app runtime. */
export const accessRequestService = new AccessRequestService();
