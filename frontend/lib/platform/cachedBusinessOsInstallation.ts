import { cache } from "react";
import { platformStore } from "@/lib/server/compose";

/** Request-deduped installation fetch for layout + pages. */
export const getCachedBusinessOsInstallation = cache(async (businessId: string) => {
  return platformStore.getBusinessOSInstallation(businessId);
});
