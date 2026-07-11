import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { ContinuousBusinessBuilderService } from "../../../../../../../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import { platformStore } from "../../../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";

type Params = { params: Promise<{ businessId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { businessId } = await params;
    const scope = await getAuthorizedBusinessScope(businessId, "business.manage");
    const body = await request.json().catch(() => ({}));

    let installedSpecification = body.specification ?? null;
    if (!installedSpecification) {
      try {
        const installation = await platformStore.getBusinessOSInstallation(businessId);
        const specRow = installation
          ? await platformStore.getBusinessOSSpecification({
              businessId,
              specificationId: installation.specificationId,
            })
          : null;
        installedSpecification = specRow?.specification ?? null;
      } catch {
        installedSpecification = null;
      }
    }

    const continuous = new ContinuousBusinessBuilderService({
      aiBuilder: getAiBuilderService(),
    });
    const result = await continuous.startImprovement({
      businessId,
      actorId: scope.user.id,
      installedSpecification,
      prompt: body.prompt ?? "Improve this business",
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not start improvement." },
      { status: 500 },
    );
  }
}
