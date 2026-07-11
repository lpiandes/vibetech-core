import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { sessionId } = await params;
    const service = getAiBuilderService();
    return NextResponse.json(await service.getWorkspace(sessionId));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Session not found." },
      { status: 404 },
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const service = getAiBuilderService();
    const action = String(body.action ?? "");

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
        actorId: body.actorId ?? null,
      }));
    }
    if (action === "install") {
      return NextResponse.json(await service.install({
        sessionId,
        approved: Boolean(body.approved),
        actorId: body.actorId ?? null,
      }));
    }
    if (action === "resume_install") {
      return NextResponse.json(await service.resumeInstall({
        sessionId,
        actorId: body.actorId ?? null,
      }));
    }
    if (action === "get_proposal") {
      return NextResponse.json(await service.getProposal(sessionId));
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Builder action failed." },
      { status: 500 },
    );
  }
}
