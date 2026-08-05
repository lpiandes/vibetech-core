/**
 * Assemble adaptive tour steps for a business (missions + packages + nav).
 */
import { platformStore } from "@/lib/server/compose";
import { buildCuratedLaunchMissions } from "../../../backend/core/platform/launch/buildCuratedLaunchMissions.js";
import {
  buildAdaptiveProductTour,
  ADAPTIVE_TOUR_VERSION,
} from "../../../backend/core/onboarding/buildAdaptiveProductTour.js";
import {
  readPurchasedPackagesFromConfig,
  resolveCanonicalNavIdsForPackages,
} from "../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getCanonicalBusinessNav } from "@/components/workspace/canonicalBusinessNavigation";

export { ADAPTIVE_TOUR_VERSION };

export async function assembleAdaptiveTourForBusiness({
  businessId,
  service,
  authzBusiness = null,
  permissions = [],
  role = null,
  includeCompletedMissions = false,
  installedBusinessOS = null,
}: {
  businessId: string;
  service: any;
  authzBusiness?: any;
  permissions?: string[] | Set<string>;
  role?: string | null;
  includeCompletedMissions?: boolean;
  installedBusinessOS?: any;
}) {
  const business = authzBusiness
    ?? await platformStore.getBusinessById(businessId).catch(() => null);
  const cfg = business?.packageConfiguration && typeof business.packageConfiguration === "object"
    ? business.packageConfiguration
    : {};
  const purchasedPackages = readPurchasedPackagesFromConfig(cfg);

  const proofRows = await platformStore.listCapabilityProofRecords(businessId).catch(() => []);
  const proofRecords: Record<string, any> = {};
  for (const row of proofRows) {
    const detail = row?.detail && typeof row.detail === "object" ? row.detail : {};
    proofRecords[row.capabilityId] = {
      ok: Boolean(row.ok) && detail?.simulated !== true,
      verified: Boolean(row.verified),
      at: row.updatedAt ?? row.createdAt ?? null,
      detail,
      deferredByOwner: detail.deferredByOwner === true,
    };
  }

  const runtimeConnections =
    service?.connected?.integrationPlatform?.connectionRuntime?.getConnections?.() ?? [];
  const snapshotConnections =
    service?.connected?.connectedSystemsSnapshot?.connections ?? [];
  const connectionStatuses: Record<string, string> = {};
  for (const conn of snapshotConnections) {
    if (conn?.id) connectionStatuses[String(conn.id)] = String(conn.status ?? "NOT_CONNECTED");
  }
  for (const conn of runtimeConnections) {
    const id = String(conn?.connectionType ?? "");
    if (!id) continue;
    connectionStatuses[id] = String(conn?.status ?? "NOT_CONNECTED");
  }
  const connections = (snapshotConnections.length
    ? snapshotConnections
    : runtimeConnections.map((conn: any) => ({
      id: String(conn.connectionType),
      status: String(conn.status ?? "NOT_CONNECTED"),
      displayName: String(conn.connectionType ?? ""),
    }))
  ).map((conn: any) => {
    const id = String(conn?.id ?? conn?.connectionType ?? "");
    const live = id ? connectionStatuses[id] : null;
    return live ? { ...conn, status: live } : conn;
  });

  let knowledgeCount = 0;
  try {
    knowledgeCount = Number(await platformStore.countActiveKnowledgeDocuments(businessId)) || 0;
  } catch {
    knowledgeCount = 0;
  }

  const integrationCreds = await platformStore.listIntegrationCredentialsForWorkspace(businessId).catch(() => []);
  const smsCred = (Array.isArray(integrationCreds) ? integrationCreds : []).find((row: any) => {
    const provider = String(row?.providerType ?? "");
    const id = String(row?.credentialId ?? "");
    return provider === "twilio_sms" || id.includes("twilio_sms");
  });
  const smsMeta = smsCred?.metadata && typeof smsCred.metadata === "object" ? smsCred.metadata : {};
  const smsRuntime = runtimeConnections.find((c: any) => String(c?.connectionType ?? "") === "sms_channel");
  const smsRuntimeMeta = smsRuntime?.metadata && typeof smsRuntime.metadata === "object" ? smsRuntime.metadata : {};
  const smsSetup = {
    connected: String(connectionStatuses.sms_channel ?? "").toUpperCase() === "CONNECTED",
    fromNumber: String(smsMeta.fromNumber ?? smsRuntimeMeta.fromNumber ?? smsCred?.secrets?.fromNumber ?? ""),
    a2pRegistrationStatus: String(
      smsMeta.a2pRegistrationStatus ?? smsRuntimeMeta.a2pRegistrationStatus ?? "pending",
    ),
    brand: smsMeta.brand ?? smsRuntimeMeta.brand ?? null,
  };

  const metaConnected = String(connectionStatuses.meta_lead_ads ?? "").toUpperCase() === "CONNECTED";
  const metaCred = (Array.isArray(integrationCreds) ? integrationCreds : []).find((row: any) => {
    const provider = String(row?.providerType ?? "");
    const id = String(row?.credentialId ?? "");
    return provider === "meta_lead_ads" || id.includes("meta");
  });
  const metaCredMeta = metaCred?.metadata && typeof metaCred.metadata === "object" ? metaCred.metadata : {};
  const pendingOps = (cfg as any)?.pendingOpsRequests?.meta_lead_ads;
  const metaSetupPending = !metaConnected && (
    String(metaCredMeta.status ?? "") === "pending_ops"
    || Boolean(metaCredMeta.setupRequestedAt)
    || String(pendingOps?.status ?? "") === "pending_ops"
    || Boolean(pendingOps?.requestedAt)
  );

  const vertical = String(
    installedBusinessOS?.industry
    ?? installedBusinessOS?.operatingPackId
    ?? business?.industry
    ?? "*",
  );

  const missions = buildCuratedLaunchMissions({
    vertical,
    businessId,
    baseHref: `/b/${businessId}`,
    connectionStatuses,
    proofRecords,
    connections,
    knowledgeCount,
    businessName: String(business?.name ?? ""),
    smsSetup,
    purchasedPackages,
    metaSetupPending,
  });

  const specialtyModules = Array.isArray(installedBusinessOS?.modules)
    ? installedBusinessOS.modules
    : [];
  const installedModuleIds = specialtyModules
    .map((m: any) => m?.moduleId)
    .filter((id: unknown): id is string => typeof id === "string");
  const roleDefinitions = Array.isArray(installedBusinessOS?.roles)
    ? installedBusinessOS.roles
    : [];

  let availableNavIds: string[] = [];
  try {
    const nav = getCanonicalBusinessNav(businessId, permissions, {
      role: role ?? undefined,
      installedModuleIds,
      specialtyModules: specialtyModules as any,
      purchasedPackages,
      roleDefinitions,
    });
    availableNavIds = nav.map((n) => n.id);
  } catch {
    const fromPackages = resolveCanonicalNavIdsForPackages(purchasedPackages);
    availableNavIds = fromPackages ? Array.from(fromPackages) : ["home", "settings"];
  }

  return buildAdaptiveProductTour({
    purchasedPackages,
    missions,
    availableNavIds,
    businessId,
    businessName: String(business?.name ?? ""),
    includeCompletedMissions,
  });
}
