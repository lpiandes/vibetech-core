import Link from "next/link";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import GmailInboxPanel from "@/components/communications/GmailInboxPanel";
import {
  readGmailInboxState,
  readGmailInboxSyncState,
} from "../../../../../../../backend/core/integrations/gmail/GmailInboxStore.js";

/**
 * Gmail inbox (v1) — manual "Sync now" + synced message list/detail with a
 * draft-only reply box. Separate from the main /inbox (CommunicationRuntime-backed)
 * surface; see GmailInboundSyncService.js for why this stays a lightweight store
 * for now instead of a full CommunicationRuntime wiring.
 */
export default async function GmailInboxPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("gmail-inbox", async () => {
    await getAuthorizedWorkspace(businessId);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    const inbox = readGmailInboxState(installation);
    const sync = readGmailInboxSyncState(installation);

    return (
      <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 1000, margin: "0 auto" }}>
        <Link
          href={`/b/${encodeURIComponent(businessId)}/integrations`}
          style={{ fontSize: 13, color: "#0f766e", textDecoration: "none", fontWeight: 700 }}
        >
          ← Integrations
        </Link>
        <GmailInboxPanel businessId={businessId} initialMessages={inbox.messages as any} initialSync={sync as any} />
      </div>
    );
  });
}
