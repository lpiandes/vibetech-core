import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/platform/requirePlatformAdmin";
import { platformStore } from "@/lib/server/compose";
import { invalidateCachedBusinessOsInstallation } from "@/lib/platform/cachedBusinessOsInstallation";
import { markWhiteGloveReady, retryWhiteGloveNotify } from "../../../../../../../backend/core/integrations/whiteglove/requestWhiteGloveSetup.js";
import {
  readPendingOpsRequests,
  resolveBusinessConnectionStatuses,
} from "../../../../../../../backend/core/integrations/whiteglove/whiteGloveOpsState.js";
import { resolveWhiteGloveNeeds } from "../../../../../../../backend/core/integrations/whiteglove/resolveWhiteGloveNeeds.js";
import {
  getWhiteGloveConnection,
  markReadyRequiresConnected,
} from "../../../../../../../backend/core/integrations/whiteglove/WhiteGloveConnectionRegistry.js";
import { readPurchasedPackagesFromConfig } from "../../../../../../../backend/core/platform/packages/SalesPackageCatalog.js";

/**
 * Admin: list pending white-glove items + connection statuses + mark ready (requires Connected).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    await requirePlatformAdmin();
    const { businessId } = await context.params;
    const business = await platformStore.getBusinessById(businessId).catch(() => null);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const pending = readPendingOpsRequests(business?.packageConfiguration, installation);
    const connectionStatuses = await resolveBusinessConnectionStatuses({ platformStore, businessId });
    const packages = readPurchasedPackagesFromConfig({
      ...(business?.packageConfiguration ?? {}),
      ...(installation?.configuration ?? {}),
    });
    const inferredNeeds = resolveWhiteGloveNeeds({
      purchasedPackages: packages,
      configuration: installation?.configuration ?? business?.packageConfiguration ?? {},
    });
    return NextResponse.json({
      ok: true,
      pendingOpsRequests: pending,
      connectionStatuses,
      inferredNeeds: inferredNeeds.map((n: { connectionId: string; ownerTitle?: string }) => ({
        connectionId: n.connectionId,
        ownerTitle: n.ownerTitle,
        markReadyRequiresConnected: markReadyRequiresConnected(n.connectionId),
      })),
      handoff: {
        notifiedAt: business?.packageConfiguration?.whiteGloveHandoffNotifiedAt ?? null,
        notify: business?.packageConfiguration?.whiteGloveHandoffNotify ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  try {
    const user = await requirePlatformAdmin();
    const { businessId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "mark_ready").trim();
    const connectionId = String(body.connectionId ?? "").trim();
    const origin = (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return process.env.NEXT_PUBLIC_APP_ORIGIN || "https://app.vtechdevelopment.com";
      }
    })();

    if (action === "retry_notify") {
      const result = await retryWhiteGloveNotify({
        platformStore,
        businessId,
        connectionId: connectionId || null,
        origin,
        actorId: String(user?.email ?? user?.id ?? "admin"),
      });
      if (!result.ok && result.reason === "not_white_glove") {
        return NextResponse.json({ ok: false, error: "Unknown connection", reason: result.reason }, { status: 400 });
      }
      return NextResponse.json({ ok: Boolean(result.ok ?? result.notifyOk), ...result });
    }

    if (!connectionId) {
      return NextResponse.json({ ok: false, error: "connectionId required" }, { status: 400 });
    }
    const wg = getWhiteGloveConnection(connectionId);
    const result = await markWhiteGloveReady({
      platformStore,
      businessId,
      connectionId,
      actorId: String(user?.email ?? user?.id ?? "admin"),
      requireConnected: body.requireConnected !== false && markReadyRequiresConnected(connectionId),
    });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.message ?? result.reason ?? "Could not mark ready",
        reason: result.reason,
        connectionStatus: result.connectionStatus ?? null,
        markReadyRequiresConnected: markReadyRequiresConnected(connectionId),
        ownerTitle: wg?.ownerTitle ?? null,
      }, { status: result.reason === "not_connected" ? 409 : 400 });
    }
    invalidateCachedBusinessOsInstallation(businessId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
