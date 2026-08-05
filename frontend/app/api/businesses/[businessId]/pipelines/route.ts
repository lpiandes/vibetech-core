import { NextResponse } from "next/server";

import {
  getAuthorizedWorkspace,
  getAuthorizedBusinessScope,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import { getCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
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
import { findCardAndStage, buildPipelineCardEventPayload } from "@/lib/pipelines/pipelineCardEvents";

async function emitPipelineCardEvent(
  ctx: any,
  {
    eventType,
    brief,
    actorId,
    pipelineId,
    card,
    stage,
  }: { eventType: string; brief: string; actorId: string; pipelineId: string; card: any; stage: any },
) {
  try {
    await ctx.service?.emitSpecialtyBusinessEvent?.({
      eventType,
      forceManual: false,
      brief,
      actorId,
      eventPayload: buildPipelineCardEventPayload({ pipelineId, card, stage }),
    });
  } catch {
    /* optional */
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedBusinessScope(businessId, PERMISSIONS.PEOPLE_VIEW);
    const installation = await getCachedBusinessOsInstallation(businessId).catch(() => null);
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
      const targetPipelineId = String(body.pipelineId ?? crm.pipelines[0]?.id);
      const upserted = upsertPipelineCard(crm, {
        pipelineId: targetPipelineId,
        card: body.card ?? body,
      });
      crm = upserted.crm;
      createdCardId = upserted.cardId;
      if (action === "add_card" && upserted.cardId) {
        const { card: newCard, stage } = findCardAndStage(crm, upserted.cardId);
        await emitPipelineCardEvent(ctx, {
          eventType: "PIPELINE_CARD_CREATED",
          brief: `New card “${newCard?.title || "Opportunity"}” added to pipeline`,
          actorId,
          pipelineId: targetPipelineId,
          card: newCard,
          stage,
        });
        // A freshly created card also enters its initial stage — let stage-based
        // automations (e.g. "When a card enters X") fire the same as on move_card.
        await emitPipelineCardEvent(ctx, {
          eventType: "PIPELINE_STAGE_ENTERED",
          brief: `Opportunity “${newCard?.title || "Opportunity"}” entered stage “${stage?.label ?? newCard?.stageId}”`,
          actorId,
          pipelineId: targetPipelineId,
          card: newCard,
          stage,
        });
      }
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
      const { card: movedCard, stage } = findCardAndStage(crm, String(body.cardId), String(body.stageId));
      await emitPipelineCardEvent(ctx, {
        eventType: "PIPELINE_STAGE_ENTERED",
        brief: `Opportunity “${movedCard?.title ?? body.cardId}” entered stage “${stage?.label ?? body.stageId}”`,
        actorId,
        pipelineId: String(body.pipelineId),
        card: movedCard,
        stage,
      });
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
