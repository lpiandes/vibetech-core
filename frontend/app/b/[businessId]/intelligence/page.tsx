import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { PageHeader } from "@/components/operating/PageHeader";
import DecisionsQueue from "@/components/decisions/DecisionsQueue";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { spacing } from "@/design/tokens";
import { syncDurableDecisionDraftsForWorkspace } from "../../../../../backend/core/approvals/syncDurableDecisionDraftsForWorkspace.js";

/**
 * Decisions — managerial judgment only (Full Plan §3B / Plan 14).
 * BI ideas are not this surface.
 */
export default async function DecisionsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return runTimedPage("intelligence", async () => {
    const { service } = await getAuthorizedWorkspace(businessId);
    // Prove / content write drafts to Postgres; warm composition can be stale.
    await syncDurableDecisionDraftsForWorkspace({
      platformStore,
      businessId,
      service,
    });
    const attention = service.loadAttentionViewModel();
    const raw = attention.needsYourAttention ?? attention.attentionItems ?? [];
    const items = (Array.isArray(raw) ? raw : []).filter((item: { sourceType?: string }) => {
      const t = String(item?.sourceType ?? "");
      return t !== "intelligence_candidate";
    });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(items).length });

    return (
      <div style={{ display: "grid", gap: spacing.lg, maxWidth: 960, margin: "0 auto", width: "100%", padding: `0 ${spacing.md}` }}>
        <PageHeader
          title="Decisions"
          description="Approve, edit, assign, or reject — only when judgment is needed."
        />
        <DecisionsQueue businessId={businessId} items={items as never[]} />
      </div>
    );
  });
}
