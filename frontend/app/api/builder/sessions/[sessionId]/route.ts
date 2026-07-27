import { NextResponse } from "next/server";
import { connectedConnectionIdsFromWorkspace } from "@/lib/builder/connectedConnectionIdsFromWorkspace";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { requireArchitectActor, architectApiError } from "@/lib/builder/requireArchitectActor";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { presentProductError } from "@/lib/platform/productErrors";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireArchitectActor();
    const { sessionId } = await params;
    const service = getAiBuilderService();
    const existing = await service.getSession?.(sessionId);
    const businessId = existing?.businessId ? String(existing.businessId) : "";
    let connectedConnectionIds: string[] = [];
    if (businessId && !businessId.startsWith("draft_")) {
      try {
        const { service: workspace } = await getAuthorizedWorkspace(businessId, "business.manage");
        connectedConnectionIds = connectedConnectionIdsFromWorkspace(workspace);
      } catch {
        /* credentials-only fallback inside getWorkspace */
      }
    }
    return NextResponse.json(await service.getWorkspace(sessionId, { connectedConnectionIds }));
  } catch (error) {
    const mapped = architectApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status === 403 ? 403 : 404 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireArchitectActor();
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const service = getAiBuilderService();
    const action = String(body.action ?? "");
    const actorId = body.actorId ?? user.id ?? null;

    if (action === "answer") {
      return NextResponse.json(await service.answer({
        sessionId,
        questionId: body.questionId,
        answer: body.answer,
        skipped: Boolean(body.skipped),
        unknown: Boolean(body.unknown),
      }));
    }
    if (action === "chat") {
      const result = await service.chat({
        sessionId,
        text: body.text,
        actorId: user.id ?? actorId,
      });
      if (result?.reason === "quota_exceeded") {
        return NextResponse.json(result, { status: 429 });
      }
      return NextResponse.json(result);
    }
    if (action === "upload") {
      return NextResponse.json(await service.upload({
        sessionId,
        filename: body.filename,
        mimeType: body.mimeType,
        notes: body.notes,
        textPreview: body.textPreview,
        contentBase64: body.contentBase64 ?? null,
      }));
    }
    if (action === "research") {
      return NextResponse.json(await service.research({
        sessionId,
        websiteUrl: body.websiteUrl,
        manualFallbackText: body.manualFallbackText,
      }));
    }
    if (action === "confirm_research") {
      return NextResponse.json(await service.confirmResearch({
        sessionId,
        accepted: body.accepted !== false,
        edits: body.edits ?? {},
      }));
    }
    if (action === "update_appearance") {
      return NextResponse.json(await service.updateAppearance({
        sessionId,
        accentColor: body.accentColor,
        logoUrl: body.logoUrl,
        businessName: body.businessName,
        navigationOverrides: body.navigationOverrides,
        employeeOverrides: body.employeeOverrides,
        roleOverrides: body.roleOverrides,
        sectionOverrides: body.sectionOverrides,
        planAdditions: body.planAdditions,
      }));
    }
    if (action === "apply_plan_changes") {
      return NextResponse.json(await service.applyPlanChanges({
        sessionId,
        removeModuleIds: body.removeModuleIds ?? [],
        removeEmployeeIds: body.removeEmployeeIds ?? [],
        addRequest: body.addRequest ?? "",
      }));
    }
    if (action === "portal_preview") {
      return NextResponse.json(await service.portalPreview({
        sessionId,
        membershipRole: body.membershipRole ?? "OWNER",
      }));
    }
    if (action === "propose") {
      return NextResponse.json(await service.propose({ sessionId }));
    }
    if (action === "dry_run") {
      return NextResponse.json(await service.dryRun({ sessionId }));
    }
    if (action === "approve") {
      return NextResponse.json(await service.approve({
        sessionId,
        actorId,
      }));
    }
    if (action === "install") {
      return NextResponse.json(await service.install({
        sessionId,
        approved: Boolean(body.approved),
        actorId,
      }));
    }
    if (action === "resume_install") {
      return NextResponse.json(await service.resumeInstall({
        sessionId,
        actorId,
      }));
    }
    if (action === "get_proposal") {
      return NextResponse.json(await service.getProposal(sessionId));
    }
    if (action === "archive" || action === "remove") {
      return NextResponse.json(await service.archiveSession({ sessionId }));
    }
    return NextResponse.json({
      ok: false,
      error: presentProductError("Unknown action.").message,
      productError: presentProductError("Unknown action."),
    }, { status: 400 });
  } catch (error) {
    const mapped = architectApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
