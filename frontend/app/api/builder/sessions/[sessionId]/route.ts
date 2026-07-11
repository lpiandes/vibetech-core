import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { requireArchitectActor, architectApiError } from "@/lib/builder/requireArchitectActor";
import { presentProductError } from "@/lib/platform/productErrors";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireArchitectActor();
    const { sessionId } = await params;
    const service = getAiBuilderService();
    return NextResponse.json(await service.getWorkspace(sessionId));
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
      return NextResponse.json(await service.chat({ sessionId, text: body.text }));
    }
    if (action === "upload") {
      return NextResponse.json(await service.upload({
        sessionId,
        filename: body.filename,
        mimeType: body.mimeType,
        notes: body.notes,
        textPreview: body.textPreview,
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
