import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";
import { persistAffectedRuntimes } from "../../../../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";
import { acceptProspectingCandidates } from "../../../../../../../../../backend/core/prospecting/acceptProspectingCandidates.js";
import { assertAiProspectingPurchased } from "../../../../../../../../../backend/core/prospecting/prospectingGate.js";

function graphFromCtx(ctx: any) {
  return ctx?.service?.connected?.ctx?.businessGraphRuntime
    ?? ctx?.service?.businessGraphRuntime
    ?? null;
}

function persistGraphFromCtx(ctx: any, businessId: string) {
  const stack = ctx?.service?.connected?.operatingStack
    ?? ctx?.service?.connected?.ctx
    ?? null;
  if (!stack?.businessGraphRuntime) return null;
  return async () => {
    await persistAffectedRuntimes({
      workspaceId: businessId,
      stack,
      integrationPlatform: ctx?.service?.connected?.integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH],
    });
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; runId: string }> },
) {
  try {
    const { businessId, runId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    try {
      assertAiProspectingPurchased(installation);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code ?? "PACKAGE_REQUIRED" },
        { status: error.status ?? 403 },
      );
    }

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const result = await acceptProspectingCandidates({
      platformStore,
      installation,
      runId,
      candidateIds: body.candidateIds ?? body.ids ?? null,
      pipelineId: body.pipelineId ?? null,
      stageId: body.stageId ?? null,
      addToPipeline: body.addToPipeline !== false,
      actorId,
      businessGraphRuntime: graphFromCtx(ctx),
      persistGraph: persistGraphFromCtx(ctx, businessId) ?? undefined,
      emitContactCreated: async ({ contact }) => {
        await (ctx.service as any).emitSpecialtyBusinessEvent?.({
          eventType: "CONTACT_CREATED",
          forceManual: false,
          brief: `AI prospect accepted: ${contact?.name ?? "lead"}`,
          actorId,
          eventPayload: {
            contactId: contact?.id,
            contact,
            source: "ai_prospecting",
            runId,
          },
        });
      },
    });

    return NextResponse.json({
      ok: true,
      accepted: result.accepted,
      skipped: result.skipped,
      run: result.run,
    });
  } catch (error: any) {
    if (String(error?.message ?? "").includes("not found")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 404 });
    }
    return authorizationErrorResponse(error);
  }
}
