import { platformStore } from "@/lib/server/platformStore";
import { AdminPlatformService } from "../../../backend/core/admin/AdminPlatformService.js";
import { createDurableSupportAccessService } from "../../../backend/core/platform/support/SupportAccessService.js";

export function getAdminPlatformService() {
  return new AdminPlatformService({
    platformStore,
    supportAccessService: createDurableSupportAccessService(platformStore),
  } as any);
}

export function getAdminSupportService() {
  return createDurableSupportAccessService(platformStore);
}
