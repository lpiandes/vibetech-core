import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import EmptyBusinessHome from "@/components/home/EmptyBusinessHome";
import SetupChecklistBanner from "@/components/home/SetupChecklistBanner";
import ExecutiveHomeLayout from "@/components/home/ExecutiveHomeLayout";
import ProspectInquiryForm from "@/components/home/ProspectInquiryForm";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function BusinessHomePage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("home", async () => {
    const [ctx, knowledgeDocumentCount, teamInviteChecklistComplete] = await Promise.all([
      getAuthorizedWorkspace(businessId),
      platformStore.countActiveKnowledgeDocuments(businessId),
      platformStore.isTeamInviteChecklistComplete(businessId),
    ]);
    markRequestTiming("KNOWLEDGE_DB");
    ctx.service.refreshOperationalState(knowledgeDocumentCount);
    markRequestTiming("REFRESH_OPERATIONAL_STATE");
    const home = ctx.service.loadBusinessHomeViewModel({
      activeKnowledgeDocumentCount: knowledgeDocumentCount,
      teamInviteChecklistComplete,
    });
    const propertyOptions = home.showProspectInquiryForm
      ? ctx.service.loadBusinessSubjectIndex(["property", "listing", "unit"]).subjects.map((s: { id: string; displayName: string; address: string | null }) => ({
          id: s.id,
          displayName: s.displayName,
          address: s.address,
        }))
      : [];
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(home).length });

    const executive = home.executive;
    const showFullChecklist = !executive.showOperatingDashboard;
    const showChecklistBanner = executive.showOperatingDashboard && executive.collapseChecklist;

    return (
      <>
        {showFullChecklist ? <EmptyBusinessHome {...home} /> : null}
        {showChecklistBanner ? <SetupChecklistBanner businessName={home.businessName} checklist={home.checklist} /> : null}
        {executive.showOperatingDashboard ? (
          <ExecutiveHomeLayout executive={executive as never} businessId={businessId} />
        ) : null}
        {home.showProspectInquiryForm ? (
          <div id="prospect-inquiry" style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 48px" }}>
            <ProspectInquiryForm
              key={`${businessId}-${home.coordinatorReady ? "ready" : "blocked"}`}
              businessId={businessId}
              coordinatorReady={home.coordinatorReady}
              propertyOptions={propertyOptions}
            />
          </div>
        ) : null}
      </>
    );
  });
}
