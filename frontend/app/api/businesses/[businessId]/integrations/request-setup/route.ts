import { NextResponse } from "next/server";
import {
  getAuthorizedWorkspace,
  authorizationErrorResponse,
} from "@/lib/platform/AuthorizedWorkspaceService";
import { AuthorizationError, platformStore } from "@/lib/server/compose";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { isWhiteGloveConnection } from "../../../../../../../backend/core/integrations/whiteglove/WhiteGloveConnectionRegistry.js";
import { requestWhiteGloveSetup } from "../../../../../../../backend/core/integrations/whiteglove/requestWhiteGloveSetup.js";

function jsonError(error: unknown) {
  if (error instanceof AuthorizationError) return authorizationErrorResponse(error);
  return NextResponse.json({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, { status: 500 });
}

/**
 * Owner requests VIBETech to set up a white-glove connection.
 * Body: { connectionId, cell?, notes?, pageName?, pageUrl?, needEverything? }
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await context.params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const connectionId = String(body.connectionId ?? "").trim();
    if (!connectionId || !isWhiteGloveConnection(connectionId)) {
      return NextResponse.json({
        ok: false,
        error: "This connection is self-serve — use Connect, not Request setup.",
      }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const requestedBy = String((ctx as any)?.user?.email ?? "owner");
    const result = await requestWhiteGloveSetup({
      platformStore,
      businessId,
      connectionId,
      origin,
      requestedBy,
      needEverything: body.needEverything === true,
      ownerInputs: {
        cell: body.cell ?? body.forwardNumber ?? null,
        forwardNumber: body.forwardNumber ?? body.cell ?? null,
        notes: body.notes ?? null,
        pageName: body.pageName ?? null,
        pageUrl: body.pageUrl ?? null,
        brand: body.brand ?? null,
        ein: body.ein ?? null,
        contactEmail: body.contactEmail ?? null,
        locationId: body.locationId ?? null,
        accessInvite: body.accessInvite ?? null,
        hubspotPortal: body.hubspotPortal ?? null,
        salesforceOrg: body.salesforceOrg ?? null,
      },
      // null → policy + auto-fulfill decide; explicit false still allowed for tests
      notify: body.notify === false ? false : body.notify === true ? true : null,
    });

    invalidateCachedBusinessOsInstallation(businessId);
    if (!result.ok && result.reason === "missing_owner_inputs") {
      return NextResponse.json({
        ok: false,
        error: result.message ?? "Missing required setup details.",
        missing: result.missing ?? [],
        form: result.form ?? null,
      }, { status: 400 });
    }
    return NextResponse.json({
      ok: result.ok,
      connectionId: result.connectionId,
      status: result.opsRequest?.status ?? "pending_ops",
      message: result.ownerMessage,
      notify: result.notify ?? null,
      notifyOk: result.notifyOk !== false,
      notifySkipped: result.notifySkipped === true,
      notifyDecision: result.notifyDecision ?? null,
      error: result.ok ? null : result.reason,
    }, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return jsonError(error);
  }
}
