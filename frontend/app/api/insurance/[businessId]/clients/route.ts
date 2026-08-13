import { NextResponse } from "next/server";
import {
  requireFeRetentionContext,
  feJsonError,
  resolveFeIntegrationPlatform,
  getFeDeliveryProvider,
} from "@/lib/insurance/feRetentionApi";
import {
  listFeClients,
  upsertFeClient,
  writeFeRetentionState,
  deliverFeClientTouchpoint,
} from "@/lib/insurance/feRetentionCore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const { state } = await requireFeRetentionContext(businessId);
    return NextResponse.json({ clients: listFeClients(state) });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const body = await request.json().catch(() => ({}));
    const result = upsertFeClient(ctx.state, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 });
    }

    let state = result.state!;
    await writeFeRetentionState({
      platformStore: ctx.platformStore,
      installation: ctx.installation,
      state,
      actorId: ctx.scope.user.id,
      historyAction: result.isNew ? "fe_client_create" : "fe_client_update",
    });
    ctx.installation.configuration = {
      ...(ctx.installation.configuration ?? {}),
      feRetention: state,
    };

    if (result.isNew && result.client) {
      const integrationPlatform = await resolveFeIntegrationPlatform(businessId);
      const deliveryProvider = getFeDeliveryProvider();
      for (const kind of ["welcome", "docsMail"] as const) {
        const delivered = await deliverFeClientTouchpoint({
          platformStore: ctx.platformStore,
          installation: ctx.installation,
          state,
          client: result.client,
          kind,
          integrationPlatform,
          deliveryProvider,
          agentEmail: state.settings?.agentNotifyEmail || ctx.scope.user.email,
          businessName: ctx.business?.name,
          actorId: ctx.scope.user.id,
        });
        state = delivered.state;
        result.client = state.clients.find((c: any) => c.id === result.client!.id) ?? result.client;
      }
    }

    return NextResponse.json({ ok: true, client: result.client, isNew: result.isNew });
  } catch (err) {
    return feJsonError(err);
  }
}
