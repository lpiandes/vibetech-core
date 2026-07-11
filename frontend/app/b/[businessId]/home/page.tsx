import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "../../../../../backend/core/platform/persistence/PostgresPlatformStore.js";
import EmptyBusinessHome from "@/components/home/EmptyBusinessHome";
import SetupChecklistBanner from "@/components/home/SetupChecklistBanner";
import ProspectInquiryForm from "@/components/home/ProspectInquiryForm";
import PortalHome from "@/components/portal-renderer/PortalHome";
import { composePortalModel } from "@/lib/portal-renderer/composePortalModel.js";
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

    let portalModel: ReturnType<typeof composePortalModel> | null = null;
    try {
      const installation = await platformStore.getBusinessOSInstallation(businessId);
      let specification = null;
      if (installation?.specificationId) {
        const specRow = await platformStore.getBusinessOSSpecification({
          businessId,
          specificationId: installation.specificationId,
        });
        specification = specRow?.specification ?? null;
      }
      if (installation?.configuration || specification) {
        portalModel = composePortalModel({
          businessId,
          role: String(ctx.role ?? "OWNER"),
          permissions: Array.from((ctx.permissions as Iterable<string> | undefined) ?? []).map(String),
          configuration: installation?.configuration ?? null,
          specification,
        } as any);
      }
    } catch {
      portalModel = null;
    }

    const subjectTypes = portalModel?.subjectTypes?.length
      ? portalModel.subjectTypes
      : ["property", "listing", "unit"];

    const home = ctx.service.loadBusinessHomeViewModel({
      activeKnowledgeDocumentCount: knowledgeDocumentCount,
      teamInviteChecklistComplete,
    });
    const propertyOptions = home.showProspectInquiryForm
      ? ctx.service.loadBusinessSubjectIndex(subjectTypes).subjects.map((s: { id: string; displayName: string; address: string | null }) => ({
          id: s.id,
          displayName: s.displayName,
          address: s.address,
        }))
      : [];
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(home).length });

    const executive = home.executive;
    const showFullChecklist = !executive.showOperatingDashboard;
    const showChecklistBanner = executive.showOperatingDashboard && executive.collapseChecklist;

    // McBride without Business OS install keeps legacy executive layout via PortalHome fallback.
    const preferLegacyExecutive = !portalModel?.drivenByBusinessOS;

    return (
      <>
        {showFullChecklist ? <EmptyBusinessHome {...home} /> : null}
        {showChecklistBanner ? <SetupChecklistBanner businessName={home.businessName} checklist={home.checklist} /> : null}
        <PortalHome
          portalModel={portalModel}
          executive={executive}
          businessId={businessId}
          preferLegacyExecutive={preferLegacyExecutive}
        />
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
