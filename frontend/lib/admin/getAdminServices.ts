import { platformStore, supportAccessService } from "@/lib/server/compose";
import { AdminPlatformService } from "../../../backend/core/admin/AdminPlatformService.js";

export function getAdminPlatformService() {
  return new AdminPlatformService({
    platformStore,
    supportAccessService,
  } as any);
}

export function getAdminSupportService() {
  return supportAccessService;
}
