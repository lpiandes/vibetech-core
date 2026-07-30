import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "@/lib/platform/permissions";
import { platformStore } from "@/lib/server/compose";
import {
  readGmailInboxState,
  setDraftReplyOnMessage,
  writeGmailInboxState,
} from "../../../../../../../../../../backend/core/integrations/gmail/GmailInboxStore.js";

/**
 * Approve-first reply, minimum viable: persists a draft reply body on the stored
 * message. Nothing is ever sent from here — there is no send path wired to this
 * draft yet. This exists so owners can start composing a reply without losing it,
 * while the real approve → send flow is built.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string; messageId: string }> },
) {
  try {
    const { businessId, messageId } = await params;
    await getAuthorizedWorkspace(businessId, PERMISSIONS.INTEGRATIONS_MANAGE);
    const body = await request.json().catch(() => ({}));
    const draftBody = String(body?.body ?? "").trim();

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    if (!installation) {
      return NextResponse.json(
        { error: "Business OS installation not found.", code: "INSTALLATION_MISSING" },
        { status: 404 },
      );
    }

    const currentInbox = readGmailInboxState(installation);
    const exists = currentInbox.messages.some((m: any) => String(m.gmailMessageId) === String(messageId));
    if (!exists) {
      return NextResponse.json({ error: "Message not found in synced inbox.", code: "NOT_FOUND" }, { status: 404 });
    }

    const draftReply = draftBody
      ? { body: draftBody, status: "pending_approval", updatedAt: new Date().toISOString() }
      : null;

    const nextInbox = setDraftReplyOnMessage(currentInbox, { gmailMessageId: messageId, draftReply });
    await writeGmailInboxState({
      platformStore,
      installation,
      inbox: nextInbox,
      sync: {},
      actorId: "owner",
    });

    return NextResponse.json({
      ok: true,
      messageId,
      draftReply,
      note: "Draft saved. Approve-first sending is not built yet — nothing is sent automatically.",
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
