import { NextResponse } from "next/server";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { ContinuousBusinessBuilderService } from "../../../../../../../backend/core/ai-builder/ContinuousBusinessBuilderService.js";
import { platformStore } from "@/lib/server/compose";
import { getAuthorizedBusinessScope } from "@/lib/platform/AuthorizedWorkspaceService";
import { presentProductError } from "@/lib/platform/productErrors";

type Params = { params: Promise<{ businessId: string }> };

/**
 * Ask VIBETech / continuous improve.
 * Requires a canonical installed Business OS in Postgres (written at Architect install).
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { businessId } = await params;
    const scope = await getAuthorizedBusinessScope(businessId, "business.manage");
    const body = await request.json().catch(() => ({}));

    const installation = await platformStore.getBusinessOSInstallation(businessId);
    if (!installation || installation.status !== "installed") {
      const productError = presentProductError("installed_specification_required");
      return NextResponse.json({
        ok: false,
        reason: "installed_specification_required",
        error: productError.message,
        productError,
      }, { status: 400 });
    }

    const specRow = await (platformStore as any).getBusinessOSSpecification({
      businessId,
      specificationId: installation.specificationId,
      specificationVersion: installation.specificationVersion,
    });
    const installedSpecification = specRow?.specification ?? null;
    if (!installedSpecification) {
      const productError = presentProductError("installed_specification_required");
      return NextResponse.json({
        ok: false,
        reason: "installed_specification_required",
        error: productError.message,
        productError,
      }, { status: 400 });
    }

    const continuous = new ContinuousBusinessBuilderService({
      aiBuilder: getAiBuilderService(),
    });
    const result = await continuous.startImprovement({
      businessId,
      actorId: scope.user.id,
      installedSpecification,
      prompt: body.prompt ?? "Improve this business",
      intelligenceCandidateId: body.intelligenceCandidateId ?? null,
      extraMetadata: body.intelligenceCandidateId
        ? {
            intelligenceCandidateId: body.intelligenceCandidateId,
            proposeOnly: true,
            neverInstallAutomatically: true,
          }
        : {},
    });

    if (!result.ok) {
      const productError = presentProductError(result.reason ?? result);
      return NextResponse.json({
        ...result,
        error: productError.message,
        productError,
      }, { status: 400 });
    }

    if (platformStore.recordAuditEvent) {
      await platformStore.recordAuditEvent({
        actorUserId: scope.user.id,
        businessId,
        action: "architect.improved",
        targetType: "business_os_installation",
        targetId: installation.id,
        metadata: {
          sessionId: result.session?.sessionId ?? null,
          prompt: body.prompt ?? "Improve this business",
        },
      }).catch(() => null);
    }

    return NextResponse.json(result);
  // Catch auth failures as 403 with a clear product error (not a generic 500).
  } catch (error) {
    const code = String((error as any)?.code ?? "");
    const status = code === "FORBIDDEN" || code === "UNAUTHENTICATED" || code === "SUPPORT_ACCESS_REQUIRED"
      ? (code === "UNAUTHENTICATED" ? 401 : 403)
      : 500;
    const productError = presentProductError(
      code === "FORBIDDEN" || /permission|forbidden/i.test(String((error as any)?.message ?? ""))
        ? "permission_denied"
        : error,
    );
    return NextResponse.json(
      {
        ok: false,
        error: productError.message,
        productError,
      },
      { status },
    );
  }
}
