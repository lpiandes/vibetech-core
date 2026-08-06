import { cache } from "react";
import { platformStore } from "@/lib/server/compose";

const INSTALL_TTL_MS = 60_000;
const installProcessCache = new Map<string, { at: number; value: unknown }>();

/** Request-deduped + short process TTL so soft-nav does not re-hit Postgres every click. */
export const getCachedBusinessOsInstallation = cache(async (businessId: string) => {
  const id = String(businessId);
  const hit = installProcessCache.get(id);
  if (hit && Date.now() - hit.at < INSTALL_TTL_MS) {
    return hit.value as Awaited<ReturnType<typeof platformStore.getBusinessOSInstallation>>;
  }
  const value = await platformStore.getBusinessOSInstallation(businessId);
  installProcessCache.set(id, { at: Date.now(), value });
  return value;
});

export function invalidateCachedBusinessOsInstallation(businessId?: string) {
  if (!businessId) {
    installProcessCache.clear();
  } else {
    installProcessCache.delete(String(businessId));
  }
  // Portal bundle embeds installation — must die with the same write or Home
  // keeps showing "Finish setup" for up to 60s after go-live.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { invalidateCachedInstalledPortal } = require("./cachedInstalledPortal") as {
      invalidateCachedInstalledPortal: (id?: string) => void;
    };
    invalidateCachedInstalledPortal(businessId);
  } catch {
    /* portal module may be unavailable in some test paths */
  }
}
