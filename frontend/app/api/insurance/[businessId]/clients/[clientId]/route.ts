import { NextResponse } from "next/server";
import { requireFeRetentionContext, feJsonError } from "@/lib/insurance/feRetentionApi";
import {
  getFeClient,
  upsertFeClient,
  deleteFeClient,
  writeFeRetentionState,
} from "@/lib/insurance/feRetentionCore";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; clientId: string }> },
) {
  try {
    const { businessId, clientId } = await params;
    const { state } = await requireFeRetentionContext(businessId);
    const client = getFeClient(state, clientId);
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    const history = (state.messageLog ?? []).filter((row: any) => String(row.clientId) === String(clientId));
    return NextResponse.json({ client, history });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string; clientId: string }> },
) {
  try {
    const { businessId, clientId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const existing = getFeClient(ctx.state, clientId);
    if (!existing) return NextResponse.json({ error: "Client not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const result = upsertFeClient(ctx.state, {
      ...existing,
      ...body,
      id: clientId,
      policy: { ...existing.policy, ...(body.policy ?? {}) },
    });
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
    await writeFeRetentionState({
      platformStore: ctx.platformStore,
      installation: ctx.installation,
      state: result.state!,
      actorId: ctx.scope.user.id,
      historyAction: "fe_client_update",
    });
    return NextResponse.json({ ok: true, client: result.client });
  } catch (err) {
    return feJsonError(err);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ businessId: string; clientId: string }> },
) {
  try {
    const { businessId, clientId } = await params;
    const ctx = await requireFeRetentionContext(businessId);
    const result = deleteFeClient(ctx.state, clientId);
    if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 404 });
    await writeFeRetentionState({
      platformStore: ctx.platformStore,
      installation: ctx.installation,
      state: result.state,
      actorId: ctx.scope.user.id,
      historyAction: "fe_client_delete",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return feJsonError(err);
  }
}
