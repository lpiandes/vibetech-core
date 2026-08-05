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
    return;
  }
  installProcessCache.delete(String(businessId));
}
