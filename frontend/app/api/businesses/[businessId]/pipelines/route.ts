import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readCrmState,
  writeCrmState,
  movePipelineCard,
  upsertPipelineCard,
  createPipeline,
  renamePipeline,
  deletePipeline,
  renamePipelineStage,
  addPipelineStage,
  removePipelineStage,
  removePipelineCard,
  reorderPipelineStages,
  defaultIntakePipeline,
  setOwnerColor,
  OWNER_COLOR_PALETTE,
} from "../../../../../../backend/core/crm/CrmStore.js";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const crm = readCrmState(installation);
    const memberships = await platformStore.listMembershipsForBusiness(businessId).catch(() => []);
    const members = (memberships ?? [])
      .filter((m: { status?: string }) => !m.status || String(m.status).toUpperCase() === "ACTIVE")
      .map((m: { userId: string; userName?: string; email?: string; role?: string }) => ({
        userId: String(m.userId),
        name: String(m.userName || m.email || "Teammate").trim() || "Teammate",
        email: String(m.email ?? ""),
        role: String(m.role ?? ""),
      }));
    return NextResponse.json({
      ok: true,
      pipelines: crm.pipelines,
      contacts: crm.contacts,
      ownerColors: crm.ownerColors ?? {},
      ownerColorPalette: OWNER_COLOR_PALETTE,
      members,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "add_card");
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    let crm = readCrmState(installation);

    let createdPipelineId: string | null = null;
    let createdStageId: string | null = null;
    let createdCardId: string | null = null;

    if (action === "ensure_default" && !crm.pipelines.length) {
      crm = { ...crm, pipelines: [defaultIntakePipeline()] };
    } else if (action === "add_pipeline" || action === "create_pipeline") {
      const created = createPipeline(crm, {
        name: body.name,
        stages: Array.isArray(body.stages) ? body.stages : null,
      });
      crm = created.crm;
      createdPipelineId = created.pipelineId;
    } else if (action === "rename_pipeline") {
      crm = renamePipeline(crm, {
        pipelineId: String(body.pipelineId),
        name: body.name,
      });
    } else if (action === "delete_pipeline") {
      if ((crm.pipelines ?? []).length <= 1) {
        return NextResponse.json({ ok: false, error: "Keep at least one pipeline." }, { status: 400 });
      }
      crm = deletePipeline(crm, { pipelineId: String(body.pipelineId) });
    } else if (action === "rename_stage") {
      crm = renamePipelineStage(crm, {
        pipelineId: String(body.pipelineId),
        stageId: String(body.stageId),
        label: body.label ?? body.name,
      });
    } else if (action === "add_stage") {
      const added = addPipelineStage(crm, {
        pipelineId: String(body.pipelineId),
        label: body.label ?? body.name ?? "",
        afterStageId: body.afterStageId ?? null,
      });
      crm = added.crm;
      createdStageId = added.stageId;
    } else if (action === "reorder_stages") {
      crm = reorderPipelineStages(crm, {
        pipelineId: String(body.pipelineId),
        stageId: String(body.stageId),
        toIndex: Number(body.toIndex),
      });
    } else if (action === "remove_stage") {
      const pipe = (crm.pipelines ?? []).find((p: any) => String(p.id) === String(body.pipelineId));
      if ((pipe?.stages ?? []).length <= 1) {
        return NextResponse.json({ ok: false, error: "Keep at least one stage." }, { status: 400 });
      }
      crm = removePipelineStage(crm, {
        pipelineId: String(body.pipelineId),
        stageId: String(body.stageId),
      });
    } else if (action === "add_card" || action === "rename_card") {
      const upserted = upsertPipelineCard(crm, {
        pipelineId: String(body.pipelineId ?? crm.pipelines[0]?.id),
        card: body.card ?? body,
      });
      crm = upserted.crm;
      createdCardId = upserted.cardId;
    } else if (action === "delete_card" || action === "remove_card") {
      crm = removePipelineCard(crm, {
        pipelineId: String(body.pipelineId),
        cardId: String(body.cardId),
      });
    } else if (action === "move_card") {
      crm = movePipelineCard(crm, {
        pipelineId: String(body.pipelineId),
        cardId: String(body.cardId),
        stageId: String(body.stageId),
        index: body.index ?? null,
      });
      const movedCard = (crm.pipelines ?? [])
        .flatMap((p: any) => p.cards ?? [])
        .find((c: any) => String(c.id) === String(body.cardId));
      const stage = (crm.pipelines ?? [])
        .flatMap((p: any) => (p.stages ?? []).map((s: any) => ({ ...s, pipelineId: p.id, pipelineName: p.name })))
        .find((s: any) => String(s.id) === String(body.stageId));
      try {
        await (ctx.service as any).emitSpecialtyBusinessEvent?.({
          eventType: "PIPELINE_STAGE_ENTERED",
          forceManual: false,
          brief: `Opportunity “${movedCard?.title ?? body.cardId}” entered stage “${stage?.label ?? body.stageId}”`,
          actorId,
          eventPayload: {
            pipelineId: String(body.pipelineId),
            pipelineName: stage?.pipelineName ?? null,
            cardId: String(body.cardId),
            title: movedCard?.title ?? null,
            stageId: String(body.stageId),
            stageLabel: stage?.label ?? null,
            contactId: movedCard?.contactId ?? null,
          },
        });
      } catch {
        /* optional */
      }
    } else if (action === "set_owner_color") {
      crm = setOwnerColor(crm, {
        userId: String(body.userId ?? ""),
        colorId: body.colorId == null || body.colorId === "" ? null : String(body.colorId),
        label: body.label ?? null,
      });
    } else {
      return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }

    await writeCrmState({ platformStore, installation, crm, actorId });
    return NextResponse.json({
      ok: true,
      pipelines: crm.pipelines,
      ownerColors: crm.ownerColors ?? {},
      createdPipelineId,
      createdStageId,
      createdCardId,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
