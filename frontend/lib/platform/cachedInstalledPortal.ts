import { cache } from "react";
import { platformStore } from "@/lib/server/compose";
import { composePortalModel } from "@/lib/portal-renderer/composePortalModel.js";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";

type PortalBundle = {
  installation: Awaited<ReturnType<typeof getCachedBusinessOsInstallation>>;
  specification: Record<string, unknown> | null;
  portalModel: ReturnType<typeof composePortalModel> | null;
  hasInstalledOs: boolean;
};

const PORTAL_TTL_MS = 60_000;
const portalProcessCache = new Map<string, { at: number; value: PortalBundle }>();

export function invalidateCachedInstalledPortal(businessId?: string) {
  if (!businessId) {
    portalProcessCache.clear();
    return;
  }
  const prefix = `${String(businessId)}:`;
  for (const key of portalProcessCache.keys()) {
    if (key.startsWith(prefix) || key === String(businessId)) {
      portalProcessCache.delete(key);
    }
  }
}

/**
 * Request-deduped installation + specification + portal compose.
 * Layout and Home both need this — without cache it runs twice per soft-nav.
 * Process TTL keeps soft-nav from re-loading the OS spec on every tab click.
 */
export const getCachedInstalledPortal = cache(
  async (businessId: string, role: string, permissions: string[]): Promise<PortalBundle> => {
    const key = `${businessId}:${role}`;
    const hit = portalProcessCache.get(key);
    if (hit && Date.now() - hit.at < PORTAL_TTL_MS) {
      return hit.value;
    }

    const installation = await getCachedBusinessOsInstallation(businessId);
    let specification: Record<string, unknown> | null = null;
    if (installation?.specificationId) {
      try {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification =
          specRow?.specification && typeof specRow.specification === "object"
            ? (specRow.specification as Record<string, unknown>)
            : null;
      } catch {
        specification = null;
      }
    }

    if (!installation?.configuration && !specification) {
      const empty: PortalBundle = {
        installation,
        specification: null,
        portalModel: null,
        hasInstalledOs: false,
      };
      portalProcessCache.set(key, { at: Date.now(), value: empty });
      return empty;
    }

    const portalModel = composePortalModel({
      businessId,
      role: String(role),
      permissions,
      configuration: installation?.configuration ?? null,
      specification,
    } as any);

    const bundle: PortalBundle = {
      installation,
      specification,
      portalModel,
      hasInstalledOs: Boolean(portalModel?.drivenByBusinessOS),
    };
    portalProcessCache.set(key, { at: Date.now(), value: bundle });
    return bundle;
  },
);
