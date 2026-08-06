import { getAuthorizedWorkspace, healWorkspaceConnections } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import { platformStore } from "@/lib/server/compose";
import { liveIntegrationAvailability } from "@/lib/server/liveIntegrations";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import {
  PACKAGE_ASK_OPTION_TO_CONNECTION,
  resolvePackageAskConnectionOptions,
} from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { connectionHealLikelyNeeded } from "../../../../../backend/core/integrations/credentials/reconcileConnectionsFromDurableCredentials.js";

/**
 * Owner Integrations surface — connections that can operate this business.
 * Prefer Business OS integration plan over industry-package catalogs.
 * Only lists integrations that can actually connect (no coming-soon rows).
 */
export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { businessId } = await params;
  const sp = searchParams ? await searchParams : {};
  const justConnected = Boolean(sp?.connected);
  return runTimedPage("integrations", async () => {
    // Do NOT clear the composition registry on every visit — that forces cold
    // snapshot/activate/hydrate and makes Integrations feel like a full reload.
    const [ctx, knowledgeDocumentCount, osInstallation] = await Promise.all([
      getAuthorizedWorkspace(businessId),
      platformStore.countActiveKnowledgeDocuments(businessId),
      getCachedBusinessOsInstallation(businessId),
    ]);
    const { service } = ctx;
    const platform = (service as any)?.connected?.integrationPlatform;
    const needsHeal = justConnected || connectionHealLikelyNeeded(platform, businessId);
    if (needsHeal) {
      await healWorkspaceConnections(businessId, service, { force: justConnected }).catch(() => null);
      markRequestTiming("CONNECTION_HEAL");
    } else {
      markRequestTiming("CONNECTION_HEAL_SKIPPED");
    }
    await redirectIfModuleDenied({
      businessId,
      role: ctx.role,
      moduleId: "integrations",
      installation: osInstallation,
    });
    markRequestTiming("KNOWLEDGE_DB");
    if (needsHeal) {
      service.refreshOperationalState(knowledgeDocumentCount);
    }

    let businessOsIntegrations = Array.isArray(osInstallation?.configuration?.integrations)
      ? [...osInstallation.configuration.integrations]
      : Array.isArray(osInstallation?.configuration?.integrationRequirements)
        ? [...osInstallation.configuration.integrationRequirements]
        : [];

    const purchased = Array.isArray(osInstallation?.configuration?.purchasedPackages)
      ? osInstallation.configuration.purchasedPackages.map(String)
      : [];
    const packageOptions = resolvePackageAskConnectionOptions(purchased);
    if (Array.isArray(packageOptions)) {
      const existing = new Set(
        businessOsIntegrations.map((entry: any) =>
          String(entry.integrationId ?? entry.id ?? "").toLowerCase(),
        ),
      );
      for (const option of packageOptions) {
        if (option === "none_yet") continue;
        const connectionId = (PACKAGE_ASK_OPTION_TO_CONNECTION as Record<string, string>)[option] ?? option;
        if (!connectionId || existing.has(String(connectionId).toLowerCase())) continue;
        existing.add(String(connectionId).toLowerCase());
        businessOsIntegrations.push({
          integrationId: connectionId,
          id: connectionId,
          label: String(connectionId).replace(/_/g, " "),
          status: "required",
        });
      }
    }

    // Plan 26 — always surface RFT min-set prove channels (forms + CRM) when missing.
    const rftMinSet = ["website_forms", "hubspot", "highlevel"];
    {
      const existing = new Set(
        businessOsIntegrations.map((entry: any) =>
          String(entry.integrationId ?? entry.id ?? "").toLowerCase(),
        ),
      );
      for (const connectionId of rftMinSet) {
        if (existing.has(connectionId)) continue;
        existing.add(connectionId);
        businessOsIntegrations.push({
          integrationId: connectionId,
          id: connectionId,
          label: connectionId.replace(/_/g, " "),
          status: "optional",
        });
      }
    }

    const viewModel = service.loadConnectionCenterViewModel({
      businessOsIntegrations: businessOsIntegrations.length ? businessOsIntegrations : null,
      liveFlags: liveIntegrationAvailability(),
      employees: Array.isArray(osInstallation?.configuration?.employees)
        ? osInstallation.configuration.employees
        : null,
      osConfiguration: osInstallation?.configuration ?? null,
    });
    markRequestTiming("VIEW_MODEL");

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <ConnectionsRenderer viewModel={viewModel} />
      </div>
    );
  });
}
