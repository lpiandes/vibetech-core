import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { requireArchitectActor, architectApiError } from "@/lib/builder/requireArchitectActor";

export async function GET(request: Request) {
  try {
    await requireArchitectActor();
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    const service = getAiBuilderService();
    return NextResponse.json(await service.listSessions({
      businessId: (businessId || null) as never,
    }));
  } catch (error) {
    const mapped = architectApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireArchitectActor();
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
      actorId: body.actorId ?? user.id ?? null,
      description: body.description ?? body.businessName ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    const mapped = architectApiError(error);
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
