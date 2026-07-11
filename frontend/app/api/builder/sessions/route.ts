import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const service = getAiBuilderService();
    const mode = body.mode === "operator" || body.mode === "internal_vibetech_build"
      ? "internal_vibetech_build"
      : body.mode === "client"
        ? "client_self_service"
        : (body.mode ?? "new_business");
    const result = await service.startSession({
      mode,
      businessName: body.businessName ?? null,
      websiteUrl: body.websiteUrl ?? null,
      businessId: body.businessId ?? null,
      actorId: body.actorId ?? null,
      description: body.description ?? body.businessName ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not start builder session." },
      { status: 500 },
    );
  }
}
