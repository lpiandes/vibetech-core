import { NextResponse } from "next/server";
import { connectedConnectionIdsFromWorkspace } from "@/lib/builder/connectedConnectionIdsFromWorkspace";
import { getAiBuilderService } from "@/lib/builder/getAiBuilderService";
import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { presentProductError } from "@/lib/platform/productErrors";

type Params = { params: Promise<{ businessId: string }> };

/**
 * Start (or resume) package-scoped discovery Ask after admin adds SKUs.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { businessId } = await params;
    const { user, service } = await getAuthorizedWorkspace(businessId, "business.manage");
    const body = await request.json().catch(() => ({}));
    const ai = getAiBuilderService();

    if (body?.action === "clear") {
      const cleared = await ai.clearPackageAsk({ businessId });
      if (!cleared.ok) {
        const productError = presentProductError(cleared.reason ?? "Could not clear package Ask.");
        return NextResponse.json({
          ok: false,
          reason: cleared.reason,
          error: productError.message,
          productError,
        }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }

    const connectedConnectionIds = connectedConnectionIdsFromWorkspace(service);
    const result = await ai.startPackageAskSession({
      businessId,
      actorId: user?.id ?? null,
      connectedConnectionIds,
    });
    if (!result.ok) {
      const productError = presentProductError(result.reason ?? "No package Ask is pending.");
      return NextResponse.json({
        ok: false,
        reason: result.reason,
        error: productError.message,
        productError,
      }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      session: result.session,
      pending: result.pending,
      resumed: result.resumed,
      journey: {
        readyForProposal: Boolean(result.progress?.readyForProposal),
        progress: result.progress,
      },
    });
  } catch (err) {
    const productError = presentProductError(err);
    return NextResponse.json({
      ok: false,
      error: productError.message,
      productError,
    }, { status: 500 });
  }
}
