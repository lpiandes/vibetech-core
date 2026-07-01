import { NextResponse } from "next/server";

import { WorkspaceService } from "@/lib/workspace/WorkspaceService";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    // No payload required today.
    void req;
    const resolvedParams = await context.params;
    const service = new WorkspaceService();
    await service.sendReviewCommunication(resolvedParams.id);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}

