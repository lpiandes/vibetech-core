import { NextResponse } from "next/server";
import { getBusinessBuilderService } from "@/lib/builder/getBusinessBuilderService";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { sessionId } = await params;
  const service = getBusinessBuilderService();
  const session = service.getSession(sessionId);
  if (!session) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
  return NextResponse.json({ ok: true, session });
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { sessionId } = await params;
    const body = await request.json().catch(() => ({}));
    const service = getBusinessBuilderService();
    const action = String(body.action ?? "");

    if (action === "next_questions") {
      return NextResponse.json(service.getDiscoveryState(sessionId));
    }
    if (action === "answer") {
      return NextResponse.json(service.answerQuestion({
        sessionId,
        questionId: body.questionId,
        answer: body.answer,
        confidence: body.confidence,
      }));
    }
    if (action === "upload") {
      return NextResponse.json(service.attachUpload({
        sessionId,
        filename: body.filename,
        mimeType: body.mimeType,
        notes: body.notes,
      }));
    }
    if (action === "research") {
      return NextResponse.json(await service.attachWebsiteResearch({
        sessionId,
        websiteUrl: body.websiteUrl,
      }));
    }
    if (action === "propose") {
      return NextResponse.json(service.propose({ sessionId }));
    }
    if (action === "dry_run") {
      return NextResponse.json(service.dryRun({
        sessionId,
        specification: body.specification,
      }));
    }
    if (action === "install") {
      return NextResponse.json(service.install({
        sessionId,
        specification: body.specification,
        plan: body.plan,
        dryRunResult: body.dryRunResult,
        approved: Boolean(body.approved),
      }));
    }
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Builder action failed." },
      { status: 500 },
    );
  }
}
