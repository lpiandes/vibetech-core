import { NextResponse } from "next/server";
import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { ContinuousBusinessBuilderService } from "../../../../../../../../../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import { IntelligenceToArchitectChangeService } from "../../../../../../../../../backend/core/business-intelligence/conversion/IntelligenceToArchitectChangeService.js";
import { persistAffectedRuntimes } from "../../../../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";
import { PERMISSIONS } from "../../../../../../../../../backend/core/platform/permissions/rolePermissions.js";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; candidateId: string }> },
) {
  try {
    const { businessId, candidateId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.BUSINESS_MANAGE);

    const installation = await platformStore.getBusinessOSInstallation(businessId);
    if (!installation || installation.status !== "installed") {
      return NextResponse.json({
        ok: false,
        reason: "installed_specification_required",
        error: "Install a Business OS before proposing Architect changes.",
        installed: false,
      }, { status: 400 });
    }
    const specRow = await (platformStore as any).getBusinessOSSpecification({
      businessId,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion,
    });
    const installedSpecification = specRow?.specification ?? null;
    if (!installedSpecification) {
      return NextResponse.json({
        ok: false,
        reason: "installed_specification_required",
        installed: false,
      }, { status: 400 });
    }

    const stack = ctx.service.connected.operatingStack ?? ctx.service.connected.ctx;
    const result = await new IntelligenceToArchitectChangeService({
      continuousBuilder: new ContinuousBusinessBuilderService({
        aiBuilder: getAiBuilderService(),
      }),
    }).execute({
      stack,
      candidateId,
      businessId,
      actorUserId: ctx.user?.id ?? null,
      installedSpecification,
      nowISO: new Date().toISOString(),
      platformStore,
    } as any);

    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.message ?? result.reason,
        installed: false,
      }, { status: 400 });
    }

    if (result.snapshotKinds?.length) {
      await persistAffectedRuntimes({
        workspaceId: businessId,
        stack,
        integrationPlatform: ctx.service.connected.integrationPlatform,
        kinds: result.snapshotKinds,
      });
    }

    return NextResponse.json({
      ok: true,
      proposed: true,
      installed: false,
      openHref: result.openHref,
      session: result.session
        ? { sessionId: result.session.sessionId }
        : null,
      candidate: result.candidate,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
