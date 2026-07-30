import { NextResponse } from "next/server";

import { getAuthorizedWorkspace, authorizationErrorResponse } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import {
  readGmailInboxState,
  readGmailInboxSyncState,
} from "../../../../../../../../backend/core/integrations/gmail/GmailInboxStore.js";

/**
 * Read path for the v1 Gmail inbox synced store. Backs the Gmail inbox UI and can be
 * polled by clients after a "Sync now" call instead of a full page reload.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    await getAuthorizedWorkspace(businessId);

    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const inbox = readGmailInboxState(installation);
    const sync = readGmailInboxSyncState(installation);

    return NextResponse.json({
      ok: true,
      messages: inbox.messages,
      sync,
    });
  } catch (err) {
    return authorizationErrorResponse(err);
  }
}
