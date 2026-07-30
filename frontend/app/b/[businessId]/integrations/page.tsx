import Link from "next/link";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { liveIntegrationAvailability } from "@/lib/server/liveIntegrations";
import ConnectionsRenderer from "@/components/connections/ConnectionsRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import {
  PACKAGE_ASK_OPTION_TO_CONNECTION,
  resolvePackageAskConnectionOptions,
} from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

/**
 * Owner Integrations surface — connections that can operate this business.
 * Prefer Business OS integration plan over industry-package catalogs.
 * Only lists integrations that can actually connect (no coming-soon rows).
 */
export default async function IntegrationsPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("integrations", async () => {
    const [{ service }, knowledgeDocumentCount, osInstallation] = await Promise.all([
      getAuthorizedWorkspace(businessId),
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.getBusinessOSInstallation(businessId),
    ]);
    markRequestTiming("KNOWLEDGE_DB");
    service.refreshOperationalState(knowledgeDocumentCount);

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
        const connectionId = PACKAGE_ASK_OPTION_TO_CONNECTION[option] ?? option;
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

    const viewModel = service.loadConnectionCenterViewModel({
      businessOsIntegrations: businessOsIntegrations.length ? businessOsIntegrations : null,
      liveFlags: liveIntegrationAvailability(),
    });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(15,118,110,0.25)",
            background: "linear-gradient(90deg, #ecfdf5, #fff)",
            padding: "10px 14px",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Reconnected Gmail? Sync recent inbox messages (read-only, manual sync).</span>
          <Link
            href={`/b/${encodeURIComponent(businessId)}/integrations/gmail/inbox`}
            style={{ fontWeight: 800, color: "#0f766e", textDecoration: "none" }}
          >
            Open Gmail inbox →
          </Link>
        </div>
        <div
          style={{
            borderRadius: 12,
            border: "1px solid rgba(15,118,110,0.25)",
            background: "linear-gradient(90deg, #ecfdf5, #fff)",
            padding: "10px 14px",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>Running Meta, Google, or TikTok ads? See spend, clicks, and campaigns in-platform.</span>
          <Link
            href={`/b/${encodeURIComponent(businessId)}/ads`}
            style={{ fontWeight: 800, color: "#0f766e", textDecoration: "none" }}
          >
            Open Ad performance →
          </Link>
        </div>
        <ConnectionsRenderer viewModel={viewModel} />
      </div>
    );
  });
}
