import { NextResponse } from "next/server";
import {
  getAuthorizedWorkspace,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { AuthorizationError, platformStore } from "@/lib/server/compose";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { evaluateOwnerSetupSteps } from "../../../../../../backend/core/platform/commercial/resolveOwnerSetupPath.js";
import { readPurchasedPackagesFromConfig } from "../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

function proofLooksHonest(capabilityId: string, row: any, detail: Record<string, unknown>) {
  if (detail.deferredByOwner === true) return false;
  if (row?.ok !== true && row?.verified !== true) return false;
  // Connected-without-provider-id proofs do not count as tested.
  const providerId = detail.providerId ?? detail.messageId ?? detail.externalReference ?? null;
  if (["customer_email_send", "sms_send", "voice_calls", "calendar_scheduling"].includes(String(capabilityId))) {
    return Boolean(providerId) || detail.verified === true || row?.verified === true;
  }
  return true;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const scope = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "go_live");
    const packageId = String(body.packageId ?? "").trim();
    if (!packageId) {
      return NextResponse.json({ ok: false, error: "packageId required" }, { status: 400 });
    }

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const purchased = readPurchasedPackagesFromConfig(installation.configuration ?? {});
    if (!purchased.includes(packageId) && packageId !== "consulting") {
      return NextResponse.json({ ok: false, error: "package_not_purchased" }, { status: 403 });
    }

    if (action !== "go_live") {
      return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
    }

    const proofRows = await platformStore.listCapabilityProofRecords?.(businessId).catch(() => []) ?? [];
    const proofRecords: Record<string, { ok: boolean; verified: boolean }> = {};
    for (const row of proofRows) {
      const detail = row?.detail && typeof row.detail === "object" ? row.detail : {};
      const honest = proofLooksHonest(row.capabilityId, row, detail);
      proofRecords[String(row.capabilityId)] = {
        ok: Boolean(row.ok) && honest,
        verified: Boolean(row.verified),
      };
    }

    const connectionStatuses =
      (scope.service as any)?.connected?.connectionStatuses
      ?? {};
    // Prefer runtime connections when available.
    try {
      const runtime =
        (scope.service as any)?.connected?.integrationPlatform?.connectionRuntime?.getConnections?.() ?? [];
      for (const conn of runtime) {
        const id = String(conn?.connectionType ?? "");
        if (id) connectionStatuses[id] = String(conn?.status ?? "NOT_CONNECTED");
      }
    } catch {
      /* best effort */
    }

    const knowledgeCount = Number(
      (scope.service as any)?.connected?.platformKnowledgeCoverage?.activeDocumentCount
      ?? installation?.configuration?.knowledgeDocumentCount
      ?? 0,
    );

    const evaluated = evaluateOwnerSetupSteps({
      packageId,
      connectionStatuses,
      proofRecords,
      knowledgeCount,
      goLiveAt: null,
      pendingOpsRequests: {
        ...(installation?.configuration?.pendingOpsRequests ?? {}),
        ...(((scope as any)?.authz?.business?.packageConfiguration?.pendingOpsRequests) ?? {}),
      },
    });

    if (!evaluated.summary.canGoLive) {
      return NextResponse.json({
        ok: false,
        error: "Finish Connect and Test steps before go-live.",
        setup: evaluated,
      }, { status: 409 });
    }

    const at = new Date().toISOString();
    const actorId = String((scope as any)?.user?.id ?? "owner");
    const prevSetup = installation.configuration?.packageSetup && typeof installation.configuration.packageSetup === "object"
      ? installation.configuration.packageSetup
      : {};
    const byPackage = {
      ...(prevSetup.byPackageId && typeof prevSetup.byPackageId === "object" ? prevSetup.byPackageId : {}),
      [packageId]: {
        ...(prevSetup.byPackageId?.[packageId] ?? {}),
        goLiveAt: at,
        updatedAt: at,
      },
    };

    await platformStore.upsertBusinessOSInstallation({
      id: installation.id ?? installation.installationId ?? `install_${businessId}`,
      businessId,
      specificationRowId: installation.specificationRowId ?? null,
      specificationId: installation.specificationId ?? `spec_${businessId}`,
      specificationVersion: installation.specificationVersion ?? 1,
      specificationContentHash: installation.specificationContentHash ?? installation.contentHash ?? "package_setup",
      planId: installation.planId ?? `plan_${businessId}`,
      status: installation.status ?? "installed",
      plan: installation.plan ?? {},
      actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
      configuration: {
        ...(installation.configuration ?? {}),
        packageSetup: {
          ...prevSetup,
          goLiveAt: at,
          byPackageId: byPackage,
          updatedAt: at,
        },
      },
      history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
      installedAt: installation.installedAt ?? at,
      updatedAt: at,
      updatedBy: actorId,
      actorUserId: actorId,
    });

    invalidateCachedBusinessOsInstallation(businessId);
    return NextResponse.json({ ok: true, goLiveAt: at, packageId });
  } catch (error) {
    return jsonError(error);
  }
}
