import { NextResponse } from "next/server";
import { getBusinessBuilderService } from "@/lib/builder/getBusinessBuilderService";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const service = getBusinessBuilderService();
    const result = service.startSession({
      mode: body.mode === "client" ? "client" : "operator",
      businessName: body.businessName ?? null,
      websiteUrl: body.websiteUrl ?? null,
      businessId: body.businessId ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not start builder session." },
      { status: 500 },
    );
  }
}
