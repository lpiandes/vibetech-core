/**
 * @deprecated Use createBusinessWithOwnerInvite via platform admin API.
 */
export function createEmptyBusiness() {
  throw new Error(
    "createEmptyBusiness() without platform admin is removed. Use /platform to create businesses.",
  );
}

export { createBusinessWithOwnerInvite, provisionEmptyBusinessWorkspace } from "./services/PlatformBusinessService.js";
