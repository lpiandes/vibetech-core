import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readCrmState,
  writeCrmState,
  removeContact,
  CONTACT_KINDS,
} from "../../../../../../backend/core/crm/CrmStore.js";
import {
  ensureCrmContactPersisted,
  findContact,
} from "../../../../../../backend/core/crm/ensureCrmContactAndOptionalCard.js";
import { RUNTIME_SNAPSHOT_KINDS } from "../../../../../../backend/core/persistence/RuntimeSnapshotKinds.js";
import { persistAffectedRuntimes } from "../../../../../../backend/core/persistence/PersistedMutationCoordinator.js";

function graphFromCtx(ctx: any) {
  return ctx?.service?.connected?.ctx?.businessGraphRuntime
    ?? ctx?.service?.businessGraphRuntime
    ?? null;
}

function persistGraphFromCtx(ctx: any, businessId: string) {
  const stack = ctx?.service?.connected?.operatingStack
    ?? ctx?.service?.connected?.ctx
    ?? null;
  if (!stack?.businessGraphRuntime) return null;
  return async () => {
    await persistAffectedRuntimes({
      workspaceId: businessId,
      stack,
      integrationPlatform: ctx?.service?.connected?.integrationPlatform,
      kinds: [RUNTIME_SNAPSHOT_KINDS.BUSINESS_GRAPH],
    });
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const crm = readCrmState(installation);
    return NextResponse.json({
      ok: true,
      contacts: crm.contacts,
      kinds: CONTACT_KINDS,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "name required" }, { status: 400 });

    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const result = await ensureCrmContactPersisted({
      platformStore,
      installation,
      actorId,
      businessGraphRuntime: graphFromCtx(ctx),
      persistGraph: persistGraphFromCtx(ctx, businessId) ?? undefined,
      contact: {
        id: body.id,
        partyId: body.partyId,
        name,
        email: body.email,
        phone: body.phone,
        kind: body.kind,
        tags: body.tags,
        notes: body.notes,
        ownerUserId: body.ownerUserId,
      },
      addToPipeline: Boolean(body.addToPipeline),
      pipelineId: body.pipelineId ?? null,
      stageId: body.stageId ?? null,
      dualWriteSource: "crm_contacts",
    });

    if (result.created) {
      try {
        await (ctx.service as any).emitSpecialtyBusinessEvent?.({
          eventType: "CONTACT_CREATED",
          forceManual: false,
          brief: `New contact created: ${result.contact?.name ?? name}`,
          actorId,
          eventPayload: {
            contactId: result.contact?.id,
            contact: result.contact,
            source: "manual",
          },
        });
      } catch {
        /* optional */
      }
    }

    return NextResponse.json({
      ok: true,
      contacts: result.crm.contacts,
      contact: result.contact,
      cardId: result.cardId,
      created: result.created,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    if (!body.id && !body.partyId) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    const result = await ensureCrmContactPersisted({
      platformStore,
      installation,
      actorId,
      businessGraphRuntime: graphFromCtx(ctx),
      persistGraph: persistGraphFromCtx(ctx, businessId) ?? undefined,
      contact: body,
      addToPipeline: false,
      dualWriteSource: "crm_contacts",
    });
    return NextResponse.json({
      ok: true,
      contacts: result.crm.contacts,
      contact: result.contact,
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const ctx = await getAuthorizedWorkspace(businessId, PERMISSIONS.WORK_MANAGE);
    const body = await request.json().catch(() => ({}));
    const contactId = String(body.id ?? body.contactId ?? "").trim();
    if (!contactId) {
      return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
    }
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json({ ok: false, error: "No installed Business OS." }, { status: 400 });
    }
    const actorId = String((ctx as any)?.authz?.user?.id ?? "owner");
    let crm = readCrmState(installation);
    const existing = findContact(crm, { id: contactId });
    crm = removeContact(crm, { contactId: existing?.id ?? contactId });
    await writeCrmState({ platformStore, installation, crm, actorId });
    return NextResponse.json({ ok: true, contacts: crm.contacts });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
