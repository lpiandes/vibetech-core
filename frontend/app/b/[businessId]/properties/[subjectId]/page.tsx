export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { PERMISSIONS } from "../../../../../../backend/core/platform/permissions/rolePermissions.js";
import PropertyDetailLayout from "@/components/properties/PropertyDetailLayout";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; subjectId: string }>;
}) {
  const { businessId, subjectId } = await params;
  return runTimedPage("property-detail", async () => {
    const { service } = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const preview = service.loadBusinessSubjectAudiencePreview(subjectId);
    if (!preview) notFound();
    const operatingDetail = service.loadBusinessSubjectOperatingDetail(subjectId);
    const presentation = service.loadPortfolioPresentation();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify({ preview, operatingDetail }).length });

    return (
      <PropertyDetailLayout
        businessId={businessId}
        preview={preview}
        operatingDetail={operatingDetail}
        presentation={{
          detailMetrics: presentation.detailMetrics,
          subjectTypeLabels: presentation.subjectTypeLabels,
        }}
      />
    );
  });
}
