import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readCrmState,
  writeCrmState,
  upsertContact,
  removeContact,
  CONTACT_KINDS,
} from "../../../../../../backend/core/crm/CrmStore.js";

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
    let crm = readCrmState(installation);
    crm = upsertContact(crm, body);
    await writeCrmState({ platformStore, installation, crm, actorId });

    // Best-effort: also register in business graph when available
    try {
      const graph = (ctx.service as any)?.connected?.ctx?.businessGraphRuntime;
      if (graph?.applyEvent) {
        const partyId = crm.contacts[crm.contacts.length - 1]?.partyId;
        graph.applyEvent({
          id: `evt_party_${partyId}_${Date.now()}`,
          timestampISO: new Date().toISOString(),
          type: "PARTY_REGISTERED",
          source: "crm_contacts",
          payload: {
            party: {
              id: partyId,
              displayName: name,
              partyType: "PERSON",
              metadata: {
                email: body.email,
                phone: body.phone,
                kind: body.kind,
                tags: body.tags,
              },
            },
          },
        });
      }
    } catch {
      /* graph optional */
    }

    return NextResponse.json({ ok: true, contacts: crm.contacts });
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
    let crm = readCrmState(installation);
    crm = upsertContact(crm, body);
    await writeCrmState({ platformStore, installation, crm, actorId });
    return NextResponse.json({ ok: true, contacts: crm.contacts });
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
    crm = removeContact(crm, { contactId });
    await writeCrmState({ platformStore, installation, crm, actorId });
    return NextResponse.json({ ok: true, contacts: crm.contacts });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}
