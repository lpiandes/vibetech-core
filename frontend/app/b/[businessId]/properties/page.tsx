import { getAuthorizedWorkspace } from "@/lib/platform/AuthorizedWorkspaceService";
import { platformStore } from "@/lib/server/compose";
import { PERMISSIONS } from "../../../../../backend/core/platform/permissions/rolePermissions.js";
import PropertiesRenderer from "@/components/properties/PropertiesRenderer";
import ModuleRenderer from "@/components/workspace/ModuleRenderer";
import { runTimedPage } from "@/lib/platform/runTimedPage";
import { markRequestTiming } from "@/lib/platform/pageRequestTiming";
import { redirect } from "next/navigation";

/**
 * Owner Properties surface — portfolio of subjects only.
 * Records / schema admin stays in Architect, not the operating shell.
 */
export default async function PropertiesPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return runTimedPage("properties", async () => {
    const { service } = await getAuthorizedWorkspace(businessId, PERMISSIONS.PEOPLE_VIEW);
    const installation = await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
    let installedModules = Array.isArray(installation?.configuration?.modules)
      ? installation.configuration.modules
      : [];
    if (!installedModules.length && installation?.specificationId) {
      const specification = await platformStore.getBusinessOSSpecification({
        businessId,
        specificationId: installation.specificationId,
      }).catch(() => null);
      installedModules = Array.isArray(specification?.specification?.modules)
        ? specification.specification.modules
        : [];
    }
    const hasPropertyPortfolio = installedModules.some(
      (module: { moduleId?: unknown }) => String(module?.moduleId ?? "") === "properties",
    );

    // A BusinessSubject is not automatically a property. Keep this legacy
    // portfolio isolated to businesses that explicitly installed it.
    if (installation && !hasPropertyPortfolio) {
      redirect(`/b/${encodeURIComponent(businessId)}/people`);
    }

    const portfolio = service.loadBusinessSubjectPortfolioIndex();
    const presentation = service.loadPortfolioPresentation();
    markRequestTiming("VIEW_MODEL", { bytes: JSON.stringify(portfolio).length });

    return (
      <ModuleRenderer moduleId="properties">
        <PropertiesRenderer businessId={businessId} portfolio={portfolio as never} presentation={presentation} />
      </ModuleRenderer>
    );
  });
}
