import { NextResponse } from "next/server";

import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await context.params;
    const body = await req.json().catch(() => ({}));
    const decision = body?.decision;
    if (decision !== "APPROVE" && decision !== "REJECT") {
      return NextResponse.json(
        { ok: false, error: "Invalid decision" },
        { status: 400 },
      );
    }

    const service = new WorkspaceService();
    await service.applyReviewDecision(resolvedParams.id, decision);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

