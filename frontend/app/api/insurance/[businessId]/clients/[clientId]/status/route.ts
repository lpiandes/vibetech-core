import { NextResponse } from "next/server";
import {
  requireFeRetentionContext,
  feJsonError,
  resolveFeIntegrationPlatform,
  getFeDeliveryProvider,
} from "@/lib/insurance/feRetentionApi";
import {
  setFeClientPolicyStatus,
  writeFeRetentionState,
  deliverFeClientTouchpoint,
} from "@/lib/insurance/feRetentionCore";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; clientId: string }> },
) {
  try {
    const { businessId, clientId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const body = await request.json().catch(() => ({}));
    const status = String(body.status ?? "").toLowerCase();
    const result = setFeClientPolicyStatus(ctx.state, {
      clientId,
      status,
      source: "manual",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    let state = result.state!;
    await writeFeRetentionState({
      platformStore: ctx.platformStore,
      installation: ctx.installation,
      state,
      actorId: ctx.scope.user.id,
      historyAction: "fe_status_change",
    });
    ctx.installation.configuration = {
      ...(ctx.installation.configuration ?? {}),
      feRetention: state,
    };

    if (status === "missed" || status === "lapsed") {
      // Avoid duplicate recovery SMS/email if already on this status.
      if (result.previousStatus === status) {
        return NextResponse.json({
          ok: true,
          client: result.client,
          skippedNotify: true,
          message: `Already marked ${status}.`,
        });
      }
      const integrationPlatform = await resolveFeIntegrationPlatform(businessId);
      const deliveryProvider = getFeDeliveryProvider();
      const delivered = await deliverFeClientTouchpoint({
        platformStore: ctx.platformStore,
        installation: ctx.installation,
        state,
        client: result.client,
        kind: "lapseRecovery",
        integrationPlatform,
        deliveryProvider,
        agentEmail: ctx.agentNotify?.email || state.settings?.agentNotifyEmail || null,
        agentPhone: ctx.agentNotify?.phone || state.settings?.agentNotifyPhone || null,
        businessName: ctx.business?.name,
        actorId: ctx.scope.user.id,
      });
      state = delivered.state;
    }

    const alertEmail = ctx.agentNotify?.email || state.settings?.agentNotifyEmail || "";
    const statusMessages: Record<string, string> = {
      missed: `Marked missed — recovery text sent.${alertEmail ? ` Alert email: ${alertEmail}.` : ""}`,
      lapsed: `Marked lapsed — recovery text sent.${alertEmail ? ` Alert email: ${alertEmail}.` : ""}`,
      active: "Marked reinstated.",
      cancelled: "Marked cancelled.",
    };

    return NextResponse.json({
      ok: true,
      client: state.clients.find((c: any) => c.id === clientId) ?? result.client,
      message: statusMessages[status] || "Status updated.",
    });
  } catch (err) {
    return feJsonError(err);
  }
}
