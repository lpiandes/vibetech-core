import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { redirectIfModuleDenied } from "@/lib/platform/enforceRoleModuleAccess";
import CommunicationRenderer from "@/components/communications/CommunicationRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { brand, cockpitColors } from "@/design/tokens";
import Link from "next/link";

export default async function InboxPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("inbox", async () => {
    const ctx = await getAuthorizedWorkspace(businessId);
    await redirectIfModuleDenied({ businessId, role: ctx.role, moduleId: "inbox" });
    const { service } = ctx;
    const viewModel = service.loadCommunicationViewModel({ includeProductContext: false });
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(viewModel).length });
    const peopleHref = `/b/${encodeURIComponent(businessId)}/people`;
    return (
      <div style={{ display: "grid", gap: 12, width: "100%", maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${cockpitColors.panelBorder}`,
            background: cockpitColors.panelElevated,
            color: cockpitColors.textPrimary,
            padding: "10px 14px",
            fontSize: 13,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ color: cockpitColors.textSecondary }}>
            Conversations stay tied to CRM contacts — open People to manage leads, families, and contractors.
          </span>
          <Link href={peopleHref} style={{ fontWeight: 800, color: brand.cyan, textDecoration: "none" }}>
            Open People →
          </Link>
        </div>
        <CommunicationRenderer viewModel={viewModel} />
      </div>
    );
  });
}
