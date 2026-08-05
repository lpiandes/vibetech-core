import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { liveIntegrationAvailability } from "@/lib/server/liveIntegrations";
import BusinessOnboardingHome from "@/components/operating/BusinessOnboardingHome";
import MissionControlRenderer from "@/components/mission-control/MissionControlRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { mergeBosEmployeesForTeam } from "@/lib/team/mergeBosEmployeesForTeam.js";
import { reconcilePackWorkforce } from "@/lib/team/reconcilePackWorkforce.js";
import { reconcileOperatingContracts } from "@/lib/team/reconcileOperatingContracts.js";
import { redirect } from "next/navigation";
import { readPendingPackageAsk } from "../../../../../backend/core/platform/packages/SalesPackageCatalog.js";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { resolveOnboardingHomeHref } from "@/lib/builder/resolveOnboardingHomeHref";
import PackageAskHomeBanner from "@/components/home/PackageAskHomeBanner";
import { getCachedInstalledPortal } from "@/lib/platform/cachedInstalledPortal";

/**
 * Home is one experience with two moments:
 * 1) Pre-install → Talk to VIBETech (Customer Promise: tell us → recommend → approve → live)
 * 2) Post-install → editorial operating Home (supervise a living business)
 */
export default async function BusinessHomePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("home", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);

    // Maintenance must never block first paint / login. Fire-and-forget on Home only.
    void Promise.all([
      ctx.service.reconcileHistoricalSubjectInterestsIfNeeded().catch(() => null),
      ctx.service.materializeDueRecurringCampaignOperationsIfNeeded().catch(() => null),
    ]);
    markRequestTiming("HOME_MAINTENANCE_QUEUED");

    let hasInstalledOs = false;
    let installedSpecification: Record<string, unknown> | null = null;
    let installation: any = null;
    try {
      const permissions = Array.from((ctx.permissions as Iterable<string> | undefined) ?? []).map(String);
      const portal = await getCachedInstalledPortal(
        businessId,
        String(ctx.role ?? "OWNER"),
        permissions,
      );
      installation = portal.installation;
      installedSpecification = portal.specification;
      hasInstalledOs = portal.hasInstalledOs;
    } catch {
      hasInstalledOs = false;
    }

    const [knowledgeDocumentCount, teamInviteChecklistComplete] = await Promise.all([
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.isTeamInviteChecklistComplete(businessId),
    ]);
    markRequestTiming("KNOWLEDGE_DB");

    const businessName = String(
      (ctx as any).authz?.business?.name
      ?? (installedSpecification as any)?.businessProfile?.businessName
      ?? "",
    );
    const industry = String(
      (ctx as any).authz?.business?.industry
      ?? (ctx as any).service?.businessProfile?.industry
      ?? (installedSpecification as any)?.businessProfile?.industry
      ?? "",
    );
    const existingEmployees = Array.isArray(installation?.configuration?.employees)
      ? installation.configuration.employees
      : [];
    // Cold-login speed: skip workforce/contract DB heal when employees already exist.
    const needsWorkforceHeal = hasInstalledOs && existingEmployees.length === 0;
    const reconciled = needsWorkforceHeal
      ? await reconcilePackWorkforce({
        platformStore,
        businessId,
        installation,
        specification: installedSpecification,
        industry,
        businessName,
        operatingPackId: String(
          (installedSpecification as any)?.operatingPackId
          ?? installation?.configuration?.operatingPackId
          ?? "",
        ),
      })
      : {
        employees: existingEmployees,
        healed: false,
        added: 0,
        industry: industry || null,
      };

    const contractReconcile = needsWorkforceHeal
      ? await reconcileOperatingContracts({
        platformStore,
        businessId,
        installation: {
          ...(installation ?? {}),
          configuration: {
            ...(installation?.configuration ?? {}),
            employees: Array.isArray(reconciled.employees) ? reconciled.employees : [],
          },
        },
        specification: installedSpecification,
        industry: reconciled.industry ?? industry,
        businessName,
      })
      : {
        employees: Array.isArray(reconciled.employees) ? reconciled.employees : existingEmployees,
        healed: false,
        updated: 0,
        industry: (reconciled.industry ?? industry) || null,
      };

    const bosEmployees = mergeBosEmployeesForTeam({
      configuration: {
        ...(installation?.configuration ?? {}),
        employees: Array.isArray(contractReconcile.employees) && contractReconcile.employees.length
          ? contractReconcile.employees
          : (Array.isArray(reconciled.employees) ? reconciled.employees : []),
      },
      specification: installedSpecification as any,
    });

    ctx.service.refreshOperationalState(knowledgeDocumentCount, {
      bosEmployeeDefinitions: bosEmployees.length ? bosEmployees : null,
    });
    markRequestTiming("REFRESH_OPERATIONAL_STATE");

    const home = ctx.service.loadBusinessHomeViewModel({
      activeKnowledgeDocumentCount: knowledgeDocumentCount,
      teamInviteChecklistComplete,
      installedSpecification,
    });
    markRequestTiming("VIEW_MODEL");

    // Pre-install: conversation with VIBETech only. No dashboard chrome.
    if (!hasInstalledOs) {
      // Never link to a bare, sessionless /architect when a durable builder session already
      // exists — that strands the owner's prior answers/plan/approval on refresh (e.g. after
      // Approve/Open hit a server error before canonical persistence finished). Resume the
      // most recently updated non-archived session instead of starting a new one.
      let talkHref = `/b/${encodeURIComponent(businessId)}/architect`;
      try {
        const builder = getAiBuilderService() as any;
        const existing = await builder.listSessions?.({ businessId });
        const resolved = resolveOnboardingHomeHref({
          businessId,
          sessions: existing?.sessions ?? [],
        });
        talkHref = resolved.href;
      } catch {
        /* best effort — fall back to starting a fresh discovery conversation */
      }
      return (
        <BusinessOnboardingHome
          businessId={businessId}
          businessName={home.businessName}
          talkHref={talkHref}
        />
      );
    }

    // Soft prompt only — never server-redirect to package Ask (that caused refresh loops).
    const pendingPackageAsk = readPendingPackageAsk(
      (ctx as any).authz?.business?.packageConfiguration ?? {},
    );

    // Product 2 — installed: editorial operating Home.
    const ownerFirstName = String((ctx.user as { name?: string | null } | undefined)?.name ?? "")
      .trim()
      .split(/\s+/)[0] || null;
    const missionControlViewModel = ctx.service.loadMissionControlViewModel({
      ownerFirstName,
      setupChecklist: Array.isArray(home.checklist) ? home.checklist : [],
    });

    const proofRows = await platformStore.listCapabilityProofRecords(businessId).catch(() => []);
    const proofRecords: Record<string, {
      ok: boolean;
      verified: boolean;
      at: string | null;
      detail?: Record<string, unknown>;
      deferredByOwner?: boolean;
    }> = {};
    for (const row of proofRows) {
      const detail = row?.detail && typeof row.detail === "object" ? row.detail : {};
      const honest = isHonestCapabilityProof(row.capabilityId, row, detail);
      proofRecords[row.capabilityId] = {
        ok: Boolean(row.ok) && honest,
        verified: Boolean(row.verified),
        at: row.updatedAt ?? row.createdAt ?? null,
        detail,
        deferredByOwner: detail.deferredByOwner === true,
      };
    }

    // Prefer live ConnectionRuntime (includes calendar/SMS after OAuth). Snapshot alone can omit them.
    const runtimeConnections =
      (ctx.service as any)?.connected?.integrationPlatform?.connectionRuntime?.getConnections?.() ?? [];
    const snapshotConnections =
      (ctx.service as any)?.connected?.connectedSystemsSnapshot?.connections ?? [];
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

    // Prefer runtime metadata over vault list + business re-fetch (cold login cost).
    const smsRuntime = runtimeConnections.find((c: any) => String(c?.connectionType ?? "") === "sms_channel");
    const smsRuntimeMeta = smsRuntime?.metadata && typeof smsRuntime.metadata === "object" ? smsRuntime.metadata : {};
    const smsSetup = {
      connected: String(connectionStatuses.sms_channel ?? "").toUpperCase() === "CONNECTED",
      fromNumber: String(smsRuntimeMeta.fromNumber ?? ""),
      a2pRegistrationStatus: String(smsRuntimeMeta.a2pRegistrationStatus ?? "pending"),
      brand: smsRuntimeMeta.brand ?? null,
    };

    const metaConnected = String(connectionStatuses.meta_lead_ads ?? "").toUpperCase() === "CONNECTED";
    const packageConfiguration = (ctx as any).authz?.business?.packageConfiguration ?? {};
    const pendingOps = packageConfiguration?.pendingOpsRequests?.meta_lead_ads;
    const metaSetupPending = !metaConnected && (
      String(pendingOps?.status ?? "") === "pending_ops"
      || Boolean(pendingOps?.requestedAt)
    );

    const enrichedViewModel = {
      ...missionControlViewModel,
      proofRecords,
      connectionStatuses,
      connections,
      smsSetup,
      metaSetupPending,
      knowledgeCount: knowledgeDocumentCount,
      liveFlags: liveIntegrationAvailability(),
      bosEmployees,
    };
    markRequestTiming("MISSION_CONTROL", {
      bytes: JSON.stringify(enrichedViewModel).length,
    });

    return (
      <>
        {pendingPackageAsk ? (
          <PackageAskHomeBanner
            businessId={businessId}
            packageIds={pendingPackageAsk.packages ?? []}
          />
        ) : null}
        <MissionControlRenderer
          viewModel={enrichedViewModel as never}
          variant="mission_control"
        />
      </>
    );
  });
}


/** Outbound proves only count when a real provider reference exists (not simulated). */
function isHonestCapabilityProof(
  capabilityId: string,
  row: { ok?: boolean; proveAction?: string | null },
  detail: Record<string, unknown>,
) {
  const id = String(capabilityId ?? "");
  const action = String(row?.proveAction ?? detail?.proveAction ?? "");
  const isSms = id === "sms_send" || action === "send_test_sms";
  const isEmail = id === "customer_email_send" || action === "send_test_email";
  const isCalendar = id === "calendar_scheduling" || action === "create_test_event";
  if (!isSms && !isEmail && !isCalendar) return true;
  if (detail?.simulated === true) return false;
  if (detail?.awaitingOwnerConfirm === true) return false;

  const execution = detail?.execution && typeof detail.execution === "object"
    ? (detail.execution as Record<string, unknown>)
    : {};
  const nested = detail?.detail && typeof detail.detail === "object"
    ? (detail.detail as Record<string, unknown>)
    : {};
  const ref = detail?.externalReference
    ?? execution?.externalReference
    ?? nested?.externalReference
    ?? detail?.messageId
    ?? execution?.messageId
    ?? nested?.messageId;
  if (!ref) return false;
  if (isSms) {
    const delivery = String(
      detail?.deliveryStatus
      ?? execution?.deliveryStatus
      ?? (detail?.delivery as { status?: string } | undefined)?.status
      ?? (execution?.delivery as { status?: string } | undefined)?.status
      ?? nested?.deliveryStatus
      ?? "",
    ).toLowerCase();
    // Queued/accepted alone used to mark Done — require sent/delivered confirmation.
    if (delivery !== "delivered" && delivery !== "sent") return false;
  }
  return true;
}
