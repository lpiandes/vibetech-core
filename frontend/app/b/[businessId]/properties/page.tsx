import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import PropertiesRenderer from "@/components/properties/PropertiesRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function PropertiesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("properties", async () => {
    const { service } = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const portfolio = service.loadBusinessSubjectPortfolioIndex();
    const presentation = service.loadPortfolioPresentation();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(portfolio).length });

    return (
      <PropertiesRenderer businessId={businessId} portfolio={portfolio as never} presentation={presentation} />
    );
  });
}
